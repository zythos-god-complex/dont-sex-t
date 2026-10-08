// Selector hooks. Every hook selects the minimum and uses shallow equality for derived values,
// so components only re-render when what they show changes.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { resolveChat } from './engine'
import { computePushState, usePushDevice, type PushState } from './push'
import { EMPTY_MESSAGES, sortConversations, ts, useStore } from './store'
import type { ConnectionState, Conversation, Gender, Me, Message, OnlineUser, PendingState, ResolveStatus, Toast } from './types'

export { useStore }

// ---- session ----------------------------------------------------------------------------------

export const useMe = (): Me | null => useStore((s) => s.me)
export const useStatus = (): 'booting' | 'onboarding' | 'ready' => useStore((s) => s.status)
export const useConnection = (): ConnectionState => useStore((s) => s.connection)

// ---- lobby ------------------------------------------------------------------------------------

export type OnlineFilter = 'all' | 'm' | 'f'
export type OnlineCounts = { all: number; m: number; f: number }

/** Live users (excluding me), newest arrival first, plus live counts per gender. */
export function useOnline(filter: OnlineFilter = 'all'): { list: OnlineUser[]; counts: OnlineCounts } {
  const list = useStore(
    useShallow((s) => {
      const arr: OnlineUser[] = []
      for (const id in s.online) {
        const u = s.online[id]
        if (filter === 'all' || u.gender === filter) arr.push(u)
      }
      arr.sort((a, b) => ts(b.since) - ts(a.since) || (a.id < b.id ? -1 : 1))
      return arr
    }),
  )
  const counts = useOnlineCounts()
  return useMemo(() => ({ list, counts }), [list, counts])
}

export function useOnlineCounts(): OnlineCounts {
  return useStore(
    useShallow((s) => {
      let m = 0
      let f = 0
      for (const id in s.online) {
        if (s.online[id].gender === 'f') f++
        else m++
      }
      return { all: m + f, m, f }
    }),
  )
}

export const useOnlineCount = (): number => useStore((s) => Object.keys(s.online).length)
export const useIsOnline = (peerId: string | null | undefined): boolean => useStore((s) => !!peerId && !!s.online[peerId])

/** Best known display data for a user id (verified profile, else conversation peer, else presence meta). */
export function useProfile(peerId: string | null | undefined): { id: string; username: string; gender: Gender } | null {
  return useStore(
    useShallow((s) => {
      if (!peerId) return null
      const p = s.profiles[peerId]
      if (p) return { id: p.id, username: p.username, gender: p.gender }
      const cid = s.convByPeer[peerId]
      const c = cid ? s.conversations[cid] : undefined
      if (c) return { id: c.peer.id, username: c.peer.username, gender: c.peer.gender }
      const o = s.online[peerId]
      if (o) return { id: o.id, username: o.username, gender: o.gender }
      return null
    }),
  )
}

// ---- conversations ----------------------------------------------------------------------------

/** DM list: newest activity first; only conversations with a message or that I opened. */
export function useConversations(): Conversation[] {
  return useStore(
    useShallow((s) => {
      const out: Conversation[] = []
      for (const id in s.conversations) {
        const c = s.conversations[id]
        if (c.last_message || (s.messages[id] && s.messages[id].length) || s.opened[id]) out.push(c)
      }
      return sortConversations(out)
    }),
  )
}

export const useConversation = (id: string | null | undefined): Conversation | null =>
  useStore((s) => (id ? (s.conversations[id] ?? null) : null))

export const useConversationIdByPeer = (peerId: string | null | undefined): string | null =>
  useStore((s) => (peerId ? (s.convByPeer[peerId] ?? null) : null))

export const useActiveConv = (): string | null => useStore((s) => s.activeConv)

// ---- messages ---------------------------------------------------------------------------------

/** Ascending by created_at, deduped. Stable empty array when none. */
export const useMessages = (convId: string | null | undefined): Message[] =>
  useStore((s) => (convId ? (s.messages[convId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES))

export const usePending = (msgId: string | null | undefined): PendingState | undefined =>
  useStore((s) => (msgId ? s.pending[msgId] : undefined))

/** Whether older pages exist (false until known). */
export const useHasMore = (convId: string | null | undefined): boolean => useStore((s) => !!convId && s.hasMore[convId] === true)

/** True once the newest page came from the server (or the chat is known to be empty). */
export const useChatLoaded = (convId: string | null | undefined): boolean => useStore((s) => !!convId && !!s.loaded[convId])

export const useLoadingOlder = (convId: string | null | undefined): boolean => useStore((s) => !!convId && !!s.loadingOlder[convId])

export type MineStatus = { id: string; state: 'sending' | 'failed' | 'sent' | 'seen' } | null

/** Status of my newest message in a chat: drives the tiny "sent" / "seen" line. */
export function useMyLastStatus(convId: string | null | undefined): MineStatus {
  return useStore(
    useShallow((s) => {
      if (!convId) return null
      const list = s.messages[convId]
      const c = s.conversations[convId]
      const me = s.me
      if (!list || !c || !me) return null
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i]
        if (m.sender_id !== me.id || m.kind !== 'text') continue
        const p = s.pending[m.id]
        if (p) return { id: m.id, state: p }
        return { id: m.id, state: ts(c.peer_last_read_at) >= ts(m.created_at) ? 'seen' : 'sent' }
      }
      return null
    }),
  )
}

