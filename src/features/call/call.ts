// Voice calls, only between the admin and Ember. Audio goes phone to phone (WebRTC); the chat's own
// realtime topic carries the handshake. Nothing about a call is stored on the server.
import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/realtime-js'
import { canPush, channel, removeChannel } from '../../lib/realtime'
import { useStore } from '../../lib/store'
import { sendMessage } from '../../lib/engine'
import type { Conversation, Profile } from '../../lib/types'

export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'live' | 'ended'
type S = { state: CallState; convId: string | null; peer: string; muted: boolean; speaker: boolean; since: number; note: string }
export const useCall = create<S>(() => ({ state: 'idle', convId: null, peer: '', muted: false, speaker: false, since: 0, note: '' }))
const set = useCall.setState
const get = useCall.getState

/** the only two accounts that can call each other */
export function isCallPair(me: Pick<Profile, 'username' | 'admin'> | null | undefined, peer: Pick<Profile, 'username' | 'admin'> | null | undefined): boolean {
  if (!me || !peer) return false
  const ember = (p: Pick<Profile, 'username'>) => p.username.toLowerCase() === 'ember'
  return (!!me.admin && ember(peer)) || (ember(me) && !!peer.admin)
}

// STUN finds a direct path; a TURN relay (set in env) rescues networks that block it
const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }]
const turn = import.meta.env.VITE_TURN_URL as string | undefined
if (turn) ICE.push({ urls: turn.split(','), username: import.meta.env.VITE_TURN_USER as string, credential: import.meta.env.VITE_TURN_PASS as string })

let ch: RealtimeChannel | null = null
let chTopic = ''
let pc: RTCPeerConnection | null = null
let mic: MediaStream | null = null
let audio: HTMLAudioElement | null = null
let callId = ''
let ringT: ReturnType<typeof setInterval> | undefined
let giveUp: ReturnType<typeof setTimeout> | undefined
let pendingIce: RTCIceCandidateInit[] = []
let tone: { stop: () => void } | null = null

const myId = () => useStore.getState().me?.id ?? ''
const send = (event: string, payload: Record<string, unknown> = {}) => {
  if (ch && canPush(ch)) void ch.send({ type: 'broadcast', event, payload: { ...payload, from: myId(), id: callId } }).catch(() => {})
}

/** listen on the pair's chat for calls; App keeps this pointed at the right conversation */
export function listenCalls(conv: Conversation | null): () => void {
  if (!conv) return () => {}
  const topic = `gat:call:${conv.topic}`
  if (ch && chTopic === topic) return () => {}
  void removeChannel(ch)
  chTopic = topic
  const c = channel(topic)
  const on = (event: string, fn: (p: Record<string, unknown>) => void) =>
    c.on('broadcast', { event }, (e) => {
      const p = ((e as { payload?: Record<string, unknown> }).payload ?? {}) as Record<string, unknown>
      if (p.from && p.from !== myId()) fn(p)
    })
  on('ring', (p) => {
    const s = get().state
    if (s === 'idle' || s === 'ended') {
      callId = String(p.id)
      set({ state: 'incoming', convId: conv.id, peer: conv.peer.username, muted: false, speaker: false, note: '' })
      tone?.stop()
      tone = ringtone('in')
      navigator.vibrate?.([300, 200, 300, 200, 300])
      clearTimeout(giveUp)
      // the caller stops ringing after 40s; drop the screen if no ring arrives for a while
      giveUp = setTimeout(() => get().state === 'incoming' && end('missed'), 8000)
    } else if (s === 'incoming' && p.id === callId) {
      clearTimeout(giveUp)
      giveUp = setTimeout(() => get().state === 'incoming' && end('missed'), 8000)
    }
  })
  on('accept', (p) => {
    if (get().state !== 'outgoing' || p.id !== callId) return
    clearInterval(ringT)
    tone?.stop()
    set({ state: 'connecting' })
    void makeOffer()
  })
  on('decline', (p) => p.id === callId && get().state === 'outgoing' && end('busy'))
  on('hangup', (p) => p.id === callId && get().state !== 'idle' && end(get().state === 'incoming' ? 'missed' : 'ended'))
  on('sdp', (p) => p.id === callId && void onSdp(p.desc as RTCSessionDescriptionInit))
  on('ice', (p) => p.id === callId && void onIce(p.cand as RTCIceCandidateInit))
  c.subscribe()
  ch = c
  return () => {
    if (chTopic !== topic) return
    void removeChannel(c)
    ch = null
    chTopic = ''
  }
}

async function getMic(): Promise<MediaStream> {
  mic ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  return mic
}

function makePc(): RTCPeerConnection {
  const p = new RTCPeerConnection({ iceServers: ICE })
  p.onicecandidate = (e) => e.candidate && send('ice', { cand: e.candidate.toJSON() })
  p.ontrack = (e) => {
    audio ??= new Audio()
    audio.autoplay = true
    audio.srcObject = e.streams[0]
    void audio.play().catch(() => {})
  }
  p.onconnectionstatechange = () => {
    const st = p.connectionState
    if (st === 'connected' && get().state !== 'live') set({ state: 'live', since: Date.now() })
    if (st === 'failed') end('lost')
  }
  mic?.getTracks().forEach((t) => p.addTrack(t, mic!))
  pc = p
  return p
}

