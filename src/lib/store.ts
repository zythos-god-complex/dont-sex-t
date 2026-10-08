import { isAvatar } from '../ui/face'
import { create } from 'zustand'
import type {
  ConnectionState,
  Conversation,
  Gender,
  Me,
  Message,
  OnlineUser,
  PendingState,
  Profile,
  ResolveEntry,
  Toast,
} from './types'

export type State = {
  status: 'booting' | 'onboarding' | 'ready'
  me: Me | null
  token: string | null
  online: Record<string, OnlineUser> // from lobby presence, excludes me
  profiles: Record<string, Profile> // verified profile cache
  conversations: Record<string, Conversation> // by conversation id
  convByPeer: Record<string, string> // peer id -> conversation id
  messages: Record<string, Message[]> // by conversation id, ascending by created_at, deduped by id
  pending: Record<string, PendingState> // message id -> state for my optimistic messages
  hasMore: Record<string, boolean> // older pages available
  typing: Record<string, number> // conversation id -> expiry epoch ms (peer typing)
  activeConv: string | null // open + visible conversation
  connection: ConnectionState
  toasts: Toast[]
  // ---- extras (beyond the SPEC shape) ----
  opened: Record<string, true> // conversations I opened (shown in dms even without messages)
  loaded: Record<string, true> // latest page fetched from the server at least once
  loadingOlder: Record<string, true> // loadOlder in flight
  resolve: Record<string, ResolveEntry> // lowercase username -> chat resolution state
}

export function initialState(): State {
  return {
    status: 'booting',
    me: null,
    token: null,
    online: {},
    profiles: {},
    conversations: {},
    convByPeer: {},
    messages: {},
    pending: {},
    hasMore: {},
    typing: {},
    activeConv: null,
    connection: 'connecting',
    toasts: [],
    opened: {},
    loaded: {},
    loadingOlder: {},
    resolve: {},
  }
}

export const useStore = create<State>()(() => initialState())

// ---------------------------------------------------------------------------------------------
// Pure helpers (unit tested)
// ---------------------------------------------------------------------------------------------

export const EMPTY_MESSAGES: Message[] = Object.freeze([]) as unknown as Message[]

export function ts(iso: string | null | undefined): number {
  if (!iso) return 0
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : 0
}

export function compareMessages(a: Message, b: Message): number {
  const d = ts(a.created_at) - ts(b.created_at)
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sameMessage(a: Message, b: Message): boolean {
  return (
    a.id === b.id &&
    a.body === b.body &&
    a.kind === b.kind &&
    a.sender_id === b.sender_id &&
    a.conversation_id === b.conversation_id &&
    ts(a.created_at) === ts(b.created_at)
  )
}

/**
 * Merge `incoming` into an ascending, id-deduped list.
 * - authoritative (default true): incoming copies replace existing ones with the same id
 *   (server copies replace optimistic/broadcast copies; client timestamps get replaced).
 * - authoritative false: only inserts ids that are not present yet (broadcast previews).
 * Returns the original array reference when nothing changed.
 */
export function upsertMessages(
  list: readonly Message[] | undefined,
  incoming: readonly Message[],
  opts: { authoritative?: boolean } = {},
): Message[] {
  const auth = opts.authoritative ?? true
  const base = (list ?? EMPTY_MESSAGES) as Message[]
  if (!incoming.length) return base
  const index = new Map<string, number>()
  for (let i = 0; i < base.length; i++) index.set(base[i].id, i)
  let out: Message[] | null = null
  let needSort = false
  for (const m of incoming) {
    if (!m || !m.id) continue
    const i = index.get(m.id)
    if (i === undefined) {
      if (!out) out = base.slice()
      const last = out[out.length - 1]
      out.push(m)
      index.set(m.id, out.length - 1)
      if (last && compareMessages(last, m) > 0) needSort = true
    } else if (auth) {
      const cur = (out ?? base)[i]
      if (sameMessage(cur, m)) continue
      if (!out) out = base.slice()
      out[i] = m
      if (ts(cur.created_at) !== ts(m.created_at)) needSort = true
    }
  }
  if (!out) return base
  if (needSort) out.sort(compareMessages)
  return out
}

/** Remove a message by id (returns the same reference when absent). */
export function removeMessage(list: readonly Message[] | undefined, id: string): Message[] {
  const base = (list ?? EMPTY_MESSAGES) as Message[]
  const i = base.findIndex((m) => m.id === id)
  if (i < 0) return base
  const out = base.slice()
  out.splice(i, 1)
  return out
}

/** Newest n messages (ascending). */
export function newest(list: readonly Message[] | undefined, n: number): Message[] {
  if (!list) return []
  return list.length > n ? list.slice(list.length - n) : list.slice()
}

export function lastMessage(list: readonly Message[] | undefined): Message | null {
  return list && list.length ? list[list.length - 1] : null
}

/** Count peer messages newer than lastReadAt. */
export function countUnread(list: readonly Message[] | undefined, peerId: string, lastReadAt: string | null | undefined): number {
  if (!list) return 0
  const r = ts(lastReadAt)
  let n = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (ts(m.created_at) <= r) break
    if (m.sender_id === peerId) n++
  }
  return n
}

