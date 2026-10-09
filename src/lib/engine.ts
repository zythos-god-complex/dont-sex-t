import { create } from 'zustand'
import type { AvatarConfig } from '../ui/face'
// Everything live: wires realtime + api into the store.
// Actions are plain exported functions (see bottom). window.__gat exposes them for QA.
import type { RealtimeChannel } from '@supabase/realtime-js'
import { api, isApiError, isRetryable } from './api'
import { archiveMsgs, claimArchive, olderMsgs, wipeConv } from './archive'
import { canPush, channel, getRealtime, onSocket, reconnectNow, removeChannel } from './realtime'
import { clearSession, readSession, setManifestToken, takeUrlToken, writeSession, writeTempSession } from './session'
import {
  countUnread,
  EMPTY_MESSAGES,
  initialState,
  maxIso,
  mergeConversation,
  newest,
  presenceToOnline,
  ts,
  upsertMessages,
  useStore,
  type State,
} from './store'
import { THEME_IDS, type Conversation, type Flair, type Gender, type Me, type Message, type Profile, type ResolveEntry, type Toast } from './types'

const set = useStore.setState
const get = useStore.getState

// ---------------------------------------------------------------------------------------------
// module state
// ---------------------------------------------------------------------------------------------

const hasDoc = typeof document !== 'undefined'
const hasWin = typeof window !== 'undefined'

let booted = false
let gen = 0 // bumps on logout/reset; async results from an older generation are dropped
let token: string | null = null

let lobby: RealtimeChannel | null = null
let lobbySince: string | null = null
let inboxCh: RealtimeChannel | null = null
let inboxTopic: string | null = null
type ConvChan = { ch: RealtimeChannel; topic: string; joinedOnce: boolean }
const convCh = new Map<string, ConvChan>()

let openConv: string | null = null
let visible = hasDoc ? document.visibilityState !== 'hidden' : true
let hiddenAt = 0
let skew = 0 // server clock minus local clock (ms), learned from gat_send round trips
let skewSamples = 0

const rejected = new Set<string>() // presence ids that did not resolve through gat_profiles
const verifyQueue = new Set<string>()
const verifying = new Set<string>()
let verifyTimer: ReturnType<typeof setTimeout> | null = null

const unconfirmed = new Set<string>() // peer messages seen via broadcast only (not yet echoed by the DB)
const serverRead: Record<string, number> = {} // conv id -> my last_read_at as confirmed by the server
const readTimers = new Map<string, ReturnType<typeof setTimeout>>()
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
type TypingOut = { on: boolean; lastSent: number; idle: ReturnType<typeof setTimeout> | null }
const typingOut = new Map<string, TypingOut>()
const inflightLatest = new Map<string, Promise<void>>()
const resolving = new Map<string, Promise<Conversation | null>>()
const muteOps = new Map<string, number>()

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let gapTimer: ReturnType<typeof setTimeout> | null = null
let validateTimer: ReturnType<typeof setTimeout> | null = null

const TOAST_MS = 4000
const TOAST_MAX = 2
const TYPING_TTL = 6000
const PAGE = 40

// ---------------------------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------------------------

export function uuid(): string {
  const c = globalThis.crypto
  try {
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  } catch {
    /* insecure context */
  }
  const b = new Uint8Array(16)
  if (c && c.getRandomValues) c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Local clock corrected by the learned server skew. */
export function serverNow(): number {
  return Date.now() + skew
}
function nowIso(): string {
  return new Date(serverNow()).toISOString()
}

function learnSkew(serverIso: string, t0: number, t1: number) {
  const s = ts(serverIso)
  if (!s || t1 - t0 > 3000) return
  const sample = s - (t0 + t1) / 2
  skew = skewSamples === 0 ? sample : skew * 0.7 + sample * 0.3
  skewSamples++
}

function isActiveVisible(convId: string): boolean {
  return visible && openConv === convId
}

function unwrap(raw: unknown): Record<string, unknown> {
  let p = raw as Record<string, unknown> | null | undefined
  if (p && typeof p === 'object' && 'payload' in p && p.payload && typeof p.payload === 'object') {
    p = p.payload as Record<string, unknown>
  }
  return (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
}

function isMessage(x: unknown): x is Message {
  const m = x as Message
  return !!m && typeof m === 'object' && typeof m.id === 'string' && typeof m.conversation_id === 'string' && typeof m.sender_id === 'string' && typeof m.body === 'string'
}

function isConversation(x: unknown): x is Conversation {
  const c = x as Conversation
  return !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.topic === 'string' && !!c.peer && typeof c.peer.id === 'string'
}

function patchConv(id: string, patch: Partial<Conversation>) {
  set((s) => {
    const c = s.conversations[id]
    if (!c) return s
    let changed = false
    for (const k of Object.keys(patch) as Array<keyof Conversation>) {
      if (c[k] !== patch[k]) {
        changed = true
        break
      }
    }
    if (!changed) return s
    return { conversations: { ...s.conversations, [id]: { ...c, ...patch } } }
  })
}

function setResolve(key: string, entry: ResolveEntry) {
  set((s) => {
    const cur = s.resolve[key]
    if (cur && cur.status === entry.status && cur.convId === entry.convId && cur.peerId === entry.peerId) return s
    return { resolve: { ...s.resolve, [key]: entry } }
  })
}

function markOpened(convId: string) {
  set((s) => (s.opened[convId] ? s : { opened: { ...s.opened, [convId]: true } }))
}

// ---------------------------------------------------------------------------------------------
// local cache (gat.cache.v1)
// ---------------------------------------------------------------------------------------------

const CACHE_KEY = 'gat.cache.v1'
type Cache = {
  v: 1
  tk: string
  me: Me
  conversations: Record<string, Conversation>
  messages: Record<string, Message[]>
  hasMore: Record<string, boolean>
  opened: Record<string, true>
  profiles: Record<string, Profile>
  skew?: number
}

function tokenTag(t: string): string {
  return t.slice(0, 10)
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cache
    if (!c || c.v !== 1 || !c.me || !c.me.id) return null
    return c
  } catch {
    return null
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const s = get()
  if (s.status !== 'ready' || !s.me || !token) return
  const messages: Record<string, Message[]> = {}
  for (const id of Object.keys(s.messages)) {
    const list = s.messages[id].filter((m) => !s.pending[m.id])
    if (list.length) messages[id] = newest(list, PAGE)
  }
  const hasMore: Record<string, boolean> = {}
  for (const id of Object.keys(s.hasMore)) {
    const full = s.messages[id]?.length ?? 0
    // we only keep the newest PAGE, so anything trimmed means older pages exist
    hasMore[id] = s.hasMore[id] || full > PAGE
  }
  const cache: Cache = {
    v: 1,
    tk: tokenTag(token),
    me: s.me,
    conversations: s.conversations,
    messages,
    hasMore,
    opened: s.opened,
    profiles: s.profiles,
    skew,
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* quota */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(persistNow, { timeout: 1000 })
    else persistNow()
  }, 600)
}

function hydrate(c: Cache, t: string) {
  const convByPeer: Record<string, string> = {}
  for (const id of Object.keys(c.conversations || {})) {
    const conv = c.conversations[id]
    if (isConversation(conv)) {
      convByPeer[conv.peer.id] = conv.id
      serverRead[conv.id] = ts(conv.my_last_read_at)
    }
  }
  if (typeof c.skew === 'number' && Number.isFinite(c.skew)) {
    skew = c.skew
  }
  set({
    status: 'ready',
    me: c.me,
    token: t,
    conversations: c.conversations || {},
    convByPeer,
    messages: c.messages || {},
    hasMore: c.hasMore || {},
    opened: c.opened || {},
    profiles: c.profiles || {},
  })
}

// ---------------------------------------------------------------------------------------------
// badge / title
// ---------------------------------------------------------------------------------------------

let lastBadge = -1
function updateBadge() {
  const s = get()
  let n = 0
  if (s.status === 'ready') for (const id of Object.keys(s.conversations)) n += s.conversations[id].unread || 0
  if (n === lastBadge) return
  lastBadge = n
  if (hasDoc) document.title = n > 0 ? `(${n}) GoofyAhhTalk` : 'GoofyAhhTalk'
  const nav = (typeof navigator !== 'undefined' ? navigator : null) as
    | (Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> })
    | null
  try {
    if (nav?.setAppBadge) {
      if (n > 0) nav.setAppBadge(n).catch(() => {})
      else nav.clearAppBadge?.().catch(() => {})
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------------------------
// lobby presence
// ---------------------------------------------------------------------------------------------

function myMeta() {
  const me = get().me
  if (!me) return null
  if (!lobbySince) lobbySince = new Date().toISOString()
  return { id: me.id, username: me.username, gender: me.gender, since: lobbySince, away: !visible, avatar: me.avatar ?? null, show_status: me.show_status !== false, nsfw: me.nsfw === true }
}

function trackMe() {
  if (!lobby || lobby.state !== 'joined' || !token) return
  const meta = myMeta()
  if (meta) lobby.track(meta).catch(() => {})
}

function untrackMe() {
  if (!lobby || lobby.state !== 'joined') return
  lobby.untrack().catch(() => {})
}

function ensureLobby() {
  if (lobby) return
  const me = get().me
  const ch = channel('gat:lobby', { presence: { key: me?.id ?? '' } })
  let joinedOnce = false
  ch.on('presence', { event: 'sync' }, onPresenceSync)
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      trackMe()
      onPresenceSync()
      if (joinedOnce) scheduleGapFill()
      joinedOnce = true
    }
  })
  lobby = ch
}

