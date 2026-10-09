import type { AvatarConfig } from '../ui/face'
// JSON shapes returned by the RPCs (SPEC.md "JSON shapes returned by RPCs").

export type Gender = 'm' | 'f'

export type HatId = 'none' | 'crown' | 'cap' | 'beanie' | 'halo' | 'bow' | 'tophat' | 'party'
export type CardId = 'ink' | 'gold' | 'rose' | 'grape' | 'mint' | 'sky'
export type AuraId = 'none' | 'gold' | 'sunset' | 'galaxy' | 'sakura' | 'aurora' | 'hearts'
/** Perk-only extras (server-validated). */
export type Flair = { hat?: HatId; bio?: string; card?: CardId; aura?: AuraId }
export type Profile = { id: string; username: string; gender: Gender; last_seen_at: string; avatar?: AvatarConfig | null; show_status?: boolean; show_seen?: boolean; temp?: boolean; nsfw?: boolean; vip?: boolean; flair?: Flair | null; admin?: boolean }

export type Me = Profile & { inbox: string; age_set?: boolean; adult?: boolean; has_key?: boolean }

export type MessageKind = 'text' | 'theme'

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  kind: MessageKind
  body: string
  created_at: string
  reactions?: Record<string, string> // user id -> emoji
  reply_to?: string | null
  reply?: { id: string; sender_id: string; body: string } | null
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
  status?: 'accepted' | 'pending' | 'declined'
  requester?: string | null
  declined_at?: string | null
  blocked?: 'me' | 'them' | null
  my_voice?: boolean
  peer_voice?: boolean
  my_images?: boolean
  cleared_at?: string | null
  peer_images?: boolean
}

export const THEME_IDS = [
  'goofy',
  'cherry',
  'midnight',
  'matcha',
  'lagoon',
  'lavender',
  'terminal',
  'bubblegum',
  'citrus',
  'aurora',
  'forest',
  'y2k',
  'batman',
  'love',
  'bff',
  'lust',
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
  | 'request_pending'
  | 'request_cooldown'
  | 'blocked'
  | 'not_allowed'
  | 'age_required'
  | 'network' // fetch failed / offline / timeout
  | 'server' // anything else (5xx, PostgREST errors, missing RPC)

/** A live user from lobby presence (display fields overwritten by the verified profile when known). */
export type OnlineUser = {
  id: string
  username: string
  gender: Gender
  since: string // ISO, earliest tab join
  away: boolean // true only when every tab of theirs is hidden
  avatar?: AvatarConfig | null // custom face, when they built one
  show_status?: boolean
  nsfw?: boolean
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