export function maxIso(a: string | null | undefined, b: string | null | undefined): string {
  if (!a) return b ?? ''
  if (!b) return a
  return ts(b) > ts(a) ? b : a
}

/** Latest activity instant of a conversation (coalesce(last_message_at, created_at)). */
export function convActivity(c: Conversation): number {
  return Math.max(ts(c.last_message_at), ts(c.last_message?.created_at), ts(c.created_at))
}

export function sortConversations(list: Conversation[]): Conversation[] {
  return list.sort((a, b) => convActivity(b) - convActivity(a) || (a.id < b.id ? -1 : 1))
}

function sameProfile(a: Profile, b: Profile): boolean {
  return a.id === b.id && a.username === b.username && a.gender === b.gender && a.last_seen_at === b.last_seen_at
}

function sameConversation(a: Conversation, b: Conversation): boolean {
  return (
    a.id === b.id &&
    a.topic === b.topic &&
    a.theme === b.theme &&
    a.theme_by === b.theme_by &&
    a.theme_at === b.theme_at &&
    a.created_at === b.created_at &&
    a.last_message_at === b.last_message_at &&
    a.my_last_read_at === b.my_last_read_at &&
    a.peer_last_read_at === b.peer_last_read_at &&
    a.muted === b.muted &&
    a.unread === b.unread &&
    a.peer === b.peer &&
    a.last_message === b.last_message
  )
}

/**
 * Merge a server conversation snapshot into the local one.
 * - read markers and last_message_at never move backwards
 * - the newest last_message wins
 * - a newer local (optimistic) theme survives an older server snapshot
 * Returns `prev` when nothing changed.
 */
export function mergeConversation(prev: Conversation | undefined, next: Conversation): Conversation {
  if (!prev) return next
  const peer = sameProfile(prev.peer, next.peer)
    ? prev.peer
    : { ...next.peer, last_seen_at: maxIso(prev.peer.last_seen_at, next.peer.last_seen_at) }
  let last_message = prev.last_message
  const nl = next.last_message
  if (nl) {
    if (!last_message) last_message = nl
    else if (nl.id === last_message.id) last_message = sameMessage(last_message, nl) ? last_message : nl
    else if (compareMessages(nl, last_message) > 0) last_message = nl
  }
  const themeNewer = ts(next.theme_at) >= ts(prev.theme_at)
  const merged: Conversation = {
    ...next,
    peer,
    theme: themeNewer ? next.theme : prev.theme,
    theme_by: themeNewer ? next.theme_by : prev.theme_by,
    theme_at: themeNewer ? next.theme_at : prev.theme_at,
    last_message_at: maxIso(prev.last_message_at, next.last_message_at) || null,
    my_last_read_at: maxIso(prev.my_last_read_at, next.my_last_read_at),
    peer_last_read_at: maxIso(prev.peer_last_read_at, next.peer_last_read_at),
    last_message,
  }
  return sameConversation(prev, merged) ? prev : merged
}

/** Presence state -> online map (by user id), excluding me and rejected ids. Keeps references when unchanged. */
export function presenceToOnline(
  state: Record<string, Array<Record<string, unknown>>>,
  prev: Record<string, OnlineUser>,
  opts: { meId?: string | null; profiles?: Record<string, Profile>; rejected?: ReadonlySet<string> } = {},
): Record<string, OnlineUser> {
  const acc: Record<string, OnlineUser> = {}
  for (const key of Object.keys(state)) {
    for (const raw of state[key] ?? []) {
      const id = typeof raw.id === 'string' ? raw.id : null
      if (!id || id === opts.meId || opts.rejected?.has(id)) continue
      const username = typeof raw.username === 'string' ? raw.username : ''
      const gender: Gender = raw.gender === 'f' ? 'f' : 'm'
      const since = typeof raw.since === 'string' ? raw.since : new Date().toISOString()
      const away = raw.away === true
      const avatar = isAvatar(raw.avatar) ? raw.avatar : null
      const cur = acc[id]
      if (!cur) acc[id] = { id, username, gender, since, away, avatar }
      else {
        cur.away = cur.away && away // away only when every tab is away
        if (ts(since) < ts(cur.since)) cur.since = since
      }
    }
  }
  const out: Record<string, OnlineUser> = {}
  let changed = false
  for (const id of Object.keys(acc)) {
    const n = acc[id]
    const p = opts.profiles?.[id]
    if (p) {
      n.username = p.username
      n.gender = p.gender
      if (p.avatar !== undefined) n.avatar = isAvatar(p.avatar) ? p.avatar : n.avatar
    }
    const o = prev[id]
    if (o && o.username === n.username && o.gender === n.gender && o.since === n.since && o.away === n.away && JSON.stringify(o.avatar ?? null) === JSON.stringify(n.avatar ?? null)) out[id] = o
    else {
      out[id] = n
      changed = true
    }
  }
  if (!changed && Object.keys(prev).length === Object.keys(out).length) return prev
  return out
}