function onPresenceSync() {
  if (!lobby) return
  const s = get()
  const state = lobby.presenceState() as unknown as Record<string, Array<Record<string, unknown>>>
  const next = presenceToOnline(state, s.online, { meId: s.me?.id, profiles: s.profiles, rejected })
  if (next === s.online) return
  const left = Object.keys(s.online).filter((id) => !next[id])
  const patch: Partial<State> = { online: next }
  if (left.length) {
    // they were online until now: make "active Xm ago" accurate
    const now = new Date().toISOString()
    let profiles = s.profiles
    let conversations = s.conversations
    for (const id of left) {
      const p = profiles[id]
      if (p) profiles = { ...profiles, [id]: { ...p, last_seen_at: maxIso(p.last_seen_at, now) } }
      const cid = s.convByPeer[id]
      const c = cid ? conversations[cid] : undefined
      if (c) conversations = { ...conversations, [c.id]: { ...c, peer: { ...c.peer, last_seen_at: maxIso(c.peer.last_seen_at, now) } } }
    }
    patch.profiles = profiles
    patch.conversations = conversations
  }
  set(patch)
  queueVerify(Object.keys(next).filter((id) => !s.profiles[id]))
}

function queueVerify(ids: string[]) {
  if (!token) return
  const profiles = get().profiles
  for (const id of ids) if (!verifying.has(id) && !rejected.has(id) && !profiles[id]) verifyQueue.add(id)
  if (verifyQueue.size && !verifyTimer) verifyTimer = setTimeout(flushVerify, 150)
}

async function flushVerify() {
  verifyTimer = null
  const t = token
  const g = gen
  if (!t || !verifyQueue.size) return
  const ids = [...verifyQueue].slice(0, 100)
  for (const id of ids) {
    verifyQueue.delete(id)
    verifying.add(id)
  }
  try {
    const profs = await api.profiles(t, ids)
    if (g !== gen) return
    const found = new Set<string>()
    for (const p of profs || []) found.add(p.id)
    for (const id of ids) if (!found.has(id)) rejected.add(id)
    set((s) => {
      const profiles = { ...s.profiles }
      for (const p of profs || []) profiles[p.id] = p
      const online = { ...s.online }
      let onlineChanged = false
      for (const id of ids) {
        const o = online[id]
        if (!o) continue
        const p = profiles[id]
        if (!p) {
          delete online[id]
          onlineChanged = true
        } else if (p.username !== o.username || p.gender !== o.gender) {
          online[id] = { ...o, username: p.username, gender: p.gender }
          onlineChanged = true
        }
      }
      return onlineChanged ? { profiles, online } : { profiles }
    })
  } catch (e) {
    if (g !== gen) return
    if (isApiError(e, 'unauthorized')) return void hardReset()
    for (const id of ids) verifyQueue.add(id) // retry later
    if (!verifyTimer) verifyTimer = setTimeout(flushVerify, 3000)
    return
  } finally {
    for (const id of ids) verifying.delete(id)
  }
  if (verifyQueue.size && !verifyTimer) verifyTimer = setTimeout(flushVerify, 150)
}

// ---------------------------------------------------------------------------------------------
// inbox + conversation channels
// ---------------------------------------------------------------------------------------------

function ensureInbox(me: Me) {
  if (inboxCh && inboxTopic === me.inbox) return
  if (inboxCh) void removeChannel(inboxCh)
  inboxTopic = me.inbox
  const ch = channel(`gat:u:${me.inbox}`)
  let joinedOnce = false
  ch.on('broadcast', { event: 'msg' }, (e) => onDbMsg(unwrap(e)))
  ch.on('broadcast', { event: 'conv' }, (e) => onConvEvent(unwrap(e)))
  ch.on('broadcast', { event: 'react' }, (e) => {
    const p = unwrap(e) as unknown as { message_id: string; conversation_id: string; user_id: string; emoji: string | null }
    if (p?.message_id) applyReaction(p.conversation_id, p.message_id, p.user_id, p.emoji)
  })
  ch.on('broadcast', { event: 'read' }, (e) => onReadEvent(unwrap(e)))
  ch.on('broadcast', { event: 'theme' }, (e) => onThemeEvent(unwrap(e)))
  ch.on('broadcast', { event: 'wipe' }, (e) => {
    const p = unwrap(e) as { conversation_id?: string; at?: string }
    if (p.conversation_id && p.at) applyWipe(p.conversation_id, p.at)
  })
  ch.on('broadcast', { event: 'room' }, (e) => {
    const p = unwrap(e)
    roomSubs.forEach((f) => f(p))
  })
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (joinedOnce) scheduleGapFill()
      joinedOnce = true
    }
  })
  inboxCh = ch
}

function ensureConvChannel(c: Conversation) {
  if (!token) return
  const cur = convCh.get(c.id)
  if (cur && cur.topic === c.topic) return
  if (cur) void removeChannel(cur.ch)
  const ch = channel(`gat:c:${c.topic}`)
  const entry: ConvChan = { ch, topic: c.topic, joinedOnce: false }
  const convId = c.id
  ch.on('broadcast', { event: 'typing' }, (e) => onPeerTyping(convId, unwrap(e)))
  ch.on('broadcast', { event: 'confetti' }, () => confettiSubs.forEach((f) => f(convId)))
  ch.on('broadcast', { event: 'msg' }, (e) => onPeerBroadcastMsg(convId, unwrap(e)))
  ch.on('broadcast', { event: 'react' }, (e) => {
    const p = unwrap(e) as unknown as { message_id: string; user_id: string; emoji: string | null }
    if (p?.message_id && p.user_id === get().conversations[convId]?.peer.id) applyReaction(convId, p.message_id, p.user_id, p.emoji)
  })
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      if (entry.joinedOnce) scheduleGapFill()
      entry.joinedOnce = true
    }
  })
  convCh.set(c.id, entry)
}

