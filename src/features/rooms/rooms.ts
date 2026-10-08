import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/realtime-js'
import { rpc } from '../../lib/api'
import { getToken, onRoomEvent } from '../../lib/engine'
import { canPush, channel, removeChannel } from '../../lib/realtime'
import { useStore } from '../../lib/store'
import type { Profile } from '../../lib/types'

export type RoomMsg = {
  id: string
  room_id: string
  sender_id: string
  body: string
  created_at: string
  sender?: Profile | null
  state?: 'sending' | 'failed'
}
export type Room = {
  id: string
  slug: string | null
  name: string
  kind: 'public' | 'private'
  theme: string
  topic: string
  seed: number
  sort: number
  created_by: string | null
  last_message_at: string | null
  members: number | null
  unread: number
  last_message: RoomMsg | null
}

type Typer = { name: string; at: number }
type S = {
  rooms: Record<string, Room>
  loaded: boolean
  msgs: Record<string, RoomMsg[]>
  more: Record<string, boolean>
  typing: Record<string, Record<string, Typer>>
  here: Record<string, number>
  active: string | null
}
export const useRooms = create<S>(() => ({ rooms: {}, loaded: false, msgs: {}, more: {}, typing: {}, here: {}, active: null }))
const get = useRooms.getState
const set = useRooms.setState

const tok = () => getToken() ?? ''
const me = () => useStore.getState().me

/** Senders are often strangers: feed their profiles to the store so custom faces and horns show up. */
function learn(list: (Profile | null | undefined)[]) {
  const cur = useStore.getState().profiles
  let next: Record<string, Profile> | null = null
  for (const p of list) {
    if (!p?.id) continue
    const old = cur[p.id]
    if (old && old.username === p.username && JSON.stringify(old.avatar) === JSON.stringify(p.avatar) && old.nsfw === p.nsfw) continue
    next ??= { ...cur }
    next[p.id] = { ...old, ...p }
  }
  if (next) useStore.setState({ profiles: next })
}

function putRoom(r: Room) {
  if (!r?.id) return
  const active = get().active === r.id
  set((s) => ({ rooms: { ...s.rooms, [r.id]: { ...r, unread: active ? 0 : r.unread } } }))
  if (r.last_message) learn([r.last_message.sender])
}

onRoomEvent((p) => putRoom(p as unknown as Room))

export async function loadRooms(): Promise<void> {
  try {
    const list = await rpc<Room[]>('gat_rooms', { p_token: tok() })
    const rooms: Record<string, Room> = {}
    const act = get().active
    for (const r of list) rooms[r.id] = r.id === act ? { ...r, unread: 0 } : r
    set({ rooms, loaded: true })
    learn(list.map((r) => r.last_message?.sender))
  } catch {
    set({ loaded: true })
  }
}

export async function fetchRoom(id: string): Promise<Room | null> {
  try {
    const r = await rpc<Room>('gat_room_get', { p_token: tok(), p_room: id })
    putRoom(r)
    return r
  } catch {
    return null
  }
}

function mergeMsgs(a: RoomMsg[], b: RoomMsg[]): RoomMsg[] {
  const map = new Map<string, RoomMsg>()
  for (const m of a) map.set(m.id, m)
  for (const m of b) map.set(m.id, m)
  return [...map.values()].sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0))
}

async function history(id: string, before?: string) {
  const list = await rpc<RoomMsg[]>('gat_room_history', { p_token: tok(), p_room: id, p_before: before ?? null, p_limit: 50 })
  learn(list.map((m) => m.sender))
  set((s) => ({ msgs: { ...s.msgs, [id]: mergeMsgs(s.msgs[id] ?? [], list) }, more: { ...s.more, [id]: list.length >= 50 } }))
}

export async function loadOlderRoom(id: string): Promise<void> {
  const first = get().msgs[id]?.find((m) => !m.state)
  if (!first || !get().more[id]) return
  set((s) => ({ more: { ...s.more, [id]: false } }))
  try {
    await history(id, first.created_at)
  } catch {
    set((s) => ({ more: { ...s.more, [id]: true } }))
  }
}

let readTimer: ReturnType<typeof setTimeout> | undefined
function markRead(id: string) {
  set((s) => (s.rooms[id] && s.rooms[id].unread ? { rooms: { ...s.rooms, [id]: { ...s.rooms[id], unread: 0 } } } : s))
  clearTimeout(readTimer)
  readTimer = setTimeout(() => void rpc('gat_room_read', { p_token: tok(), p_room: id }).catch(() => {}), 600)
}

function onIncoming(id: string, m: RoomMsg) {
  if (!m?.id) return
  learn([m.sender])
  set((s) => {
    let list = s.msgs[id] ?? []
    if (list.some((x) => x.id === m.id)) return s
    // my own optimistic copy: swap it for the real one
    const tmp = m.sender_id === me()?.id ? list.findIndex((x) => x.state && x.body === m.body) : -1
    list = tmp >= 0 ? list.filter((_, i) => i !== tmp) : list
    const typing = { ...(s.typing[id] ?? {}) }
    delete typing[m.sender_id]
    const room = s.rooms[id]
    return {
      msgs: { ...s.msgs, [id]: mergeMsgs(list, [m]) },
      typing: { ...s.typing, [id]: typing },
      rooms: room ? { ...s.rooms, [id]: { ...room, last_message: m, last_message_at: m.created_at } } : s.rooms,
    }
  })
  if (get().active === id && document.visibilityState === 'visible') markRead(id)
}

const chans = new Map<string, RealtimeChannel>()

