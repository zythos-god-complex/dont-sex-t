import { create } from 'zustand'
import { setCurrentMode, type ThemeMode } from './themes'

// Light / dark for the whole app. Personal (this device only), starts out following the phone.
type Pref = 'auto' | ThemeMode
const KEY = 'gat.mode.v1'

function readPref(): Pref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const sys = (): ThemeMode => (mq?.matches ? 'dark' : 'light')
const resolve = (p: Pref): ThemeMode => (p === 'auto' ? sys() : p)

export const useModeStore = create<{ pref: Pref; mode: ThemeMode }>(() => {
  const pref = readPref()
  return { pref, mode: resolve(pref) }
})

function apply(mode: ThemeMode, pref: Pref) {
  setCurrentMode(mode)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (pref === 'auto') delete root.dataset.mode
  else root.dataset.mode = pref
  // browser chrome (status bar / address bar) follows too
  const color = mode === 'dark' ? '#121016' : '#FBF5EC'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}
apply(useModeStore.getState().mode, useModeStore.getState().pref)

mq?.addEventListener('change', () => {
  const { pref } = useModeStore.getState()
  if (pref !== 'auto') return
  const mode = sys()
  apply(mode, pref)
  useModeStore.setState({ mode })
})

export function setMode(mode: ThemeMode) {
  // picking the same thing the phone already does means "follow the phone" again
  const pref: Pref = mode === sys() ? 'auto' : mode
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* private mode */
  }
  apply(mode, pref)
  useModeStore.setState({ pref, mode })
}

export function toggleMode() {
  setMode(useModeStore.getState().mode === 'dark' ? 'light' : 'dark')
}

export const useThemeMode = (): ThemeMode => useModeStore((s) => s.mode)

/** Flip with a circular reveal from (x, y) where the browser supports view transitions. */
export function flipModeFrom(x: number, y: number, commit: (fn: () => void) => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // lite phones skip the full-screen snapshot the circular reveal needs
  if (!doc.startViewTransition || reduce || document.documentElement.dataset.lite) {
    toggleMode()
    return
  }
  const root = document.documentElement
  root.style.setProperty('--vt-x', x + 'px')
  root.style.setProperty('--vt-y', y + 'px')
  doc.startViewTransition(() => commit(toggleMode))
}
