import type { AvatarConfig } from '../ui/face'
import { REST_URL, SUPABASE_KEY } from './env'
import type { Conversation, ErrorCode, Gender, Me, Message, Profile } from './types'

const KNOWN_CODES: ReadonlySet<string> = new Set([
  'unauthorized',
  'username_taken',
  'username_invalid',
  'gender_invalid',
  'not_found',
  'forbidden',
  'body_invalid',
  'rate_limited',
  'theme_invalid',
  'self_chat',
  'request_pending',
  'request_cooldown',
  'blocked',
])

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  constructor(code: ErrorCode, status = 0, message?: string) {
    super(message || code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** Map a PostgREST error response to an ApiError. Pure, exported for tests. */
export function parseApiError(status: number, body: unknown): ApiError {
  const b = (body && typeof body === 'object' ? body : {}) as { code?: unknown; message?: unknown }
  const msg = typeof b.message === 'string' ? b.message.trim() : ''
  if (b.code === 'P0001' && KNOWN_CODES.has(msg)) return new ApiError(msg as ErrorCode, status, msg)
  // Also accept a bare known code in message from any error class (defensive).
  if (KNOWN_CODES.has(msg)) return new ApiError(msg as ErrorCode, status, msg)
  if (status === 429) return new ApiError('rate_limited', status, msg || 'rate_limited')
  return new ApiError('server', status, msg || `http ${status}`)
}

export function isApiError(e: unknown, code?: ErrorCode): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code)
}

/** True for failures worth retrying (network / 5xx / rate limit). */
export function isRetryable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true
  return e.code === 'network' || e.code === 'rate_limited' || (e.code === 'server' && (e.status === 0 || e.status >= 500))
}

type RpcOpts = { signal?: AbortSignal; keepalive?: boolean; timeoutMs?: number }

export async function rpc<T>(fn: string, args: Record<string, unknown>, opts: RpcOpts = {}): Promise<T> {
  let res: Response
  const ctrl = opts.signal ? null : new AbortController()
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000) : null
  try {
    res = await fetch(`${REST_URL}/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: opts.signal ?? ctrl?.signal,
      keepalive: opts.keepalive,
    })
  } catch (e) {
    if (timer) clearTimeout(timer)
    throw new ApiError('network', 0, e instanceof Error ? e.message : 'network')
  }
  let text = ''
  try {
    text = await res.text()
  } catch {
    if (timer) clearTimeout(timer)
    throw new ApiError('network', res.status, 'body')
  }
  if (timer) clearTimeout(timer)
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }
  if (!res.ok) throw parseApiError(res.status, json)
  return json as T
}

// ---- typed wrappers (one per RPC) -------------------------------------------------------------

export const api = {
  join: (username: string, gender: Gender) =>
    rpc<{ token: string; me: Me }>('gat_join', { p_username: username, p_gender: gender }),

  me: (token: string) => rpc<Me>('gat_me', { p_token: token }),

  setAvatar: (token: string, avatar: AvatarConfig | null) => rpc<Me>('gat_set_avatar', { p_token: token, p_avatar: avatar }),
  setNsfw: (token: string, on: boolean) => rpc<Me>('gat_set_nsfw', { p_token: token, p_on: on }),
  react: (token: string, message: string, emoji: string | null) => rpc<unknown>('gat_react', { p_token: token, p_message: message, p_emoji: emoji }),
  joinTemp: (gender: Gender) => rpc<{ token: string; me: Me }>('gat_join_temp', { p_gender: gender }),
  rename: (token: string, username: string) => rpc<Me>('gat_rename', { p_token: token, p_username: username }),
  settings: (token: string, showStatus: boolean | null, showSeen: boolean | null) =>
    rpc<Me>('gat_settings', { p_token: token, p_show_status: showStatus, p_show_seen: showSeen }),
  nameHistory: (token: string, userId: string) => rpc<{ username: string; changed_at: string }[]>('gat_name_history_of', { p_token: token, p_user: userId }),
  respond: (token: string, conv: string, accept: boolean) => rpc<Conversation>('gat_respond', { p_token: token, p_conversation: conv, p_accept: accept }),
  block: (token: string, peer: string, on: boolean) => rpc<{ blocked: boolean }>('gat_block', { p_token: token, p_peer: peer, p_on: on }),
  blockList: (token: string) => rpc<{ blocked: string[]; blocked_by: string[] }>('gat_block_list', { p_token: token }),

  profiles: (token: string, ids: string[]) => rpc<Profile[]>('gat_profiles', { p_token: token, p_ids: ids }),

  lookup: (token: string, username: string) => rpc<Profile>('gat_lookup', { p_token: token, p_username: username }),

  open: (token: string, peer: string) => rpc<Conversation>('gat_open', { p_token: token, p_peer: peer }),

  conversations: (token: string) => rpc<Conversation[]>('gat_conversations', { p_token: token }),

  messages: (token: string, conversation: string, before: string | null = null, limit = 40) =>
    rpc<Message[]>('gat_messages', {
      p_token: token,
      p_conversation: conversation,
      p_before: before,
      p_limit: limit,
    }),

  send: (token: string, conversation: string, id: string, body: string, reply: string | null = null) =>
    rpc<Message>('gat_send', { p_token: token, p_conversation: conversation, p_id: id, p_body: body, p_reply: reply }),

  read: (token: string, conversation: string) =>
    rpc<{ at: string }>('gat_read', { p_token: token, p_conversation: conversation }),

  theme: (token: string, conversation: string, theme: string) =>
    rpc<Conversation>('gat_theme', { p_token: token, p_conversation: conversation, p_theme: theme }),

  mute: (token: string, conversation: string, muted: boolean) =>
    rpc<{ muted: boolean }>('gat_mute', { p_token: token, p_conversation: conversation, p_muted: muted }),

  heartbeat: (token: string, conv: string | null, visible: boolean, keepalive = false) =>
    rpc<null>('gat_heartbeat', { p_token: token, p_conv: conv, p_visible: visible }, { keepalive }),

  pushSubscribe: (token: string, endpoint: string, p256dh: string, auth: string, ua: string | null = null) =>
    rpc<null>('gat_push_subscribe', {
      p_token: token,
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_ua: ua,
    }),

  pushUnsubscribe: (token: string, endpoint: string) =>
    rpc<null>('gat_push_unsubscribe', { p_token: token, p_endpoint: endpoint }),
}