/** Join a room: history, live messages, typing and a head count. Returns the leave fn. */
export function enterRoom(room: Room): () => void {
  const id = room.id
  set({ active: id })
  markRead(id)
  void history(id).catch(() => {})
  const self = me()
  const ch = channel(`gat:r:${room.topic}`, { presence: { key: self?.id ?? '' } })
  ch.on('broadcast', { event: 'rmsg' }, (e) => onIncoming(id, ((e as { payload?: RoomMsg }).payload ?? e) as RoomMsg))
  ch.on('broadcast', { event: 'typing' }, (e) => {
    const p = ((e as { payload?: unknown }).payload ?? {}) as { id?: string; name?: string; on?: boolean }
    if (!p.id || p.id === self?.id) return
    set((s) => {
      const t = { ...(s.typing[id] ?? {}) }
      if (p.on) t[p.id!] = { name: p.name ?? '', at: Date.now() }
      else delete t[p.id!]
      return { typing: { ...s.typing, [id]: t } }
    })
  })
  ch.on('presence', { event: 'sync' }, () => {
    set((s) => ({ here: { ...s.here, [id]: Object.keys(ch.presenceState()).length } }))
  })
  ch.subscribe((st) => {
    if (st === 'SUBSCRIBED' && self) void ch.track({ name: self.username })
  })
  chans.set(id, ch)
  const sweep = setInterval(() => {
    const t = get().typing[id]
    if (!t) return
    const now = Date.now()
    const keep = Object.fromEntries(Object.entries(t).filter(([, v]) => now - v.at < 5000))
    if (Object.keys(keep).length !== Object.keys(t).length) set((s) => ({ typing: { ...s.typing, [id]: keep } }))
  }, 1500)
  const onVis = () => document.visibilityState === 'visible' && markRead(id)
  document.addEventListener('visibilitychange', onVis)
  return () => {
    clearInterval(sweep)
    document.removeEventListener('visibilitychange', onVis)
    if (get().active === id) set({ active: null })
    chans.delete(id)
    void removeChannel(ch)
  }
}

let lastTyping = 0
export function roomTyping(id: string, on: boolean) {
  const ch = chans.get(id)
  const self = me()
  if (!ch || !canPush(ch) || !self) return
  const now = Date.now()
  if (on && now - lastTyping < 2500) return
  lastTyping = on ? now : 0
  ch.send({ type: 'broadcast', event: 'typing', payload: { id: self.id, name: self.username, on } }).catch(() => {})
}

export async function sendRoom(id: string, body: string): Promise<void> {
  const self = me()
  if (!self) return
  const tmp: RoomMsg = {
    id: 'tmp' + Math.random().toString(36).slice(2),
    room_id: id,
    sender_id: self.id,
    body,
    created_at: new Date(Date.now() + 5000).toISOString(),
    sender: self as unknown as Profile,
    state: 'sending',
  }
  set((s) => ({ msgs: { ...s.msgs, [id]: [...(s.msgs[id] ?? []), tmp] } }))
  roomTyping(id, false)
  try {
    const m = await rpc<RoomMsg>('gat_room_send', { p_token: tok(), p_room: id, p_body: body })
    set((s) => {
      const list = (s.msgs[id] ?? []).filter((x) => x.id !== tmp.id)
      return { msgs: { ...s.msgs, [id]: mergeMsgs(list, [m]) } }
    })
    set((s) => (s.rooms[id] ? { rooms: { ...s.rooms, [id]: { ...s.rooms[id], last_message: m, last_message_at: m.created_at } } } : s))
  } catch {
    set((s) => ({ msgs: { ...s.msgs, [id]: (s.msgs[id] ?? []).map((x) => (x.id === tmp.id ? { ...x, state: 'failed' } : x)) } }))
  }
}

export function retryRoom(id: string, msgId: string) {
  const m = get().msgs[id]?.find((x) => x.id === msgId)
  if (!m) return
  set((s) => ({ msgs: { ...s.msgs, [id]: (s.msgs[id] ?? []).filter((x) => x.id !== msgId) } }))
  void sendRoom(id, m.body)
}

export async function createRoom(name: string, people: string[]): Promise<Room> {
  const r = await rpc<Room>('gat_room_create', { p_token: tok(), p_name: name, p_members: people })
  putRoom(r)
  return r
}

export async function addPeople(id: string, people: string[]): Promise<void> {
  putRoom(await rpc<Room>('gat_room_add', { p_token: tok(), p_room: id, p_users: people }))
}

export async function leaveRoom(id: string): Promise<void> {
  await rpc('gat_room_leave', { p_token: tok(), p_room: id })
  set((s) => {
    const rooms = { ...s.rooms }
    delete rooms[id]
    return { rooms }
  })
}

export async function roomPeople(id: string): Promise<Profile[]> {
  const list = await rpc<Profile[]>('gat_room_people', { p_token: tok(), p_room: id })
  learn(list)
  return list
}

export async function searchUsers(q: string): Promise<Profile[]> {
  const list = await rpc<Profile[]>('gat_search_users', { p_token: tok(), p_q: q })
  learn(list)
  return list
}

export const useRoomList = (): Room[] => {
  const rooms = useRooms((s) => s.rooms)
  return Object.values(rooms).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'public' ? -1 : 1
    if (a.kind === 'public') return a.sort - b.sort
    return (b.last_message_at ?? '') < (a.last_message_at ?? '') ? -1 : 1
  })
}

export const useRoomsUnread = (): number =>
  useRooms((s) => Object.values(s.rooms).reduce((n, r) => n + (r.kind === 'private' ? r.unread : 0), 0))
