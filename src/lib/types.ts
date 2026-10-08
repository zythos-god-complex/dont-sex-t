// JSON shapes returned by the RPCs (SPEC.md "JSON shapes returned by RPCs").

export type Gender = 'm' | 'f'

export type Profile = { id: string; username: string; gender: Gender; last_seen_at: string }

export type Me = Profile & { inbox: string }

export type MessageKind = 'text' | 'theme'

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  kind: MessageKind
  body: string
  created_at: string
}

export type Conversation = {
  id: string
  topic: string
  theme: string
  theme_by: string | null
  theme_at: string | null
  created_at: string
  last_message_at: string | null
  peer: Profile
  my_last_read_at: string
  peer_last_read_at: string
  muted: boolean
  unread: number
  last_message: Message | null
}

export const THEME_IDS = [
  'goofy',
  'cherry',
  'midnight',
  'matcha',
  'peach',
  'lagoon',
  'lavender',
  'terminal',
  'bubblegum',
  'citrus',
  'aurora',
  'noir',
  'strawberry',
  'forest',
  'sunset',
  'y2k',
] as const
export type ThemeId = (typeof THEME_IDS)[number]

export type ErrorCode =
  | 'unauthorized'
  | 'username_taken'
  | 'username_invalid'
  | 'gender_invalid'
  | 'not_found'
  | 'forbidden'
  | 'body_invalid'
  | 'rate_limited'
  | 'theme_invalid'
  | 'self_chat'
  | 'network' // fetch failed / offline / timeout
  | 'server' // anything else (5xx, PostgREST errors, missing RPC)

/** A live user from lobby presence (display fields overwritten by the verified profile when known). */
export type OnlineUser = {
  id: string
  username: string
  gender: Gender
  since: string // ISO, earliest tab join
  away: boolean // true only when every tab of theirs is hidden
}

/** In-app banner for a message that arrived in a conversation that is not open+visible. */
export type Toast = {
  id: string // = message id
  convId: string
  peerId: string
  username: string
  gender: Gender
  body: string
  kind: MessageKind
  at: number // epoch ms when shown
}

export type PendingState = 'sending' | 'failed'

export type ConnectionState = 'connecting' | 'online' | 'offline'

export type ResolveStatus = 'loading' | 'ready' | 'not_found' | 'self' | 'error'
export type ResolveEntry = { status: ResolveStatus; convId?: string; peerId?: string }
