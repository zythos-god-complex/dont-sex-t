// Web Push: capability detection, permission, subscribe, server registration, SW registration.
import { create } from 'zustand'
import { api } from './api'
import { VAPID_PUBLIC_KEY } from './env'
import { getToken, revalidate, setMuted } from './engine'
import { useStore } from './store'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export type PushDevice = {
  supported: boolean // SW + PushManager + Notification available
  needsInstall: boolean // iOS / iPadOS Safari, not launched from the home screen
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean // this device has a push subscription
  busy: boolean // enable() in flight (permission prompt / subscribe)
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  try {
    return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return nav.standalone === true
  }
}

function detect(): PushDevice {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, needsInstall: false, permission: 'unsupported', subscribed: false, busy: false }
  }
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return {
    supported,
    needsInstall: isIOS() && !isStandalone(),
    permission: supported ? Notification.permission : 'unsupported',
    subscribed: false,
    busy: false,
  }
}

export const usePushDevice = create<PushDevice>()(() => detect())

export function computePushState(dev: PushDevice, muted: boolean | undefined): PushState {
  if (dev.needsInstall) return 'needs-install'
  if (!dev.supported) return 'unsupported'
  if (dev.permission === 'denied') return 'denied'
  if (dev.subscribed && dev.permission === 'granted' && muted === false) return 'on'
  return 'off'
}

export function getPushState(convId: string): PushState {
  return computePushState(usePushDevice.getState(), useStore.getState().conversations[convId]?.muted)
}

function urlB64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

let reg: ServiceWorkerRegistration | null = null
let syncedFor: string | null = null

async function registerSub(sub: PushSubscription): Promise<void> {
  const t = getToken()
  if (!t) return
  const j = sub.toJSON()
  const p256dh = j.keys?.p256dh
  const auth = j.keys?.auth
  if (!p256dh || !auth) return
  await api.pushSubscribe(t, sub.endpoint, p256dh, auth, navigator.userAgent.slice(0, 300))
  syncedFor = t
}

/** Keep the server registration pointing at the current user (an endpoint moves to the latest user). */
async function syncExisting() {
  const t = getToken()
  if (!t || syncedFor === t || !reg?.pushManager) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const sub = await reg.pushManager.getSubscription()
    usePushDevice.setState({ subscribed: !!sub })
    if (sub) await registerSub(sub)
  } catch {
    /* ignore */
  }
}

function onSwMessage(e: MessageEvent) {
  const d = e.data as { type?: string; url?: string } | null
  if (!d || typeof d !== 'object') return
  if (d.type === 'push') revalidate()
  else if (d.type === 'navigate' && typeof d.url === 'string') {
    try {
      const u = new URL(d.url, location.origin)
      if (u.origin !== location.origin) return
      const path = u.pathname + u.search + u.hash
      if (path !== location.pathname + location.search + location.hash) {
        history.pushState(null, '', path)
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      }
    } catch {
      /* ignore */
    }
  }
}

/** Register /sw.js (call once at boot). */
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  if (reg) return reg
  navigator.serviceWorker.addEventListener('message', onSwMessage)
  try {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
  try {
    const sub = reg.pushManager ? await reg.pushManager.getSubscription() : null
    usePushDevice.setState({
      subscribed: !!sub,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    })
  } catch {
    /* ignore */
  }
  // sync the device subscription to whoever is signed in, now and after sign in
  void syncExisting()
  useStore.subscribe((s, p) => {
    if (s.token !== p.token && s.token) void syncExisting()
  })
  // permission can change in browser settings while we are open
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && typeof Notification !== 'undefined') {
      const perm = Notification.permission
      if (perm !== usePushDevice.getState().permission) usePushDevice.setState({ permission: perm })
    }
  })
  return reg
}

/**
 * Turn notifications on for a chat: permission prompt (call from a tap) -> subscribe -> gat_push_subscribe -> unmute.
 * Resolves to the resulting state.
 */
export async function enable(convId: string): Promise<PushState> {
  const dev = usePushDevice.getState()
  if (dev.needsInstall || !dev.supported) return getPushState(convId)
  // fast path: device already subscribed, just unmute (optimistic)
  if (dev.subscribed && Notification.permission === 'granted') {
    void syncExisting()
    await setMuted(convId, false)
    return getPushState(convId)
  }
  usePushDevice.setState({ busy: true })
  try {
    // the permission prompt must be the first await so it stays inside the user gesture
    let perm: NotificationPermission = Notification.permission
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission()
      } catch {
        perm = Notification.permission
      }
    }
    usePushDevice.setState({ permission: perm })
    if (perm !== 'granted') return getPushState(convId)
    const r = reg ?? (await navigator.serviceWorker.ready)
    reg = r
    let sub = await r.pushManager.getSubscription()
    if (!sub) {
      sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    usePushDevice.setState({ subscribed: true })
    await Promise.all([registerSub(sub), setMuted(convId, false)])
  } catch (e) {
    console.warn('[push] enable failed', e)
  } finally {
    usePushDevice.setState({ busy: false })
  }
  return getPushState(convId)
}

/** Turn notifications off for a chat (gat_mute true). The device subscription stays for other chats. */
export async function disable(convId: string): Promise<PushState> {
  await setMuted(convId, true)
  return getPushState(convId)
}

/** Toggle helper for the settings sheet. */
export function togglePush(convId: string): Promise<PushState> {
  return getPushState(convId) === 'on' ? disable(convId) : enable(convId)
}
