// Who has a custom face. Filled from everything the engine learns (me, profiles, dm peers, presence)
// and cached locally so custom faces paint instantly on reload.
import { create } from 'zustand'
import { useStore } from '../lib/store'
import { isAvatar, type AvatarConfig } from './face'

type Map = Record<string, AvatarConfig | null>
const KEY = 'gat.avatars.v1'

function load(): Map {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Map) : {}
  } catch {
    return {}
  }
}

export const useAvatars = create<{ map: Map }>(() => ({ map: load() }))

let saveTimer: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(useAvatars.getState().map))
    } catch {
      /* storage full or blocked */
    }
  }, 500)
}

function collect() {
  const s = useStore.getState()
  const cur = useAvatars.getState().map
  let next: Map | null = null
  const put = (name: string | undefined, av: unknown) => {
    if (!name || av === undefined) return
    const k = name.toLowerCase()
    const v = isAvatar(av) ? av : null
    const old = cur[k]
    if (old === undefined ? v === null && k in cur : JSON.stringify(old) === JSON.stringify(v)) return
    next ??= { ...cur }
    next[k] = v
  }
  if (s.me) put(s.me.username, s.me.avatar ?? null)
  for (const id in s.online) put(s.online[id].username, s.online[id].avatar)
  for (const id in s.conversations) put(s.conversations[id].peer.username, s.conversations[id].peer.avatar)
  for (const id in s.profiles) put(s.profiles[id].username, s.profiles[id].avatar)
  if (next) {
    useAvatars.setState({ map: next })
    save()
  }
}

useStore.subscribe((s, p) => {
  if (s.me !== p.me || s.online !== p.online || s.conversations !== p.conversations || s.profiles !== p.profiles) collect()
})
collect()

export function useAvatarFor(name: string | null | undefined): AvatarConfig | null | undefined {
  return useAvatars((s) => (name ? s.map[name.toLowerCase()] : undefined))
}
