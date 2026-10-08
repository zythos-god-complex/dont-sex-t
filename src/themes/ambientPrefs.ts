import { create } from 'zustand'

// Per-device feel for falling/floating theme effects. amount and speed are multipliers.
type Prefs = { amount: number; speed: number }
const KEY = 'gat.ambient.v1'
function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { amount: Number(p.amount) || 1, speed: Number(p.speed) || 1 }
  } catch {
    return { amount: 1, speed: 1 }
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
export const PARTICLE_AMBIENTS = ['petals', 'leaves', 'stars', 'bubbles', 'hearts', 'sparkles'] as const
export const AMBIENT_LABEL: Record<string, string> = { petals: 'petals', leaves: 'leaves', stars: 'stars', bubbles: 'bubbles', hearts: 'hearts', sparkles: 'sparkles' }