/** Forget everything in a chat up to `at` (state, local cache, on-device archive). */
function applyWipe(convId: string, at: string) {
  const cut = ts(at)
  set((s) => {
    const list = s.messages[convId]
    const keep = list ? list.filter((m) => ts(m.created_at) > cut) : list
    const c = s.conversations[convId]
    const out: Partial<State> = {}
    if (list && keep && keep.length !== list.length) out.messages = { ...s.messages, [convId]: keep }
    out.hasMore = { ...s.hasMore, [convId]: false }
    if (c) {
      const lm = c.last_message && ts(c.last_message.created_at) <= cut ? (keep?.[keep.length - 1] ?? null) : c.last_message
      out.conversations = { ...s.conversations, [convId]: { ...c, last_message: lm, cleared_at: at, unread: lm === c.last_message ? c.unread : 0 } }
    }
    return out
  })
  void wipeConv(convId, at)
}

export async function clearChat(convId: string, both: boolean): Promise<void> {
  if (!token) return
  applyWipe(convId, new Date(Date.now() + skew).toISOString())
  const c = await api.clear(token, convId, both)
  if (c?.cleared_at) applyWipe(convId, c.cleared_at)
  onConvEvent(c as unknown as Record<string, unknown>)
}

const roomSubs = new Set<(room: Record<string, unknown>) => void>()

/** Private room snapshots pushed to my inbox (created, added, new message). */
export function onRoomEvent(f: (room: Record<string, unknown>) => void): () => void {
  roomSubs.add(f)
  return () => void roomSubs.delete(f)
}

const confettiSubs = new Set<(convId: string) => void>()

/** Peer fired confetti in a conversation. */
export function onPeerConfetti(f: (convId: string) => void): () => void {
  confettiSubs.add(f)
  return () => void confettiSubs.delete(f)
}

export function sendConfetti(convId: string): void {
  broadcast(convId, 'confetti', {})
}

function broadcast(convId: string, event: string, payload: unknown) {
  const e = convCh.get(convId)
  if (!e || !canPush(e.ch)) return
  e.ch.send({ type: 'broadcast', event, payload }).catch(() => {})
}

/** Apply a server conversation snapshot (merge, index, subscribe). */
function applyConversation(c: Conversation, opts: { forceTheme?: boolean } = {}) {
  if (!isConversation(c)) return
  set((s) => {
    const prev = s.conversations[c.id]
    let merged = mergeConversation(prev, c)
    if (opts.forceTheme && (merged.theme !== c.theme || merged.theme_at !== c.theme_at || merged.theme_by !== c.theme_by)) {
      merged = { ...merged, theme: c.theme, theme_by: c.theme_by, theme_at: c.theme_at }
    }
    if (muteOps.has(c.id) && prev && merged.muted !== prev.muted) merged = { ...merged, muted: prev.muted }
    if (isActiveVisible(c.id) && merged.unread) merged = { ...merged, unread: 0 }
    const convByPeer = s.convByPeer[c.peer.id] === c.id ? s.convByPeer : { ...s.convByPeer, [c.peer.id]: c.id }
    const p = s.profiles[c.peer.id]
    const profiles =
      !p || p.username !== merged.peer.username || ts(merged.peer.last_seen_at) > ts(p.last_seen_at)
        ? { ...s.profiles, [c.peer.id]: { ...(p || {}), ...merged.peer, last_seen_at: maxIso(p?.last_seen_at, merged.peer.last_seen_at) } }
        : s.profiles
    if (merged === prev && convByPeer === s.convByPeer && profiles === s.profiles) return s
    return { conversations: merged === prev ? s.conversations : { ...s.conversations, [c.id]: merged }, convByPeer, profiles }
  })
  serverRead[c.id] = Math.max(serverRead[c.id] ?? 0, ts(c.my_last_read_at))
  ensureConvChannel(c)
}

// ---------------------------------------------------------------------------------------------
// incoming events
// ---------------------------------------------------------------------------------------------

function onDbMsg(p: Record<string, unknown>) {
  const message = p.message
  if (!isMessage(message)) return
  const conv = isConversation(p.conversation) ? p.conversation : null
  const s = get()
  const meId = s.me?.id
  if (!meId) return
  const convId = message.conversation_id
  const existed = !!s.messages[convId]?.some((m) => m.id === message.id)
  unconfirmed.delete(message.id)
  const fromPeer = message.sender_id !== meId
  if (conv) applyConversation(conv)
  set((st) => {
    const list = upsertMessages(st.messages[convId], [message])
    const out: Partial<State> = {}
    if (list !== st.messages[convId]) out.messages = { ...st.messages, [convId]: list }
    if (!fromPeer && st.pending[message.id]) {
      const pending = { ...st.pending }
      delete pending[message.id]
      out.pending = pending
    }
    const c = st.conversations[convId]
    if (c) {
      let next = c
      if (!c.last_message || c.last_message.id === message.id || ts(message.created_at) >= ts(c.last_message.created_at)) {
        next = { ...next, last_message: message, last_message_at: maxIso(c.last_message_at, message.created_at) }
      }
      if (!conv && fromPeer && !existed && !isActiveVisible(convId)) next = { ...next, unread: (next.unread || 0) + 1 }
      if (isActiveVisible(convId) && next.unread) next = { ...next, unread: 0 }
      if (next !== c) out.conversations = { ...st.conversations, [convId]: next }
    }
    return Object.keys(out).length ? out : st
  })
  if (!s.conversations[convId] && !conv) void refreshConversations()
  if (fromPeer) onPeerMessageArrived(convId, message, !existed)
}

function onPeerBroadcastMsg(convId: string, p: Record<string, unknown>) {
  const s = get()
  const c = s.conversations[convId]
  if (!c || !isMessage(p)) return
  if (p.sender_id !== c.peer.id || p.conversation_id !== convId) return
  if (!p.body || p.body.length > 2000) return
  if (s.messages[convId]?.some((m) => m.id === p.id)) return
  const list = s.messages[convId]
  const lastTs = list && list.length ? ts(list[list.length - 1].created_at) : 0
  const created = Math.max(serverNow(), lastTs + 1)
  const msg: Message = {
    id: p.id,
    conversation_id: convId,
    sender_id: c.peer.id,
    kind: p.kind === 'theme' ? 'theme' : 'text',
    body: p.body,
    created_at: new Date(created).toISOString(),
    reply_to: typeof p.reply_to === 'string' ? p.reply_to : null,
    reply: p.reply && typeof p.reply === 'object' && typeof (p.reply as { body?: unknown }).body === 'string' ? (p.reply as Message['reply']) : null,
  }
  unconfirmed.add(msg.id)
  set((st) => {
    const cc = st.conversations[convId]
    if (!cc) return st
    const active = isActiveVisible(convId)
    return {
      messages: { ...st.messages, [convId]: upsertMessages(st.messages[convId], [msg], { authoritative: false }) },
      conversations: {
        ...st.conversations,
        [convId]: {
          ...cc,
          last_message: msg,
          last_message_at: maxIso(cc.last_message_at, msg.created_at),
          unread: active ? 0 : (cc.unread || 0) + 1,
        },
      },
    }
  })
  onPeerMessageArrived(convId, msg, true)
}

function onPeerMessageArrived(convId: string, m: Message, isNew: boolean) {
  clearTyping(convId)
  if (isActiveVisible(convId)) markRead(convId)
  else if (isNew) pushToast(convId, m)
}

function onConvEvent(p: Record<string, unknown>) {
  if (!isConversation(p)) return
  applyConversation(p)
}

