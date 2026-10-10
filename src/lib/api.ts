import type { AvatarConfig } from '../ui/face'
import { JOIN_KEY, REST_URL, SUPABASE_KEY } from './env'
import type { Conversation, ErrorCode, Flair, Gender, Me, Message, Profile } from './types'

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
  'not_allowed',
  'age_required',
  'banned',
  'rename_cooldown',
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
        ...(JOIN_KEY ? { 'x-gat-key': JOIN_KEY } : {}),
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
  setFlair: (token: string, flair: Flair) => rpc<Me>('gat_set_flair', { p_token: token, p_flair: flair }),
  flairs: () => rpc<{ username: string; flair: Flair }[]>('gat_flairs', {}),
  react: (token: string, message: string, emoji: string | null) => rpc<unknown>('gat_react', { p_token: token, p_message: message, p_emoji: emoji }),
  joinTemp: (gender: Gender) => rpc<{ token: string; me: Me }>('gat_join_temp', { p_gender: gender }),
  rename: (token: string, username: string) => rpc<Me>('gat_rename', { p_token: token, p_username: username }),
  settings: (token: string, showStatus: boolean | null, showSeen: boolean | null) =>
    rpc<Me>('gat_settings', { p_token: token, p_show_status: showStatus, p_show_seen: showSeen }),
  nameHistory: (token: string, userId: string) => rpc<{ username: string; changed_at: string }[]>('gat_name_history_of', { p_token: token, p_user: userId }),
  respond: (token: string, conv: string, accept: boolean) => rpc<Conversation>('gat_respond', { p_token: token, p_conversation: conv, p_accept: accept }),
  block: (token: string, peer: string, on: boolean) => rpc<{ blocked: boolean }>('gat_block', { p_token: token, p_peer: peer, p_on: on }),
  setVoice: (token: string, conv: string, on: boolean) => rpc<Record<string, unknown>>('gat_set_voice', { p_token: token, p_conversation: conv, p_on: on }),
  setImages: (token: string, conv: string, on: boolean) => rpc<Record<string, unknown>>('gat_set_images', { p_token: token, p_conversation: conv, p_on: on }),
  setBirth: (token: string, year: number, month: number) => rpc<Me>('gat_set_birth', { p_token: token, p_year: year, p_month: month }),
  makeKey: (token: string) => rpc<{ words: string; me: Me }>('gat_make_key', { p_token: token }),
  recover: (username: string, words: string) => rpc<{ token?: string; me?: Me; error?: string }>('gat_recover', { p_username: username, p_words: words }),
  admin: <T = unknown>(token: string, op: string, a: Record<string, unknown> = {}) => rpc<T>('gat_admin', { p_token: token, p_op: op, p_a: a }),
  report: (token: string, name: string, reason: string) => rpc<boolean>('gat_report', { p_token: token, p_name: name, p_reason: reason }),
  notice: () => rpc<{ text: string; at: string } | null>('gat_notice', {}),
  banState: (token: string) => rpc<{ until: string; appealed: boolean } | null>('gat_ban_state', { p_token: token }),
  appeal: (token: string, text: string) => rpc<boolean>('gat_appeal', { p_token: token, p_text: text }),
  setMood: (token: string, mood: string | null) => rpc<{ mood: string; until: string } | null>('gat_set_mood', { p_token: token, p_mood: mood }),
  setGhost: (token: string, on: boolean) => rpc<boolean>('gat_set_ghost', { p_token: token, p_on: on }),
  pulse: (token: string) => rpc<{ streaks: Record<string, { n: number; droop: boolean; me: boolean; peer: boolean }>; melt: Record<string, string> }>('gat_pulse', { p_token: token }),
  toy: (token: string, conv: string, id: string, kind: string, arg: string | null) => rpc<Record<string, unknown>>('gat_toy', { p_token: token, p_conversation: conv, p_id: id, p_kind: kind, p_arg: arg }),
  gameStart: (token: string, conv: string, id: string, kind: string) => rpc<Record<string, unknown>>('gat_game_start', { p_token: token, p_conversation: conv, p_id: id, p_kind: kind }),
  game: <T>(token: string, id: string) => rpc<T>('gat_game_get', { p_token: token, p_game: id }),
  gameMove: <T>(token: string, id: string, move: string) => rpc<T>('gat_game_move', { p_token: token, p_game: id, p_move: move }),
  hideChat: (token: string, conv: string) => rpc<boolean>('gat_hide_chat', { p_token: token, p_conversation: conv }),
  forgetMe: (token: string) => rpc<boolean>('gat_forget_me', { p_token: token }),
  uploadTicket: (token: string, bucket: 'gat-img' | 'gat-voice', ext: string) => rpc<string>('gat_upload_ticket', { p_token: token, p_bucket: bucket, p_ext: ext }),
  unsend: (token: string, msg: string) => rpc<Message>('gat_unsend', { p_token: token, p_msg: msg }),
  openOnce: (token: string, msg: string) => rpc<Message>('gat_open_once', { p_token: token, p_msg: msg }),
  clear: (token: string, conv: string, both: boolean) => rpc<Conversation>('gat_clear', { p_token: token, p_conversation: conv, p_both: both }),
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