async function makeOffer() {
  try {
    await getMic()
    const p = makePc()
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    send('sdp', { desc: p.localDescription?.toJSON() })
  } catch {
    end('lost')
  }
}

async function onSdp(desc: RTCSessionDescriptionInit) {
  try {
    if (desc.type === 'offer') {
      await getMic()
      const p = pc ?? makePc()
      await p.setRemoteDescription(desc)
      for (const c of pendingIce.splice(0)) await p.addIceCandidate(c).catch(() => {})
      const answer = await p.createAnswer()
      await p.setLocalDescription(answer)
      send('sdp', { desc: p.localDescription?.toJSON() })
    } else if (pc) {
      await pc.setRemoteDescription(desc)
      for (const c of pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {})
    }
  } catch {
    end('lost')
  }
}

async function onIce(c: RTCIceCandidateInit) {
  if (!pc || !pc.remoteDescription) return void pendingIce.push(c)
  await pc.addIceCandidate(c).catch(() => {})
}

export async function startCall(conv: Conversation) {
  if (get().state !== 'idle' && get().state !== 'ended') return
  listenCalls(conv)
  callId = Math.random().toString(36).slice(2, 10)
  set({ state: 'outgoing', convId: conv.id, peer: conv.peer.username, muted: false, speaker: false, note: '' })
  try {
    await getMic()
  } catch {
    return end('mic')
  }
  // a line in the chat doubles as the push notification when their app is closed
  sendMessage(conv.id, '[[call]]')
  tone = ringtone('out')
  send('ring')
  ringT = setInterval(() => send('ring'), 2000)
  clearTimeout(giveUp)
  giveUp = setTimeout(() => get().state === 'outgoing' && (send('hangup'), end('no answer')), 40000)
}

export async function acceptCall() {
  if (get().state !== 'incoming') return
  clearTimeout(giveUp)
  tone?.stop()
  set({ state: 'connecting' })
  try {
    await getMic()
  } catch {
    send('decline')
    return end('mic')
  }
  // unlocks audio playback inside the tap, for phones that block it otherwise
  audio ??= new Audio()
  void audio.play().catch(() => {})
  send('accept')
}

export function declineCall() {
  send('decline')
  end('')
}

export function hangUp() {
  send('hangup')
  end('ended')
}

export function toggleMute() {
  const m = !get().muted
  mic?.getAudioTracks().forEach((t) => (t.enabled = !m))
  set({ muted: m })
}

/** phones route to the earpiece or the loudspeaker; where the browser lets us pick, flip it */
export async function toggleSpeaker() {
  const on = !get().speaker
  set({ speaker: on })
  const a = audio as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
  if (!a?.setSinkId) return
  try {
    const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput')
    const pick = outs.find((d) => (on ? /speaker/i.test(d.label) : /earpiece|default/i.test(d.label)))
    if (pick) await a.setSinkId(pick.deviceId)
  } catch {
    /* not supported here */
  }
}

function end(note: string) {
  clearInterval(ringT)
  clearTimeout(giveUp)
  tone?.stop()
  tone = null
  pc?.close()
  pc = null
  pendingIce = []
  mic?.getTracks().forEach((t) => t.stop())
  mic = null
  if (audio) audio.srcObject = null
  set({ state: note ? 'ended' : 'idle', note, muted: false })
  if (note) setTimeout(() => get().state === 'ended' && set({ state: 'idle', note: '' }), 1800)
}

/** ring and ringback made on the fly, no audio files */
function ringtone(kind: 'in' | 'out'): { stop: () => void } {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return { stop: () => {} }
  const ctx = new AC()
  let alive = true
  const beep = (at: number, f: number, len: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = f
    o.type = 'sine'
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(kind === 'in' ? 0.18 : 0.08, at + 0.02)
    g.gain.setValueAtTime(kind === 'in' ? 0.18 : 0.08, at + len - 0.04)
    g.gain.linearRampToValueAtTime(0, at + len)
    o.connect(g).connect(ctx.destination)
    o.start(at)
    o.stop(at + len)
  }
  const cycle = () => {
    if (!alive) return
    const t = ctx.currentTime + 0.05
    if (kind === 'in') {
      beep(t, 880, 0.18)
      beep(t + 0.22, 1175, 0.18)
      beep(t + 0.44, 880, 0.18)
      beep(t + 0.66, 1175, 0.18)
    } else {
      beep(t, 440, 0.9)
    }
  }
  cycle()
  const iv = setInterval(cycle, kind === 'in' ? 2000 : 3000)
  return {
    stop: () => {
      alive = false
      clearInterval(iv)
      void ctx.close().catch(() => {})
    },
  }
}