function onReadEvent(p: Record<string, unknown>) {
  const convId = typeof p.conversation_id === 'string' ? p.conversation_id : null
  const userId = typeof p.user_id === 'string' ? p.user_id : null
  const at = typeof p.at === 'string' ? p.at : null
  if (!convId || !userId || !at) return
  const s = get()
  const c = s.conversations[convId]
  if (!c) return
  if (userId === s.me?.id) {
    serverRead[convId] = Math.max(serverRead[convId] ?? 0, ts(at))
    const my = maxIso(c.my_last_read_at, at)
    const unread = Math.min(c.unread || 0, countUnread(s.messages[convId], c.peer.id, my))
    patchConv(convId, { my_last_read_at: my, unread })
  } else if (userId === c.peer.id) {
    patchConv(convId, { peer_last_read_at: maxIso(c.peer_last_read_at, at) })
  }
}

function onThemeEvent(p: Record<string, unknown>) {
  const convId = typeof p.conversation_id === 'string' ? p.conversation_id : null
  const theme = typeof p.theme === 'string' ? p.theme : null
  if (!convId || !theme) return
  const c = get().conversations[convId]
  if (!c) return
  const at = typeof p.theme_at === 'string' ? p.theme_at : null
  if (at && c.theme_at && ts(at) < ts(c.theme_at) && c.theme_by !== get().me?.id) return
  patchConv(convId, { theme, theme_by: typeof p.theme_by === 'string' ? p.theme_by : null, theme_at: at })
}

function onPeerTyping(convId: string, p: Record<string, unknown>) {
  const c = get().conversations[convId]
  if (!c || p.user_id !== c.peer.id) return
  if (p.on === true) {
    const exp = Date.now() + TYPING_TTL
    set((s) => ({ typing: { ...s.typing, [convId]: exp } }))
    const old = typingTimers.get(convId)
    if (old) clearTimeout(old)
    typingTimers.set(
      convId,
      setTimeout(() => clearTyping(convId), TYPING_TTL),
    )
  } else clearTyping(convId)
}

function clearTyping(convId: string) {
  const t = typingTimers.get(convId)
  if (t) {
    clearTimeout(t)
    typingTimers.delete(convId)
  }
  set((s) => {
    if (!(convId in s.typing)) return s
    const typing = { ...s.typing }
    delete typing[convId]
    return { typing }
  })
}

// ---------------------------------------------------------------------------------------------
// toasts
// ---------------------------------------------------------------------------------------------

function pushToast(convId: string, m: Message) {
  if (!visible || m.kind !== 'text') return
  const s = get()
  const c = s.conversations[convId]
  if (!c || c.muted) return
  const toast: Toast = {
    id: m.id,
    convId,
    peerId: c.peer.id,
    username: c.peer.username,
    gender: c.peer.gender,
    body: m.body,
    kind: m.kind,
    at: Date.now(),
  }
  set((st) => {
    const replaced = st.toasts.filter((t) => t.convId === convId)
    for (const t of replaced) clearToastTimer(t.id)
    let list = st.toasts.filter((t) => t.convId !== convId)
    list = [...list, toast]
    while (list.length > TOAST_MAX) {
      const drop = list.shift()
      if (drop) clearToastTimer(drop.id)
    }
    return { toasts: list }
  })
  toastTimers.set(
    toast.id,
    setTimeout(() => dismissToast(toast.id), TOAST_MS),
  )
}

function clearToastTimer(id: string) {
  const t = toastTimers.get(id)
  if (t) {
    clearTimeout(t)
    toastTimers.delete(id)
  }
}

export function dismissToast(id: string): void {
  clearToastTimer(id)
  set((s) => (s.toasts.some((t) => t.id === id) ? { toasts: s.toasts.filter((t) => t.id !== id) } : s))
}

function dismissToastsFor(convId: string) {
  const s = get()
  for (const t of s.toasts) if (t.convId === convId) dismissToast(t.id)
}

// ---------------------------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------------------------

async function refreshConversations(prefetch = true): Promise<void> {
  const t = token
  const g = gen
  if (!t) return
  try {
    const list = await api.conversations(t)
    if (g !== gen) return
    applyConversationList(list || [], prefetch)
  } catch (e) {
    if (g === gen && isApiError(e, 'unauthorized')) hardReset()
  }
}

function applyConversationList(list: Conversation[], prefetch: boolean) {
  for (const c of list) applyConversation(c)
  if (prefetch) prefetchAll(list)
}

/** Background prefetch of the latest page for every conversation whose tail we do not have. */
function prefetchAll(list: Conversation[]) {
  const s = get()
  const queue: string[] = []
  const loadedPatch: Record<string, true> = {}
  for (const c of list) {
    const msgs = s.messages[c.id]
    if (!c.last_message) {
      if (!s.loaded[c.id]) loadedPatch[c.id] = true
      continue
    }
    if (msgs && msgs.some((m) => m.id === c.last_message!.id) && s.hasMore[c.id] !== undefined) {
      if (!s.loaded[c.id]) loadedPatch[c.id] = true
      continue
    }
    queue.push(c.id)
  }
  if (Object.keys(loadedPatch).length) set((st) => ({ loaded: { ...st.loaded, ...loadedPatch } }))
  if (openConv) {
    const i = queue.indexOf(openConv)
    if (i > 0) {
      queue.splice(i, 1)
      queue.unshift(openConv)
    }
  }
  let next = 0
  const worker = async () => {
    while (next < queue.length) {
      const id = queue[next++]
      try {
        await fetchLatest(id)
      } catch {
        /* ignore */
      }
    }
  }
  for (let i = 0; i < Math.min(4, queue.length); i++) void worker()
}

/** Fetch the newest page and merge it. Detects holes (gap > one page) and resets the list. */
function fetchLatest(convId: string): Promise<void> {
  const existing = inflightLatest.get(convId)
  if (existing) return existing
  const t = token
  const g = gen
  if (!t) return Promise.resolve()
  const p = (async () => {
    let rows: Message[]
    try {
      rows = (await api.messages(t, convId, null, PAGE)) || []
    } catch (e) {
      if (g === gen && isApiError(e, 'unauthorized')) hardReset()
      return
    }
    if (g !== gen) return
    for (const m of rows) unconfirmed.delete(m.id)
    const asc = rows.slice().reverse()
    set((s) => {
      const prev = s.messages[convId] ?? EMPTY_MESSAGES
      let list: Message[]
      let more = s.hasMore[convId]
      const confirmedPrev = prev.filter((m) => !s.pending[m.id] && !unconfirmed.has(m.id))
      const ids = new Set(asc.map((m) => m.id))
      const overlap = confirmedPrev.some((m) => ids.has(m.id))
      if (rows.length === PAGE && confirmedPrev.length > 0 && !overlap) {
        // hole between what we had and the newest page: restart from the newest page
        const keep = prev.filter((m) => s.pending[m.id] || unconfirmed.has(m.id))
        list = upsertMessages(asc, keep, { authoritative: false })
        more = true
      } else {
        list = upsertMessages(prev, asc)
        if (more === undefined || confirmedPrev.length === 0) more = rows.length === PAGE
      }
      const out: Partial<State> = {
        loaded: s.loaded[convId] ? s.loaded : { ...s.loaded, [convId]: true },
        hasMore: s.hasMore[convId] === more ? s.hasMore : { ...s.hasMore, [convId]: more },
      }
      if (list !== prev) out.messages = { ...s.messages, [convId]: list }
      const c = s.conversations[convId]
      const tail = list[list.length - 1]
      if (c && tail && (!c.last_message || ts(tail.created_at) > ts(c.last_message.created_at))) {
        out.conversations = { ...s.conversations, [convId]: { ...c, last_message: tail, last_message_at: maxIso(c.last_message_at, tail.created_at) } }
      }
      return out
    })
    if (isActiveVisible(convId)) markRead(convId)
    void checkArchiveMore(convId)
  })().finally(() => inflightLatest.delete(convId))
  inflightLatest.set(convId, p)
  return p
}

function scheduleGapFill() {
  if (!token) return
  if (gapTimer) clearTimeout(gapTimer)
  gapTimer = setTimeout(() => {
    gapTimer = null
    void gapFill()
  }, 300)
}

