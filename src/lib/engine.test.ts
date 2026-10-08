// Engine behaviour against fake realtime channels and a fake PostgREST.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Handler = { type: string; event: string; cb: (p: unknown) => void }
class FakeChannel {
  handlers: Handler[] = []
  state = 'joined'
  presence: Record<string, Array<Record<string, unknown>>> = {}
  sent: Array<{ event: string; payload: unknown }> = []
  tracked: unknown = null
  constructor(public topic: string) {}
  on(type: string, filter: { event: string }, cb: (p: unknown) => void) {
    this.handlers.push({ type, event: filter.event, cb })
    return this
  }
  subscribe(cb?: (s: string) => void) {
    cb?.('SUBSCRIBED')
    return this
  }
  track(meta: unknown) {
    this.tracked = meta
    return Promise.resolve('ok')
  }
  untrack() {
    this.tracked = null
    return Promise.resolve('ok')
  }
  presenceState() {
    return this.presence
  }
  send(m: { event: string; payload: unknown }) {
    this.sent.push({ event: m.event, payload: m.payload })
    return Promise.resolve('ok')
  }
  emit(event: string, payload: unknown) {
    for (const h of this.handlers) if (h.type === 'broadcast' && h.event === event) h.cb({ type: 'broadcast', event, payload })
  }
  sync() {
    for (const h of this.handlers) if (h.type === 'presence' && h.event === 'sync') h.cb(undefined)
  }
}

const channels = new Map<string, FakeChannel>()
vi.mock('./realtime', () => ({
  getRealtime: () => ({}),
  onSocket: () => () => {},
  channel: (topic: string) => {
    let c = channels.get(topic)
    if (!c) {
      c = new FakeChannel(topic)
      channels.set(topic, c)
    }
    return c
  },
  canPush: (ch: FakeChannel | null) => !!ch && ch.state === 'joined',
  removeChannel: async (ch: FakeChannel) => {
    channels.delete(ch.topic)
  },
  reconnectNow: () => {},
  isSocketOpen: () => true,
}))

const ME = { id: 'me-1', username: 'zzqa_me', gender: 'm', last_seen_at: '2026-10-08T00:00:00Z', inbox: 'inbox-1' }
const PEER = { id: 'p-1', username: 'Sam', gender: 'f', last_seen_at: '2026-10-08T00:00:00Z' }
const CONV = {
  id: 'c-1',
  topic: 'topic-1',
  theme: 'goofy',
  theme_by: null,
  theme_at: null,
  created_at: '2026-10-08T00:00:00Z',
  last_message_at: null,
  peer: PEER,
  my_last_read_at: '1970-01-01T00:00:00Z',
  peer_last_read_at: '1970-01-01T00:00:00Z',
  muted: false,
  unread: 0,
  last_message: null,
}

const calls: Array<{ fn: string; body: Record<string, unknown> }> = []
let failSend = false
let failTheme = false
const reply = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status })

async function fakeFetch(url: string, init: RequestInit) {
  const fn = url.split('/rpc/')[1]
  const body = JSON.parse(String(init.body || '{}'))
  calls.push({ fn, body })
  switch (fn) {
    case 'gat_join':
      return reply({ token: 'tok_abcdefghijklmnopqrstuvwxyz0123456789ABCD', me: ME })
    case 'gat_conversations':
      return reply([])
    case 'gat_heartbeat':
      return reply(null, 204)
    case 'gat_profiles':
      return reply((body.p_ids as string[]).filter((id) => id === PEER.id).map(() => PEER))
    case 'gat_open':
      return reply(CONV)
    case 'gat_lookup':
      return reply({ code: 'P0001', message: 'not_found' }, 400)
    case 'gat_messages':
      return reply([])
    case 'gat_read':
      return reply({ at: new Date(Date.now() + 5).toISOString() })
    case 'gat_send':
      if (failSend) throw new TypeError('Failed to fetch')
      return reply({ id: body.p_id, conversation_id: body.p_conversation, sender_id: ME.id, kind: 'text', body: body.p_body, created_at: new Date(Date.now() - 1000).toISOString() })
    case 'gat_theme':
      if (failTheme) return reply({ code: 'P0001', message: 'theme_invalid' }, 400)
      return reply({ ...CONV, theme: body.p_theme, theme_by: ME.id, theme_at: new Date().toISOString() })
    case 'gat_mute':
      return reply({ muted: body.p_muted })
    default:
      return reply({ code: 'PGRST202', message: 'missing ' + fn }, 404)
  }
}

