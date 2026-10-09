// Who has flair (perk users only). Seeded once from gat_flairs so hats show on any face by name
// (rooms, stickers), then kept fresh from server profiles (me, dm peers, looked-up profiles).
// Never read from presence: that is client-sent and could be faked.
import { create } from 'zustand'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { Flair } from '../lib/types'

type Map = Record<string, Flair>
const KEY = 'gat.flair.v1'
function load(): Map {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Map
  } catch {
    return {}
  }
}
export const useFlairs = create<{ map: Map }>(() => ({ map: load() }))

function put(entries: [string, Flair | null | undefined][]) {
  const cur = useFlairs.getState().map
  let next: Map | null = null
  for (const [name, f] of entries) {
    const k = name.toLowerCase()
    if (f === undefined) continue
    if (!f) {
      if (k in cur) {
        next ??= { ...cur }
        delete next[k]
      }
      continue
    }
    if (JSON.stringify(cur[k]) === JSON.stringify(f)) continue
    next ??= { ...cur }
    next[k] = f
  }
  if (!next) return
  useFlairs.setState({ map: next })
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* blocked */
  }
}

function collect() {
  const s = useStore.getState()
  const e: [string, Flair | null | undefined][] = []
  // a profile without the vip field is an old payload: leave what we know alone
  const add = (p: { username: string; vip?: boolean; flair?: Flair | null } | undefined) => {
    if (p && p.vip !== undefined) e.push([p.username, p.vip ? (p.flair ?? null) : null])
  }
  add(s.me ?? undefined)
  for (const id in s.conversations) add(s.conversations[id].peer)
  for (const id in s.profiles) add(s.profiles[id])
  put(e)
}
useStore.subscribe((s, p) => {
  if (s.me !== p.me || s.conversations !== p.conversations || s.profiles !== p.profiles) collect()
})
collect()

let seeded = false
function seed() {
  if (seeded) return
  seeded = true
  api
    .flairs()
    .then((list) => {
      const known = new Set(list.map((x) => x.username.toLowerCase()))
      const drop = Object.keys(useFlairs.getState().map).filter((k) => !known.has(k))
      put([...list.map((x) => [x.username, x.flair] as [string, Flair]), ...drop.map((k) => [k, null] as [string, null])])
    })
    .catch(() => {
      seeded = false
    })
}

export function useFlairFor(name: string | null | undefined): Flair | undefined {
  seed()
  return useFlairs((s) => (name ? s.map[name.toLowerCase()] : undefined))
}