async function gapFill() {
  if (!token) return
  const open = openConv
  await Promise.all([refreshConversations(true), open ? fetchLatest(open) : Promise.resolve()])
}

// ---------------------------------------------------------------------------------------------
// heartbeat + visibility
// ---------------------------------------------------------------------------------------------

function heartbeatNow(keepalive = false) {
  const t = token
  if (!t) return
  api.heartbeat(t, visible ? openConv : null, visible, keepalive).catch((e) => {
    if (isApiError(e, 'unauthorized')) hardReset()
  })
}

function startHeartbeatLoop() {
  if (heartbeatTimer || !token) return
  heartbeatTimer = setInterval(() => {
    if (visible) heartbeatNow()
  }, 20000)
}

function stopHeartbeatLoop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

function syncActive() {
  const a = visible ? openConv : null
  if (get().activeConv !== a) set({ activeConv: a })
}

function onVisibility() {
  const v = document.visibilityState !== 'hidden'
  if (v === visible) return
  visible = v
  syncActive()
  trackMe()
  if (v) {
    reconnectNow()
    if (token) {
      heartbeatNow()
      startHeartbeatLoop()
      if (hiddenAt && Date.now() - hiddenAt > 10000) scheduleGapFill()
      if (openConv) {
        markRead(openConv)
        dismissToastsFor(openConv)
      }
    }
  } else {
    hiddenAt = Date.now()
    if (openConv) setTyping(openConv, false)
    heartbeatNow(true)
    stopHeartbeatLoop()
    persistNow()
  }
}

function installGlobalListeners() {
  if (!hasDoc || !hasWin) return
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', () => {
    untrackMe()
    if (openConv) setTyping(openConv, false)
    heartbeatNow(true)
    persistNow()
  })
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) {
      reconnectNow()
      trackMe()
      scheduleGapFill()
    }
  })
  window.addEventListener('online', () => {
    reconnectNow()
    scheduleGapFill()
  })
  window.addEventListener('offline', () => set({ connection: 'offline' }))
  window.addEventListener('focus', () => {
    if (openConv && visible) markRead(openConv)
  })
}

function onSocketEvent(e: 'open' | 'close' | 'error') {
  if (e === 'open') {
    const wasDown = get().connection === 'offline'
    if (get().connection !== 'online') set({ connection: 'online' })
    if (wasDown) {
      scheduleGapFill()
      retryAllFailed()
    }
  } else if (get().connection !== 'offline') {
    set({ connection: 'offline' })
  }
}

// ---------------------------------------------------------------------------------------------
// session lifecycle
// ---------------------------------------------------------------------------------------------

/** Start (idempotently) everything that needs a session: lobby track, inbox, conv channels, heartbeat. */
function startSession() {
  const s = get()
  const me = s.me
  if (!me || !token) return
  ensureLobby()
  trackMe()
  ensureInbox(me)
  for (const id of Object.keys(s.conversations)) ensureConvChannel(s.conversations[id])
  heartbeatNow()
  startHeartbeatLoop()
  // re-verify anyone who was online before we had a token
  queueVerify(Object.keys(get().online))
  // presence might have arrived before we knew our own id
  onPresenceSync()
}

function hardReset() {
  gen++
  token = null
  teardownSession()
  clearSession()
  clearCache()
  setManifestToken(null)
  set({ ...initialState(), status: 'onboarding', connection: get().connection, online: get().online })
  onPresenceSync()
}

function teardownSession() {
  untrackMe()
  lobbySince = null
  if (inboxCh) void removeChannel(inboxCh)
  inboxCh = null
  inboxTopic = null
  for (const e of convCh.values()) void removeChannel(e.ch)
  convCh.clear()
  stopHeartbeatLoop()
  for (const t of readTimers.values()) clearTimeout(t)
  readTimers.clear()
  for (const t of typingTimers.values()) clearTimeout(t)
  typingTimers.clear()
  for (const t of toastTimers.values()) clearTimeout(t)
  toastTimers.clear()
  for (const v of typingOut.values()) if (v.idle) clearTimeout(v.idle)
  typingOut.clear()
  if (verifyTimer) clearTimeout(verifyTimer)
  verifyTimer = null
  verifyQueue.clear()
  verifying.clear()
  rejected.clear()
  unconfirmed.clear()
  inflightLatest.clear()
  resolving.clear()
  muteOps.clear()
  for (const k of Object.keys(serverRead)) delete serverRead[k]
  openConv = null
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  if (gapTimer) clearTimeout(gapTimer)
  gapTimer = null
  if (validateTimer) clearTimeout(validateTimer)
  validateTimer = null
}

async function validate(t: string, fallback: string | null, attempt = 0): Promise<void> {
  const g = gen
  // conversations in parallel with gat_me: no waterfall
  const convP = api.conversations(t).then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  )
  let me: Me
  try {
    me = await api.me(t)
  } catch (e) {
    if (g !== gen) return
    if (isApiError(e, 'unauthorized')) {
      if (fallback && fallback !== t) return validate(fallback, null)
      hardReset()
      return
    }
    // offline / server hiccup: keep cached UI, retry
    const delay = Math.min(15000, 1000 * 2 ** attempt)
    validateTimer = setTimeout(() => {
      validateTimer = null
      void validate(t, fallback, attempt + 1)
    }, delay)
    return
  }
  if (g !== gen) return
  token = t
  writeSession(t, me.username)
  setManifestToken(t)
  const s = get()
  if (s.me && s.me.id !== me.id) {
    // cache belonged to someone else (adopted ?t=): start clean
    teardownSession()
    clearCache()
    set({ ...initialState(), status: 'ready', me, token: t, connection: s.connection, online: s.online })
  } else {
    set({ status: 'ready', me, token: t })
  }
  startSession()
  const r = await convP
  if (g !== gen) return
  if (r.ok) applyConversationList(r.v || [], true)
  else void refreshConversations(true)
}

// ---------------------------------------------------------------------------------------------
// public actions
// ---------------------------------------------------------------------------------------------

/** Boot synchronously: hydrate cache, read session, open the socket, then revalidate in the background. */
export function boot(): void {
  if (booted) return
  booted = true
  installGlobalListeners()
  onSocket(onSocketEvent)
  getRealtime() // open the websocket immediately
  if (typeof navigator !== 'undefined' && navigator.onLine === false) set({ connection: 'offline' })

  useStore.subscribe((s, p) => {
    if (s.conversations !== p.conversations || s.status !== p.status) updateBadge()
    if (
      s.status === 'ready' &&
      (s.messages !== p.messages || s.conversations !== p.conversations || s.me !== p.me || s.hasMore !== p.hasMore || s.opened !== p.opened)
    )
      schedulePersist()
    if (s.me?.id && s.me.id !== p.me?.id) void claimArchive(s.me.id)
    if (s.messages !== p.messages)
      for (const id in s.messages) {
        const list = s.messages[id]
        if (list !== p.messages[id]) archiveMsgs(list.filter((m) => !s.pending[m.id] && !unconfirmed.has(m.id)) as never)
      }
  })

  const urlToken = takeUrlToken()
  const sess = readSession()
  const t = urlToken ?? sess?.token ?? null
  if (!t) {
    clearCache()
    set({ status: 'onboarding' })
    ensureLobby() // read only presence: onboarding shows the live count
    return
  }
  const adopting = !!urlToken && urlToken !== sess?.token
  const cache = readCache()
  if (cache && !adopting && cache.tk === tokenTag(t)) {
    token = t
    hydrate(cache, t)
    setManifestToken(t)
    startSession()
  } else {
    set({ status: 'booting', token: t })
  }
  ensureLobby() // keyed by my id when the cache knows it
  void validate(t, adopting ? (sess?.token ?? null) : null)
}

