import { create } from 'zustand'

// Up to 3 pinned DMs, kept on this device (like chat history).
export const MAX_PINS = 3
const KEY = 'gat.pins.v1'

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_PINS) : []
  } catch {
    return []
  }
}

export const usePins = create<{ ids: string[] }>(() => ({ ids: load() }))

/** Pin or unpin a conversation. Returns false when all pin slots are taken. */
export function togglePin(convId: string): boolean {
  const ids = usePins.getState().ids
  let next: string[]
  if (ids.includes(convId)) next = ids.filter((x) => x !== convId)
  else if (ids.length >= MAX_PINS) return false
  else next = [...ids, convId]
  usePins.setState({ ids: next })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* blocked */
  }
  return true
}

export const useIsPinned = (convId: string | null | undefined) => usePins((s) => !!convId && s.ids.includes(convId))
