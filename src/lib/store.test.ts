import { describe, expect, it } from 'vitest'
import {
  countUnread,
  EMPTY_MESSAGES,
  mergeConversation,
  presenceToOnline,
  removeMessage,
  sortConversations,
  upsertMessages,
} from './store'
import type { Conversation, Message } from './types'

const msg = (id: string, at: string, extra: Partial<Message> = {}): Message => ({
  id,
  conversation_id: 'c1',
  sender_id: 'u1',
  kind: 'text',
  body: id,
  created_at: at,
  ...extra,
})

const conv = (extra: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  topic: 't1',
  theme: 'goofy',
  theme_by: null,
  theme_at: null,
  created_at: '2026-01-01T00:00:00Z',
  last_message_at: null,
  peer: { id: 'p1', username: 'sam', gender: 'f', last_seen_at: '2026-01-01T00:00:00Z' },
  my_last_read_at: '1970-01-01T00:00:00Z',
  peer_last_read_at: '1970-01-01T00:00:00Z',
  muted: false,
  unread: 0,
  last_message: null,
  ...extra,
})

describe('upsertMessages', () => {
  it('appends and keeps ascending order', () => {
    const a = msg('a', '2026-01-01T00:00:01Z')
    const b = msg('b', '2026-01-01T00:00:02Z')
    const c = msg('c', '2026-01-01T00:00:00Z')
    const out = upsertMessages([a], [b, c])
    expect(out.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('dedupes by id', () => {
    const a = msg('a', '2026-01-01T00:00:01Z')
    const out = upsertMessages([a], [a, { ...a }])
    expect(out).toHaveLength(1)
  })

  it('returns the same reference when nothing changed', () => {
    const list = [msg('a', '2026-01-01T00:00:01Z')]
    expect(upsertMessages(list, [{ ...list[0] }])).toBe(list)
    expect(upsertMessages(list, [])).toBe(list)
  })

  it('replaces optimistic copies with server copies and re-sorts', () => {
    const optimistic = msg('x', '2026-01-01T00:00:09Z')
    const other = msg('y', '2026-01-01T00:00:05Z')
    const server = msg('x', '2026-01-01T00:00:03.123456+00:00')
    const out = upsertMessages([other, optimistic], [server])
    expect(out.map((m) => m.id)).toEqual(['x', 'y'])
    expect(out[0]).toBe(server)
  })

  it('non authoritative merge never overwrites an existing copy', () => {
    const server = msg('x', '2026-01-01T00:00:03Z')
    const preview = msg('x', '2026-01-01T00:00:04Z')
    const list = [server]
    expect(upsertMessages(list, [preview], { authoritative: false })).toBe(list)
    const fresh = upsertMessages(list, [msg('z', '2026-01-01T00:00:05Z')], { authoritative: false })
    expect(fresh.map((m) => m.id)).toEqual(['x', 'z'])
  })

  it('handles undefined base lists', () => {
    expect(upsertMessages(undefined, [])).toBe(EMPTY_MESSAGES)
    expect(upsertMessages(undefined, [msg('a', '2026-01-01T00:00:00Z')])).toHaveLength(1)
  })

  it('breaks timestamp ties by id', () => {
    const t = '2026-01-01T00:00:00Z'
    expect(upsertMessages([], [msg('b', t), msg('a', t)]).map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('removeMessage / countUnread', () => {
  it('removes by id', () => {
    const list = [msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-01T00:00:01Z')]
    expect(removeMessage(list, 'a').map((m) => m.id)).toEqual(['b'])
    expect(removeMessage(list, 'nope')).toBe(list)
  })
  it('counts peer messages after the read marker', () => {
    const list = [
      msg('a', '2026-01-01T00:00:00Z', { sender_id: 'p1' }),
      msg('b', '2026-01-01T00:00:01Z', { sender_id: 'me' }),
      msg('c', '2026-01-01T00:00:02Z', { sender_id: 'p1' }),
      msg('d', '2026-01-01T00:00:03Z', { sender_id: 'p1' }),
    ]
    expect(countUnread(list, 'p1', '2026-01-01T00:00:00Z')).toBe(2)
    expect(countUnread(list, 'p1', '1970-01-01T00:00:00Z')).toBe(3)
    expect(countUnread(list, 'p1', '2026-01-01T00:00:05Z')).toBe(0)
  })
})

describe('mergeConversation', () => {
  it('returns prev when equal', () => {
    const a = conv()
    expect(mergeConversation(a, conv({ peer: a.peer }))).toBe(a)
  })
  it('never moves read markers backwards', () => {
    const a = conv({ my_last_read_at: '2026-01-02T00:00:00Z', peer_last_read_at: '2026-01-03T00:00:00Z' })
    const b = conv({ my_last_read_at: '2026-01-01T00:00:00Z', peer_last_read_at: '2026-01-04T00:00:00Z' })
    const m = mergeConversation(a, b)
    expect(m.my_last_read_at).toBe('2026-01-02T00:00:00Z')
    expect(m.peer_last_read_at).toBe('2026-01-04T00:00:00Z')
  })
  it('keeps a newer optimistic theme over an older snapshot', () => {
    const a = conv({ theme: 'cherry', theme_at: '2026-01-05T00:00:00Z' })
    const b = conv({ theme: 'goofy', theme_at: '2026-01-04T00:00:00Z' })
    expect(mergeConversation(a, b).theme).toBe('cherry')
    expect(mergeConversation(b, a).theme).toBe('cherry')
  })
  it('keeps the newest last_message', () => {
    const newer = msg('n', '2026-01-05T00:00:00Z')
    const older = msg('o', '2026-01-04T00:00:00Z')
    expect(mergeConversation(conv({ last_message: newer }), conv({ last_message: older })).last_message).toBe(newer)
    expect(mergeConversation(conv({ last_message: older }), conv({ last_message: newer })).last_message).toBe(newer)
  })
})

describe('sortConversations', () => {
  it('orders by latest activity', () => {
    const a = conv({ id: 'a', created_at: '2026-01-01T00:00:00Z', last_message_at: '2026-01-03T00:00:00Z' })
    const b = conv({ id: 'b', created_at: '2026-01-04T00:00:00Z' })
    const c = conv({ id: 'c', created_at: '2026-01-01T00:00:00Z', last_message_at: '2026-01-02T00:00:00Z' })
    expect(sortConversations([a, b, c]).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('presenceToOnline', () => {
  const meta = (id: string, extra: Record<string, unknown> = {}) => ({ id, username: id, gender: 'm', since: '2026-01-01T00:00:00Z', away: false, ...extra })
  it('excludes me and rejected ids and merges tabs', () => {
    const state = {
      k1: [meta('a', { away: true, since: '2026-01-01T00:00:05Z' })],
      k2: [meta('a', { away: false, since: '2026-01-01T00:00:01Z' })],
      k3: [meta('me')],
      k4: [meta('bad')],
    }
    const out = presenceToOnline(state, {}, { meId: 'me', rejected: new Set(['bad']) })
    expect(Object.keys(out)).toEqual(['a'])
    expect(out.a.away).toBe(false)
    expect(out.a.since).toBe('2026-01-01T00:00:01Z')
  })
  it('uses verified profile data over metas and keeps references', () => {
    const state = { k: [meta('a', { username: 'fake', gender: 'f' })] }
    const profiles = { a: { id: 'a', username: 'real', gender: 'm' as const, last_seen_at: '' } }
    const first = presenceToOnline(state, {}, { profiles })
    expect(first.a.username).toBe('real')
    expect(first.a.gender).toBe('m')
    expect(presenceToOnline(state, first, { profiles })).toBe(first)
  })
  it('away only when every tab is away', () => {
    const out = presenceToOnline({ k1: [meta('a', { away: true })], k2: [meta('a', { away: true })] }, {})
    expect(out.a.away).toBe(true)
  })
})