/** Create a user. Throws ApiError (code: username_taken | username_invalid | gender_invalid | network | server). */
export async function join(username: string, gender: Gender, avatar?: AvatarConfig | null): Promise<Me> {
  const r = await api.join(username.trim(), gender)
  if (avatar) {
    r.me = { ...r.me, avatar }
    try {
      r.me = await api.setAvatar(r.token, avatar)
    } catch {
      /* keep the local face; it still rides along in presence */
    }
  }
  gen++
  teardownSession()
  token = r.token
  writeSession(r.token, r.me.username)
  setManifestToken(r.token)
  const s = get()
  set({ ...initialState(), status: 'ready', me: r.me, token: r.token, connection: s.connection, online: s.online })
  startSession()
  void refreshConversations(true)
  return r.me
}

function findPeerId(nameOrId: string): string | null {
  const s = get()
  const key = nameOrId.toLowerCase()
  if (s.profiles[nameOrId] || s.online[nameOrId] || s.convByPeer[nameOrId]) return nameOrId
  for (const id of Object.keys(s.conversations)) {
    const c = s.conversations[id]
    if (c.peer.username.toLowerCase() === key) return c.peer.id
  }
  for (const id of Object.keys(s.profiles)) if (s.profiles[id].username.toLowerCase() === key) return id
  for (const id of Object.keys(s.online)) if (s.online[id].username.toLowerCase() === key && !rejected.has(id)) return id
  return null
}

/**
 * Resolve a chat by username (or peer id) to a Conversation. Instant when the conversation is known;
 * otherwise gat_lookup (if needed) + gat_open. Progress is mirrored in state.resolve[lowercase key].
 */
export function resolveChat(usernameOrId: string): Promise<Conversation | null> {
  const s = get()
  const me = s.me
  const key = usernameOrId.toLowerCase()
  if (!me || !token) return Promise.resolve(null)
  if (key === me.username.toLowerCase() || usernameOrId === me.id) {
    setResolve(key, { status: 'self' })
    return Promise.resolve(null)
  }
  const peerId = findPeerId(usernameOrId)
  if (peerId) {
    const cid = s.convByPeer[peerId]
    if (cid && s.conversations[cid]) {
      setResolve(key, { status: 'ready', convId: cid, peerId })
      if (!s.loaded[cid]) void fetchLatest(cid)
      return Promise.resolve(s.conversations[cid])
    }
  }
  const inflight = resolving.get(key)
  if (inflight) return inflight
  const cur = s.resolve[key]
  if (!cur || cur.status !== 'ready') setResolve(key, { status: 'loading', peerId: peerId ?? undefined })
  const t = token
  const g = gen
  const p = (async (): Promise<Conversation | null> => {
    try {
      let pid = peerId
      if (!pid) {
        const prof = await api.lookup(t, usernameOrId)
        if (g !== gen) return null
        if (prof.id === me.id) {
          setResolve(key, { status: 'self' })
          return null
        }
        set((st) => ({ profiles: { ...st.profiles, [prof.id]: prof } }))
        pid = prof.id
      }
      const conv = await api.open(t, pid)
      if (g !== gen) return null
      applyConversation(conv)
      markOpened(conv.id)
      setResolve(key, { status: 'ready', convId: conv.id, peerId: conv.peer.id })
      const canonical = conv.peer.username.toLowerCase()
      if (canonical !== key) setResolve(canonical, { status: 'ready', convId: conv.id, peerId: conv.peer.id })
      if (!get().loaded[conv.id]) {
        if (!conv.last_message) set((st) => ({ loaded: { ...st.loaded, [conv.id]: true }, hasMore: { ...st.hasMore, [conv.id]: false } }))
        else void fetchLatest(conv.id)
      }
      return get().conversations[conv.id] ?? conv
    } catch (e) {
      if (g !== gen) return null
      if (isApiError(e, 'unauthorized')) {
        hardReset()
        return null
      }
      setResolve(key, {
        status: isApiError(e, 'not_found') ? 'not_found' : isApiError(e, 'self_chat') ? 'self' : 'error',
        peerId: peerId ?? undefined,
      })
      return null
    } finally {
      resolving.delete(key)
    }
  })()
  resolving.set(key, p)
  return p
}

/** SPEC alias: openChatWith(peerId | username). */
export const openChatWith = resolveChat

/** Optimistic send. Returns the client message id (or null if nothing to send). */
export function sendMessage(convId: string, body: string, replyTo: Message | null = null): string | null {
  const s = get()
  const me = s.me
  const text = body.trim().slice(0, 2000)
  if (!me || !token || !text || !s.conversations[convId]) return null
  const id = uuid()
  const list = s.messages[convId]
  const lastTs = list && list.length ? ts(list[list.length - 1].created_at) : 0
  const created = new Date(Math.max(serverNow(), lastTs + 1)).toISOString()
  const msg: Message = {
    id, conversation_id: convId, sender_id: me.id, kind: 'text', body: text, created_at: created,
    reply_to: replyTo?.id ?? null,
    reply: replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, body: replyTo.body.slice(0, 140) } : null,
  }
  set((st) => {
    const c = st.conversations[convId]
    return {
      messages: { ...st.messages, [convId]: upsertMessages(st.messages[convId], [msg]) },
      pending: { ...st.pending, [id]: 'sending' },
      conversations: c
        ? {
            ...st.conversations,
            [convId]: {
              ...c,
              last_message: msg,
              last_message_at: maxIso(c.last_message_at, created),
              unread: 0,
            },
          }
        : st.conversations,
      opened: st.opened[convId] ? st.opened : { ...st.opened, [convId]: true },
    }
  })
  setTyping(convId, false)
  broadcast(convId, 'msg', msg)
  void deliver(msg, 0)
  return id
}

const RETRY_DELAYS = [500, 1500, 4000]

async function deliver(msg: Message, attempt: number): Promise<void> {
  const t = token
  const g = gen
  if (!t) return
  const t0 = Date.now()
  try {
    const saved = await api.send(t, msg.conversation_id, msg.id, msg.body, msg.reply_to ?? null)
    if (g !== gen) return
    learnSkew(saved.created_at, t0, Date.now())
    const convId = msg.conversation_id
    serverRead[convId] = Math.max(serverRead[convId] ?? 0, ts(saved.created_at))
    set((st) => {
      const pending = { ...st.pending }
      delete pending[msg.id]
      const c = st.conversations[convId]
      const out: Partial<State> = {
        pending,
        messages: { ...st.messages, [convId]: upsertMessages(st.messages[convId], [saved]) },
      }
      if (c) {
        const isLast = !c.last_message || c.last_message.id === saved.id || ts(saved.created_at) >= ts(c.last_message.created_at)
        out.conversations = {
          ...st.conversations,
          [convId]: {
            ...c,
            last_message: isLast ? saved : c.last_message,
            last_message_at: maxIso(c.last_message_at, saved.created_at),
            my_last_read_at: maxIso(c.my_last_read_at, saved.created_at),
          },
        }
      }
      return out
    })
  } catch (e) {
    if (g !== gen) return
    if (isApiError(e, 'unauthorized')) return void hardReset()
    if (isRetryable(e) && attempt < RETRY_DELAYS.length) {
      setTimeout(() => {
        if (g === gen && get().pending[msg.id]) void deliver(msg, attempt + 1)
      }, RETRY_DELAYS[attempt])
      return
    }
    set((st) => (st.pending[msg.id] ? { pending: { ...st.pending, [msg.id]: 'failed' } } : st))
  }
}

