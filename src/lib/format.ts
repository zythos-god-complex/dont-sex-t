// Time and text formatting. Lowercase, short. Never uses em or en dashes.
import type { Message } from './types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function toMs(t: string | number | Date | null | undefined): number {
  if (t == null) return NaN
  if (typeof t === 'number') return t
  if (t instanceof Date) return t.getTime()
  return Date.parse(t)
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Calendar days between two instants in local time (b minus a). */
function dayDiff(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY)
}

/** "9:41 pm" */
export function clockTime(t: string | number | Date): string {
  const d = new Date(toMs(t))
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m < 10 ? '0' : ''}${m} ${ap}`
}

/** "12 mar" (adds the year when it is not the current year: "12 mar 2024") */
export function shortDate(t: string | number | Date, now: number = Date.now()): string {
  const d = new Date(toMs(t))
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/**
 * Inbox style relative time: "now", "5m", "2h", "tue", "12 mar".
 * now: under a minute. m: under an hour. h: under 24h and same or previous day. weekday: within 6 days.
 */
export function relTime(t: string | number | Date | null | undefined, now: number = Date.now()): string {
  const ms = toMs(t)
  if (!Number.isFinite(ms)) return ''
  const diff = now - ms
  if (diff < MIN) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (dayDiff(ms, now) < 7) return WEEKDAYS[new Date(ms).getDay()]
  return shortDate(ms, now)
}

/** Compact duration: "now" (< 1 min), "4m", "2h", "3d", "2w", "5mo", "1y". */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < MIN) return 'now'
  if (ms < HOUR) return `${Math.floor(ms / MIN)}m`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d`
  if (ms < 30 * DAY) return `${Math.floor(ms / (7 * DAY))}w`
  if (ms < 365 * DAY) return `${Math.floor(ms / (30 * DAY))}mo`
  return `${Math.floor(ms / (365 * DAY))}y`
}

/** Elapsed time since t, never "now": "1m", "5m", "2h", "3d"... */
export function ago(t: string | number | Date | null | undefined, now: number = Date.now()): string {
  const ms = toMs(t)
  if (!Number.isFinite(ms)) return ''
  return duration(Math.max(MIN, now - ms))
}

/** "active 5m ago" (minimum 1m). Empty string when unknown. */
export function activeAgo(t: string | number | Date | null | undefined, now: number = Date.now()): string {
  const a = ago(t, now)
  return a ? `active ${a} ago` : ''
}

/** Lobby card meta: "here now", "here 4m", "here 2h". */
export function hereFor(since: string | number | Date | null | undefined, now: number = Date.now()): string {
  const ms = toMs(since)
  if (!Number.isFinite(ms)) return 'here now'
  return `here ${duration(now - ms)}`
}

/**
 * Chat day separator: "today 9:41 pm", "yesterday 9:41 pm", "tue 9:41 pm", "12 mar 9:41 pm".
 */
export function daySeparator(t: string | number | Date, now: number = Date.now()): string {
  const ms = toMs(t)
  if (!Number.isFinite(ms)) return ''
  const dd = dayDiff(ms, now)
  const time = clockTime(ms)
  if (dd <= 0) return `today ${time}`
  if (dd === 1) return `yesterday ${time}`
  if (dd < 7) return `${WEEKDAYS[new Date(ms).getDay()]} ${time}`
  return `${shortDate(ms, now)} ${time}`
}

/** True when a time separator should be drawn between prev and cur (gap > 30 min, or first message). */
export function needsSeparator(prev: Pick<Message, 'created_at'> | null | undefined, cur: Pick<Message, 'created_at'>): boolean {
  if (!prev) return true
  return toMs(cur.created_at) - toMs(prev.created_at) > 30 * MIN
}

/** True when cur continues prev's bubble group (same sender, both text, within 3 minutes). */
export function sameGroup(
  prev: Pick<Message, 'sender_id' | 'created_at' | 'kind'> | null | undefined,
  cur: Pick<Message, 'sender_id' | 'created_at' | 'kind'> | null | undefined,
): boolean {
  if (!prev || !cur) return false
  if (prev.kind !== 'text' || cur.kind !== 'text') return false
  if (prev.sender_id !== cur.sender_id) return false
  return Math.abs(toMs(cur.created_at) - toMs(prev.created_at)) <= 3 * MIN
}

/** Inbox preview: "you: lol ok", "changed the theme", "you changed the theme". */
export function messagePreview(m: Pick<Message, 'sender_id' | 'kind' | 'body'> | null | undefined, meId: string | null | undefined): string {
  if (!m) return ''
  const mine = !!meId && m.sender_id === meId
  if (m.kind === 'theme') return mine ? 'you changed the theme' : 'changed the theme'
  const body = /^\[\[voice:/.test(m.body) ? 'voice message' : /^\[\[img[:-]/.test(m.body) ? 'photo' : m.body === '[[unsent]]' ? 'message unsent' : /^\[\[sticker:[a-z_]+\]\]$/.test(m.body) ? 'sent a sticker' : m.body.replace(/\s+/g, ' ').trim()
  return mine ? `you: ${body}` : body
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const NON_EMOJI_RE = /[^\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\p{Emoji_Component}‍️︎⃣\s]/u

/** Number of emoji graphemes if the text is made only of 1 to 3 emoji, else 0. */
export function emojiOnlyCount(text: string): number {
  const t = text.trim()
  if (!t || t.length > 64) return 0
  if (NON_EMOJI_RE.test(t)) return 0
  // digits/#/* are Emoji_Component; reject unless they form a keycap
  if (/[0-9#*](?!️?⃣)/u.test(t)) return 0
  let n = 0
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  if (Seg) {
    for (const { segment } of new Seg(undefined, { granularity: 'grapheme' }).segment(t)) {
      if (/^\s+$/.test(segment)) continue
      if (!EMOJI_RE.test(segment) && !/⃣/.test(segment)) return 0
      n++
      if (n > 3) return 0
    }
  } else {
    const m = t.match(/\p{Extended_Pictographic}/gu)
    n = m ? m.length : 0
  }
  return n >= 1 && n <= 3 ? n : 0
}

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]!?])/gi

/** Splits text into plain and link parts for auto linking. */
export function linkify(text: string): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: text.slice(last, i) })
    const raw = m[0]
    out.push({ text: raw, href: raw.startsWith('http') ? raw : `https://${raw}` })
    last = i + raw.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** Badge text: 1..99, then "99+". */
export function badgeCount(n: number): string {
  return n > 99 ? '99+' : String(n)
}
