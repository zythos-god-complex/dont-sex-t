import { create } from 'zustand'

// Per-device feel for falling/floating theme effects. amount and speed are multipliers.
// Defaults sit at the slider minimums: lightest load out of the box, people can turn it up.
type Prefs = { amount: number; speed: number }
const KEY = 'gat.ambient.v1'
const DEFAULTS: Prefs = { amount: 0.25, speed: 0.3 }
function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { amount: Number(p.amount) || DEFAULTS.amount, speed: Number(p.speed) || DEFAULTS.speed }
  } catch {
    return { ...DEFAULTS }
  }
}
export const useAmbientPrefs = create<Prefs>(() => load())
export function setAmbientPrefs(p: Partial<Prefs>) {
  useAmbientPrefs.setState(p)
  try {
    localStorage.setItem(KEY, JSON.stringify(useAmbientPrefs.getState()))
  } catch {
    /* blocked */
  }
}
export const PARTICLE_AMBIENTS = ['petals', 'leaves', 'stars', 'bubbles', 'hearts', 'sparkles', 'lovebeat', 'party', 'embers'] as const
export const AMBIENT_LABEL: Record<string, string> = { petals: 'petals', leaves: 'leaves', stars: 'stars', bubbles: 'bubbles', hearts: 'hearts', sparkles: 'sparkles', bats: 'bats', lovebeat: 'hearts', party: 'confetti', embers: 'embers' }