/** Retry a failed message (same id, so the server dedupes). */
export function retry(msgId: string): void {
  const s = get()
  if (s.pending[msgId] !== 'failed') return
  let msg: Message | undefined
  for (const id of Object.keys(s.messages)) {
    msg = s.messages[id].find((m) => m.id === msgId)
    if (msg) break
  }
  if (!msg) return
  set((st) => ({ pending: { ...st.pending, [msgId]: 'sending' } }))
  broadcast(msg.conversation_id, 'msg', msg)
  void deliver(msg, 0)
}

function retryAllFailed() {
  const s = get()
  for (const id of Object.keys(s.pending)) if (s.pending[id] === 'failed') retry(id)
}

/** If the server ran out but this device has older messages, re-open "load older". */
async function checkArchiveMore(convId: string): Promise<void> {
  const s = get()
  if (s.hasMore[convId] !== false) return
  const list = s.messages[convId] ?? EMPTY_MESSAGES
  const oldest = list.find((m) => !s.pending[m.id] && !unconfirmed.has(m.id))
  const local = await olderMsgs<Message>(convId, oldest ? oldest.created_at : null, oldest ? 1 : PAGE)
  if (!local.length) return
  set((st) => ({
    messages: oldest ? st.messages : { ...st.messages, [convId]: upsertMessages(st.messages[convId], local, { authoritative: false }) },
    hasMore: { ...st.hasMore, [convId]: true },
    loaded: st.loaded[convId] ? st.loaded : { ...st.loaded, [convId]: true },
  }))
}

/** Load the previous page. Resolves to the number of messages added. */
export async function loadOlder(convId: string): Promise<number> {
  const s = get()
  const t = token
  if (!t || s.loadingOlder[convId] || s.hasMore[convId] === false) return 0
  const list = s.messages[convId] ?? EMPTY_MESSAGES
  const oldest = list.find((m) => !s.pending[m.id] && !unconfirmed.has(m.id))
  if (!oldest) {
    if (!s.loaded[convId]) await fetchLatest(convId)
    return 0
  }
  const g = gen
  set((st) => ({ loadingOlder: { ...st.loadingOlder, [convId]: true } }))
  try {
    const rows = (await api.messages(t, convId, oldest.created_at, PAGE)) || []
    if (g !== gen) return 0
    // the server only keeps 24h; anything older comes from this device's archive
    let local: Message[] = []
    if (rows.length < PAGE) {
      const floor = rows.length ? rows[rows.length - 1].created_at : oldest.created_at
      local = await olderMsgs<Message>(convId, floor, PAGE)
    }
    const before = get().messages[convId]?.length ?? 0
    set((st) => ({
      messages: { ...st.messages, [convId]: upsertMessages(upsertMessages(st.messages[convId], rows.slice().reverse()), local, { authoritative: false }) },
      hasMore: { ...st.hasMore, [convId]: rows.length === PAGE || local.length > 0 },
    }))
    return (get().messages[convId]?.length ?? 0) - before
  } catch (e) {
    if (g === gen && isApiError(e, 'unauthorized')) hardReset()
    return 0
  } finally {
    if (g === gen)
      set((st) => {
        if (!st.loadingOlder[convId]) return st
        const loadingOlder = { ...st.loadingOlder }
        delete loadingOlder[convId]
        return { loadingOlder }
      })
  }
}

/** Optimistic theme change for both people. */
export async function setTheme(convId: string, theme: string): Promise<void> {
  const s = get()
  const c = s.conversations[convId]
  const t = token
  if (!c || !s.me || !t || c.theme === theme || !(THEME_IDS as readonly string[]).includes(theme)) return
  const prev = { theme: c.theme, theme_by: c.theme_by, theme_at: c.theme_at }
  const at = nowIso()
  patchConv(convId, { theme, theme_by: s.me.id, theme_at: at })
  const g = gen
  try {
    const conv = await api.theme(t, convId, theme)
    if (g !== gen) return
    const cur = get().conversations[convId]
    // only force the server's theme if nobody changed it again meanwhile
    applyConversation(conv, { forceTheme: !!cur && cur.theme_at === at })
  } catch (e) {
    if (g !== gen) return
    if (isApiError(e, 'unauthorized')) return void hardReset()
    const cur = get().conversations[convId]
    if (cur && cur.theme_at === at) patchConv(convId, prev)
  }
}

/** Optimistic mute toggle (push for this chat). */
export async function setMuted(convId: string, muted: boolean): Promise<boolean> {
  const c = get().conversations[convId]
  const t = token
  if (!c || !t) return false
  const before = c.muted
  const op = (muteOps.get(convId) ?? 0) + 1
  muteOps.set(convId, op)
  patchConv(convId, { muted })
  const g = gen
  try {
    const r = await api.mute(t, convId, muted)
    if (g !== gen) return false
    if (muteOps.get(convId) === op) {
      muteOps.delete(convId)
      patchConv(convId, { muted: r?.muted ?? muted })
    }
    return true
  } catch (e) {
    if (g !== gen) return false
    if (muteOps.get(convId) === op) {
      muteOps.delete(convId)
      patchConv(convId, { muted: before })
    }
    if (isApiError(e, 'unauthorized')) hardReset()
    return false
  }
}

/** Mark read (debounced). No-op unless the conversation is the active one and the tab is visible. */
export function markRead(convId: string): void {
  if (!isActiveVisible(convId) || !token) return
  const s = get()
  const c = s.conversations[convId]
  if (!c) return
  const list = s.messages[convId]
  let lastPeer: Message | null = null
  if (list) {
    for (let i = list.length - 1; i >= 0; i--)
      if (list[i].sender_id === c.peer.id) {
        lastPeer = list[i]
        break
      }
  }
  const peerTs = Math.max(ts(lastPeer?.created_at), ts(c.last_message && c.last_message.sender_id === c.peer.id ? c.last_message.created_at : null))
  const needServer = (c.unread || 0) > 0 || peerTs > (serverRead[convId] ?? 0)
  if (c.unread || peerTs > ts(c.my_last_read_at)) {
    patchConv(convId, {
      unread: 0,
      my_last_read_at: peerTs > ts(c.my_last_read_at) ? new Date(peerTs).toISOString() : c.my_last_read_at,
    })
  }
  if (!needServer) return
  const old = readTimers.get(convId)
  if (old) clearTimeout(old)
  const t = token
  const g = gen
  readTimers.set(
    convId,
    setTimeout(async () => {
      readTimers.delete(convId)
      try {
        const r = await api.read(t, convId)
        if (g !== gen || !r?.at) return
        serverRead[convId] = Math.max(serverRead[convId] ?? 0, ts(r.at))
        const cur = get().conversations[convId]
        if (cur) patchConv(convId, { my_last_read_at: maxIso(cur.my_last_read_at, r.at) })
      } catch (e) {
        if (g === gen && isApiError(e, 'unauthorized')) hardReset()
      }
    }, 250),
  )
}

/**
 * Composer typing signal. Call setTyping(convId, text.length > 0) on every change and
 * setTyping(convId, false) on blur/clear. Sends on:true at most every 2s, on:false after 4s idle.
 */
export function setTyping(convId: string, on: boolean): void {
  if (!get().me) return
  let st = typingOut.get(convId)
  if (!st) {
    st = { on: false, lastSent: 0, idle: null }
    typingOut.set(convId, st)
  }
  const me = get().me!
  if (on) {
    const now = Date.now()
    if (!st.on || now - st.lastSent >= 2000) {
      broadcast(convId, 'typing', { user_id: me.id, on: true })
      st.lastSent = now
      st.on = true
    }
    if (st.idle) clearTimeout(st.idle)
    st.idle = setTimeout(() => setTyping(convId, false), 4000)
  } else {
    if (st.idle) clearTimeout(st.idle)
    st.idle = null
    if (st.on) {
      broadcast(convId, 'typing', { user_id: me.id, on: false })
      st.on = false
      st.lastSent = 0
    }
  }
}