let E: typeof import('./engine')
let S: typeof import('./store')
const st = () => S.useStore.getState()
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-10-08T12:00:00Z'))
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  E = await import('./engine')
  S = await import('./store')
})
afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('engine', () => {
  it('boots to onboarding and joins the lobby read only', async () => {
    E.boot()
    expect(st().status).toBe('onboarding')
    expect(channels.has('gat:lobby')).toBe(true)
  })

  it('join -> ready, inbox subscribed, presence tracked', async () => {
    await E.join('zzqa_me', 'm')
    expect(st().status).toBe('ready')
    expect(st().me?.id).toBe(ME.id)
    expect(channels.has('gat:u:inbox-1')).toBe(true)
    expect((channels.get('gat:lobby')!.tracked as { id: string }).id).toBe(ME.id)
  })

  it('presence -> online (excluding me), verified in a batch, junk ids dropped', async () => {
    const lobby = channels.get('gat:lobby')!
    lobby.presence = {
      a: [{ id: PEER.id, username: 'fake', gender: 'm', since: '2026-10-08T11:00:00Z', away: false }],
      b: [{ id: ME.id, username: ME.username, gender: 'm', since: '2026-10-08T11:00:00Z', away: false }],
      c: [{ id: 'ghost', username: 'ghost', gender: 'f', since: '2026-10-08T11:00:00Z', away: false }],
    }
    lobby.sync()
    expect(Object.keys(st().online).sort()).toEqual(['ghost', PEER.id])
    await tick(200)
    expect(calls.filter((c) => c.fn === 'gat_profiles')).toHaveLength(1)
    expect(Object.keys(st().online)).toEqual([PEER.id])
    expect(st().online[PEER.id].username).toBe('Sam') // verified data wins over the meta
  })

  it('resolveChat by username opens the conversation and subscribes its topic', async () => {
    const conv = await E.resolveChat('sam')
    expect(conv?.id).toBe(CONV.id)
    expect(st().convByPeer[PEER.id]).toBe(CONV.id)
    expect(st().resolve['sam'].status).toBe('ready')
    expect(channels.has('gat:c:topic-1')).toBe(true)
    expect(st().opened[CONV.id]).toBe(true)
    const nf = await E.resolveChat('nobody_here')
    expect(nf).toBeNull()
    expect(st().resolve['nobody_here'].status).toBe('not_found')
  })

  it('peer broadcast msg: instant insert, unread, toast; strangers ignored', async () => {
    const ch = channels.get('gat:c:topic-1')!
    ch.emit('msg', { id: 'm-1', conversation_id: CONV.id, sender_id: PEER.id, kind: 'text', body: 'yo', created_at: '2020-01-01T00:00:00Z' })
    ch.emit('msg', { id: 'm-x', conversation_id: CONV.id, sender_id: 'stranger', kind: 'text', body: 'spoof', created_at: '2020-01-01T00:00:00Z' })
    expect(st().messages[CONV.id].map((m) => m.id)).toEqual(['m-1'])
    expect(st().conversations[CONV.id].unread).toBe(1)
    expect(st().toasts.map((t) => t.id)).toEqual(['m-1'])
    expect(E.isUnconfirmed('m-1')).toBe(true)
  })

  it('DB msg echo replaces the preview without double counting', async () => {
    const inbox = channels.get('gat:u:inbox-1')!
    const server = { id: 'm-1', conversation_id: CONV.id, sender_id: PEER.id, kind: 'text', body: 'yo', created_at: '2026-10-08T11:59:59.123456+00:00' }
    inbox.emit('msg', { message: server, conversation: { ...CONV, unread: 1, last_message: server, last_message_at: server.created_at } })
    expect(st().messages[CONV.id]).toHaveLength(1)
    expect(st().messages[CONV.id][0].created_at).toBe(server.created_at)
    expect(st().conversations[CONV.id].unread).toBe(1)
    expect(st().toasts).toHaveLength(1)
    expect(E.isUnconfirmed('m-1')).toBe(false)
  })

  it('toast auto expires after 4s', async () => {
    await tick(4100)
    expect(st().toasts).toHaveLength(0)
  })

  it('typing on/off and expiry; only from the peer', async () => {
    const ch = channels.get('gat:c:topic-1')!
    ch.emit('typing', { user_id: 'stranger', on: true })
    expect(st().typing[CONV.id]).toBeUndefined()
    ch.emit('typing', { user_id: PEER.id, on: true })
    expect(st().typing[CONV.id]).toBeGreaterThan(0)
    ch.emit('typing', { user_id: PEER.id, on: false })
    expect(st().typing[CONV.id]).toBeUndefined()
    ch.emit('typing', { user_id: PEER.id, on: true })
    await tick(6100)
    expect(st().typing[CONV.id]).toBeUndefined()
  })

  it('setActiveConv marks read (debounced) and zeroes unread', async () => {
    const before = calls.filter((c) => c.fn === 'gat_read').length
    E.setActiveConv(CONV.id)
    expect(st().activeConv).toBe(CONV.id)
    expect(st().conversations[CONV.id].unread).toBe(0)
    await tick(300)
    expect(calls.filter((c) => c.fn === 'gat_read').length).toBe(before + 1)
  })

  it('new peer message into the active chat: no toast, auto read', async () => {
    const before = calls.filter((c) => c.fn === 'gat_read').length
    channels.get('gat:c:topic-1')!.emit('msg', { id: 'm-2', conversation_id: CONV.id, sender_id: PEER.id, kind: 'text', body: 'u there', created_at: '' })
    expect(st().toasts).toHaveLength(0)
    expect(st().conversations[CONV.id].unread).toBe(0)
    await tick(300)
    expect(calls.filter((c) => c.fn === 'gat_read').length).toBe(before + 1)
  })

  it('setTyping throttles on:true to 2s and sends off after 4s idle', async () => {
    const ch = channels.get('gat:c:topic-1')!
    ch.sent = []
    E.setTyping(CONV.id, true)
    E.setTyping(CONV.id, true)
    await tick(1000)
    E.setTyping(CONV.id, true)
    expect(ch.sent.filter((s) => s.event === 'typing')).toHaveLength(1)
    await tick(1100)
    E.setTyping(CONV.id, true)
    expect(ch.sent.filter((s) => s.event === 'typing')).toHaveLength(2)
    await tick(4100)
    const last = ch.sent[ch.sent.length - 1]
    expect(last).toEqual({ event: 'typing', payload: { user_id: ME.id, on: false } })
  })

  it('sendMessage: optimistic + broadcast + server copy replaces it', async () => {
    const ch = channels.get('gat:c:topic-1')!
    ch.sent = []
    const id = E.sendMessage(CONV.id, '  hello  ')!
    const list = st().messages[CONV.id]
    expect(list[list.length - 1]).toMatchObject({ id, body: 'hello', sender_id: ME.id })
    expect(st().pending[id]).toBe('sending')
    expect(ch.sent.some((s) => s.event === 'msg' && (s.payload as { id: string }).id === id)).toBe(true)
    await tick(10)
    expect(st().pending[id]).toBeUndefined()
    expect(st().conversations[CONV.id].last_message?.id).toBe(id)
    // server timestamp is 1s earlier than the optimistic one: list re-sorted, still deduped
    expect(st().messages[CONV.id].filter((m) => m.id === id)).toHaveLength(1)
  })

  it('send retries x3 then failed; retry() delivers with the same id', async () => {
    failSend = true
    const id = E.sendMessage(CONV.id, 'flaky')!
    await tick(0)
    expect(st().pending[id]).toBe('sending')
    await tick(500 + 1500 + 4000 + 100)
    expect(st().pending[id]).toBe('failed')
    const tries = calls.filter((c) => c.fn === 'gat_send' && c.body.p_id === id).length
    expect(tries).toBe(4)
    failSend = false
    E.retry(id)
    await tick(10)
    expect(st().pending[id]).toBeUndefined()
  })

  it('read + theme events from the inbox', async () => {
    const inbox = channels.get('gat:u:inbox-1')!
    inbox.emit('read', { conversation_id: CONV.id, user_id: PEER.id, at: '2026-10-08T12:30:00Z' })
    expect(st().conversations[CONV.id].peer_last_read_at).toBe('2026-10-08T12:30:00Z')
    inbox.emit('theme', { conversation_id: CONV.id, theme: 'midnight', theme_by: PEER.id, theme_at: '2026-10-08T12:30:00Z' })
    expect(st().conversations[CONV.id].theme).toBe('midnight')
  })

  it('setTheme is optimistic and reverts on error', async () => {
    failTheme = true
    const p = E.setTheme(CONV.id, 'cherry')
    expect(st().conversations[CONV.id].theme).toBe('cherry')
    await p
    expect(st().conversations[CONV.id].theme).toBe('midnight')
    failTheme = false
    await E.setTheme(CONV.id, 'lagoon')
    expect(st().conversations[CONV.id].theme).toBe('lagoon')
  })

  it('setMuted is optimistic', async () => {
    const p = E.setMuted(CONV.id, true)
    expect(st().conversations[CONV.id].muted).toBe(true)
    await p
    expect(st().conversations[CONV.id].muted).toBe(true)
  })

  it('conv event for a brand new conversation subscribes its topic', async () => {
    channels.get('gat:u:inbox-1')!.emit('conv', { ...CONV, id: 'c-2', topic: 'topic-2', peer: { ...PEER, id: 'p-2', username: 'kim' } })
    expect(st().conversations['c-2']).toBeTruthy()
    expect(channels.has('gat:c:topic-2')).toBe(true)
  })

  it('heartbeat every 20s while visible', async () => {
    const before = calls.filter((c) => c.fn === 'gat_heartbeat').length
    await tick(20100)
    const hb = calls.filter((c) => c.fn === 'gat_heartbeat')
    expect(hb.length).toBe(before + 1)
    expect(hb[hb.length - 1].body).toMatchObject({ p_conv: CONV.id, p_visible: true })
  })

  it('logout returns to onboarding and drops channels', async () => {
    E.logout()
    expect(st().status).toBe('onboarding')
    expect(st().me).toBeNull()
    expect(channels.has('gat:u:inbox-1')).toBe(false)
    expect(channels.has('gat:c:topic-1')).toBe(false)
  })
})