// ---- typing -----------------------------------------------------------------------------------

/** Peer is typing in this conversation. */
export const usePeerTyping = (convId: string | null | undefined): boolean => useStore((s) => !!convId && !!s.typing[convId])

/** That peer is typing to me (in our conversation). */
export const useTypingToMe = (peerId: string | null | undefined): boolean =>
  useStore((s) => {
    if (!peerId) return false
    const cid = s.convByPeer[peerId]
    return !!cid && !!s.typing[cid]
  })

// ---- unread -----------------------------------------------------------------------------------

export const useUnreadTotal = (): number =>
  useStore((s) => {
    let n = 0
    for (const id in s.conversations) n += s.conversations[id].unread || 0
    return n
  })

export const useUnreadFrom = (peerId: string | null | undefined): number =>
  useStore((s) => {
    if (!peerId) return 0
    const cid = s.convByPeer[peerId]
    return (cid && s.conversations[cid]?.unread) || 0
  })

// ---- peer status ------------------------------------------------------------------------------

export type PeerStatus = { online: boolean; away: boolean; typing: boolean; lastSeenAt: string | null; since: string | null }

/** online (in lobby presence), away (all their tabs hidden), typing (to me), lastSeenAt (ISO), since (online since). */
export function usePeerStatus(peerId: string | null | undefined): PeerStatus {
  return useStore(
    useShallow((s) => {
      if (!peerId) return { online: false, away: false, typing: false, lastSeenAt: null, since: null }
      const o = s.online[peerId]
      const cid = s.convByPeer[peerId]
      const c = cid ? s.conversations[cid] : undefined
      const a = s.profiles[peerId]?.last_seen_at ?? null
      const b = c?.peer.last_seen_at ?? null
      const lastSeenAt = a && b ? (ts(a) >= ts(b) ? a : b) : (a ?? b)
      return {
        online: !!o,
        away: !!o?.away,
        typing: !!cid && !!s.typing[cid],
        lastSeenAt,
        since: o?.since ?? null,
      }
    }),
  )
}

// ---- toasts -----------------------------------------------------------------------------------

/** Oldest first, max 2. Each auto-expires after 4s (dismissToast(id) to close early). */
export const useToasts = (): Toast[] => useStore((s) => s.toasts)

// ---- chat route resolution --------------------------------------------------------------------

/**
 * For /dm/:username. Instant when the conversation is known (cache / lobby / dms); otherwise
 * resolves via gat_lookup + gat_open. status: 'loading' | 'ready' | 'not_found' | 'self' | 'error'.
 */
export function useResolveChat(username: string | null | undefined): { status: ResolveStatus; conversation: Conversation | null } {
  const key = (username ?? '').toLowerCase()
  const ready = useStore((s) => s.status === 'ready')
  const convId = useStore((s) => {
    if (!key) return null
    const r = s.resolve[key]
    if (r?.convId) return r.convId
    for (const id in s.conversations) if (s.conversations[id].peer.username.toLowerCase() === key) return id
    return null
  })
  const status = useStore((s) => (key ? s.resolve[key]?.status : undefined))
  const conversation = useStore((s) => (convId ? (s.conversations[convId] ?? null) : null))
  useEffect(() => {
    if (ready && username) void resolveChat(username)
  }, [ready, username])
  return useMemo(
    () => ({ status: conversation ? 'ready' : (status ?? 'loading'), conversation }),
    [conversation, status],
  )
}

// ---- push -------------------------------------------------------------------------------------

/** 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on' for a chat on this device. */
export function usePushState(convId: string | null | undefined): PushState {
  const dev = usePushDevice(useShallow((d) => ({ supported: d.supported, needsInstall: d.needsInstall, permission: d.permission, subscribed: d.subscribed, busy: d.busy })))
  const muted = useStore((s) => (convId ? s.conversations[convId]?.muted : undefined))
  return computePushState(dev, muted)
}

export const usePushBusy = (): boolean => usePushDevice((d) => d.busy)

// ---- clock ------------------------------------------------------------------------------------

type Ticker = { now: number; subs: Set<() => void>; timer: ReturnType<typeof setInterval> | null }
const tickers = new Map<number, Ticker>()

function ticker(ms: number): Ticker {
  let t = tickers.get(ms)
  if (!t) {
    t = { now: Date.now(), subs: new Set(), timer: null }
    tickers.set(ms, t)
  }
  return t
}

/** A ticking clock (epoch ms) for relative times. All users of the same interval share one timer. */
export function useNow(ms = 30000): number {
  const subscribe = useMemo(
    () => (cb: () => void) => {
      const t = ticker(ms)
      t.subs.add(cb)
      if (!t.timer) {
        t.now = Date.now()
        t.timer = setInterval(() => {
          t.now = Date.now()
          for (const s of t.subs) s()
        }, ms)
      }
      return () => {
        t.subs.delete(cb)
        if (!t.subs.size && t.timer) {
          clearInterval(t.timer)
          t.timer = null
        }
      }
    },
    [ms],
  )
  return useSyncExternalStore(
    subscribe,
    () => ticker(ms).now,
    () => ticker(ms).now,
  )
}