/** Set the open conversation (null when leaving a chat). Drives heartbeat, read receipts, toasts. */
export function setActiveConv(convId: string | null): void {
  if (openConv === convId) return
  const prev = openConv
  if (prev) setTyping(prev, false)
  openConv = convId
  syncActive()
  heartbeatNow()
  if (convId) {
    const s = get()
    if (s.conversations[convId]) markOpened(convId)
    if (!s.loaded[convId]) void fetchLatest(convId)
    else void checkArchiveMore(convId)
    markRead(convId)
    dismissToastsFor(convId)
  }
}

/** Forget this device's session and go back to onboarding. */
export function logout(): void {
  const t = token
  if (t) api.heartbeat(t, null, false, true).catch(() => {})
  gen++
  teardownSession()
  token = null
  clearSession()
  clearCache()
  setManifestToken(null)
  const s = get()
  set({ ...initialState(), status: 'onboarding', connection: s.connection, online: s.online })
  onPresenceSync()
}

/** Force a refetch of conversations + the open chat (gap fill). */
export function revalidate(): void {
  scheduleGapFill()
}

/** Current session token (null when signed out). */
export function getToken(): string | null {
  return token
}

/** Is a given message unconfirmed (peer broadcast preview not yet echoed by the DB)? */
export function isUnconfirmed(msgId: string): boolean {
  return unconfirmed.has(msgId)
}

// ---------------------------------------------------------------------------------------------
// QA handle
// ---------------------------------------------------------------------------------------------

export const actions = {
  boot,
  join,
  resolveChat,
  openChatWith,
  sendMessage,
  retry,
  loadOlder,
  setTheme,
  setMuted,
  markRead,
  setTyping,
  setActiveConv,
  dismissToast,
  logout,
  revalidate,
  getToken,
}

if (hasWin) {
  ;(window as unknown as { __gat: unknown }).__gat = { useStore, ...actions }
}

// ---------------------------------------------------------------------------------------------
// profile, privacy, temp mode, requests, blocks
// ---------------------------------------------------------------------------------------------

/** Temp mode: random goof name, session only. */
export async function joinTemp(gender: Gender): Promise<Me> {
  const r = await api.joinTemp(gender)
  writeTempSession(r.token)
  gen++
  teardownSession()
  token = r.token
  const s = get()
  set({ ...initialState(), status: 'ready', me: r.me, token: r.token, connection: s.connection, online: s.online })
  startSession()
  void refreshConversations(true)
  void refreshBlocks()
  return r.me
}

function updateMe(me: Me): void {
  set({ me })
  if (token) writeSession(token, me.username)
  trackMe()
}

export async function saveAvatar(avatar: AvatarConfig | null): Promise<void> {
  if (!token) return
  updateMe(await api.setAvatar(token, avatar))
}

export async function renameMe(username: string): Promise<void> {
  if (!token) return
  updateMe(await api.rename(token, username))
}

export async function savePrivacy(showStatus: boolean | null, showSeen: boolean | null): Promise<void> {
  if (!token) return
  const me = get().me
  if (me) set({ me: { ...me, show_status: showStatus ?? me.show_status, show_seen: showSeen ?? me.show_seen } })
  updateMe(await api.settings(token, showStatus, showSeen))
}

export function nameHistory(userId: string) {
  return token ? api.nameHistory(token, userId) : Promise.resolve([])
}

export async function respondRequest(convId: string, accept: boolean): Promise<void> {
  if (!token) return
  const c = get().conversations[convId]
  if (c) set({ conversations: { ...get().conversations, [convId]: { ...c, status: accept ? 'accepted' : 'declined', declined_at: accept ? null : new Date().toISOString() } } })
  onConvEvent(await api.respond(token, convId, accept))
}

export const useBlocks = create<{ blocked: string[]; blockedBy: string[] }>(() => ({ blocked: [], blockedBy: [] }))

export async function refreshBlocks(): Promise<void> {
  if (!token) return
  try {
    const r = await api.blockList(token)
    useBlocks.setState({ blocked: r.blocked ?? [], blockedBy: r.blocked_by ?? [] })
  } catch {
    /* next tick */
  }
}

export async function setBlocked(peerId: string, on: boolean): Promise<void> {
  if (!token) return
  const b = useBlocks.getState()
  useBlocks.setState({ blocked: on ? [...new Set([...b.blocked, peerId])] : b.blocked.filter((x) => x !== peerId) })
  await api.block(token, peerId, on)
  void refreshBlocks()
}

export async function setVoice(convId: string, on: boolean): Promise<void> {
  if (!token) return
  const c = get().conversations[convId]
  if (c) set({ conversations: { ...get().conversations, [convId]: { ...c, my_voice: on } } })
  try {
    onConvEvent(await api.setVoice(token, convId, on))
  } catch {
    const c2 = get().conversations[convId]
    if (c2) set({ conversations: { ...get().conversations, [convId]: { ...c2, my_voice: !on } } })
  }
}

export async function setImages(convId: string, on: boolean): Promise<void> {
  if (!token) return
  const c = get().conversations[convId]
  if (c) set({ conversations: { ...get().conversations, [convId]: { ...c, my_images: on } } })
  try {
    onConvEvent(await api.setImages(token, convId, on))
  } catch {
    const c2 = get().conversations[convId]
    if (c2) set({ conversations: { ...get().conversations, [convId]: { ...c2, my_images: !on } } })
  }
}

/** Admin only: pull back one of your own DM messages for both people. */
export async function unsend(msg: Message): Promise<void> {
  if (!token) return
  const put = (m: Message) => set((st) => ({ messages: { ...st.messages, [m.conversation_id]: upsertMessages(st.messages[m.conversation_id], [m]) } }))
  put({ ...msg, body: '[[unsent]]' })
  try {
    put(await api.unsend(token, msg.id))
  } catch {
    put(msg)
  }
}

/** View-once photo was seen: the server deletes the file and turns the message into [[img-gone]] for both. */
export async function openOnce(msg: Message): Promise<void> {
  if (!token) return
  try {
    const m = await api.openOnce(token, msg.id)
    set((st) => ({ messages: { ...st.messages, [m.conversation_id]: upsertMessages(st.messages[m.conversation_id], [m]) } }))
  } catch {
    /* next refresh catches up */
  }
}

export async function saveFlair(flair: Flair): Promise<void> {
  if (!token) return
  const me = get().me
  if (me) set({ me: { ...me, flair: { ...me.flair, ...flair } } })
  updateMe(await api.setFlair(token, { ...me?.flair, ...flair }))
}

export async function saveNsfw(on: boolean): Promise<void> {
  if (!token) return
  const me = get().me
  if (me) set({ me: { ...me, nsfw: on } })
  trackMe()
  updateMe(await api.setNsfw(token, on))
}

function applyReaction(convId: string, msgId: string, userId: string, emoji: string | null): void {
  const s = get()
  const list = s.messages[convId]
  if (!list) return
  let hit = false
  const next = list.map((m) => {
    if (m.id !== msgId) return m
    hit = true
    const r = { ...(m.reactions ?? {}) }
    if (emoji) r[userId] = emoji
    else delete r[userId]
    return { ...m, reactions: r }
  })
  if (hit) set({ messages: { ...s.messages, [convId]: next } })
}

/** React to a message (same emoji again, or null, removes it). Optimistic. */
export function react(convId: string, msgId: string, emoji: string | null): void {
  const me = get().me
  if (!token || !me) return
  const cur = get().messages[convId]?.find((m) => m.id === msgId)?.reactions?.[me.id] ?? null
  const next = emoji && emoji !== cur ? emoji : null
  applyReaction(convId, msgId, me.id, next)
  broadcast(convId, 'react', { message_id: msgId, user_id: me.id, emoji: next })
  api.react(token, msgId, next).catch(() => applyReaction(convId, msgId, me.id, cur))
}
