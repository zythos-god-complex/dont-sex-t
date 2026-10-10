// Yap streaks + melting chats from gat_pulse: fetched on sign in, a few seconds after chats change, on focus, every 5 min.
import { create } from 'zustand'
import { api } from './api'
import { getToken } from './engine'
import { useStore } from './store'

export type Streak = { n: number; droop: boolean; me: boolean; peer: boolean }
export const usePulse = create<{ streaks: Record<string, Streak>; melt: Record<string, string> }>(() => ({ streaks: {}, melt: {} }))

let timer: ReturnType<typeof setTimeout> | null = null
export function refreshPulse(delay = 0): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    const t = getToken()
    if (!t) return
    api.pulse(t).then((p) => usePulse.setState({ streaks: p?.streaks ?? {}, melt: p?.melt ?? {} }), () => {})
  }, delay)
}

let started = false
export function startPulse(): void {
  if (started) return
  started = true
  useStore.subscribe((s, p) => {
    if (s.status === 'ready' && p.status !== 'ready') refreshPulse(800)
    else if (s.status === 'ready' && s.conversations !== p.conversations) refreshPulse(4000)
  })
  setInterval(() => refreshPulse(), 5 * 60e3)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshPulse(500)
  })
  if (useStore.getState().status === 'ready') refreshPulse(800)
}
