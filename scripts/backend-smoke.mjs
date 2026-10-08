// GoofyAhhTalk backend smoke test (Node 22).
//
//   set -a && . path/to/secrets.env && set +a && node scripts/backend-smoke.mjs
//
// Talks to the real Supabase project through PostgREST (publishable key) and Realtime,
// exactly like the browser client does. Creates 3 users named zzqa_*; remove them afterwards with
//   delete from gat_users where username like 'zzqa\_%';
// GAT_PUSH_SECRET (env) is needed for the gat_push_claim / gat_push_prune checks.

import { readFileSync } from 'node:fs'
import { RealtimeClient } from '@supabase/realtime-js'

function readDotEnv() {
  try {
    const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    return Object.fromEntries(
      txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
  } catch {
    return {}
  }
}

const dot = readDotEnv()
const URL_ = process.env.VITE_SUPABASE_URL || dot.VITE_SUPABASE_URL || 'https://afxnqxxntxfawcgxmyac.supabase.co'
const KEY = process.env.VITE_SUPABASE_KEY || dot.VITE_SUPABASE_KEY || 'sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'
const SECRET = process.env.GAT_PUSH_SECRET || ''

// ---------------------------------------------------------------------------
// tiny harness
// ---------------------------------------------------------------------------

const results = []
const notes = []
function record(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail ?? '') })
}
async function check(name, fn) {
  try {
    const r = await fn()
    if (r === true || r === undefined) record(name, true)
    else if (r === false) record(name, false, 'assertion failed')
    else record(name, !!r.ok, r.detail)
  } catch (e) {
    record(name, false, e?.message || String(e))
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (n = 8) => Math.random().toString(36).slice(2, 2 + n).padEnd(n, '0')
const uuid = () => crypto.randomUUID()

async function rpc(fn, args = {}) {
  const t0 = performance.now()
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  const ms = Math.round(performance.now() - t0)
  if (!res.ok) {
    const code = data && typeof data === 'object' ? data.message : text
    const err = new Error(`${fn}: HTTP ${res.status} ${code}`)
    err.status = res.status
    err.code = code
    err.pgrst = data && data.code
    throw err
  }
  return { status: res.status, data, ms }
}
async function call(fn, args) {
  return (await rpc(fn, args)).data
}
async function expectErr(fn, args, code) {
  try {
    const r = await rpc(fn, args)
    return { ok: false, detail: `expected ${code}, got HTTP ${r.status} ${JSON.stringify(r.data)?.slice(0, 80)}` }
  } catch (e) {
    if (e.pgrst === 'PGRST202') return { ok: false, detail: `${fn} is not deployed (PGRST202)` }
    return { ok: e.code === code && e.status === 400, detail: `HTTP ${e.status} ${e.code}` }
  }
}

// ---------------------------------------------------------------------------
// realtime inbox listeners
// ---------------------------------------------------------------------------

const rt = new RealtimeClient(`${URL_}/realtime/v1`, { params: { apikey: KEY } })
const inboxes = {}

async function listen(label, inbox) {
  const events = []
  // replication_ready: DB-originated broadcasts (realtime.send) only flow once the tenant's
  // replication connection is up; it is started lazily, so a cold socket can miss early events.
  const ch = rt.channel(`gat:u:${inbox}`, {
    config: { private: false, broadcast: { self: false, replication_ready: true } },
  })
  ch.on('broadcast', { event: '*' }, (m) => events.push({ event: m.event, payload: m.payload, at: Date.now() }))
  const t0 = Date.now()
  const ready = new Promise((resolve) => {
    ch.on('system', {}, (p) => {
      if (p?.status === 'ok' && /replication/i.test(p?.message || '')) resolve(p)
    })
  })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} inbox subscribe timeout`)), 15000)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t)
        reject(new Error(`${label} inbox ${status} ${err?.message || ''}`))
      }
    })
  })
  const r = await Promise.race([ready, sleep(12000).then(() => null)])
  notes.push(`${label} inbox: replication ${r ? `ready after ${Date.now() - t0}ms` : 'ready signal not seen in 12s'}`)
  inboxes[label] = { ch, events }
  return events
}

async function waitEvent(label, pred, timeout = 8000) {
  const box = inboxes[label]
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const hit = box.events.find(pred)
    if (hit) return hit
    await sleep(25)
  }
  throw new Error(`${label}: event not received within ${timeout}ms`)
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

const PROFILE_KEYS = ['gender', 'id', 'last_seen_at', 'username'].join(',')
const CONV_KEYS = [
  'created_at', 'id', 'last_message', 'last_message_at', 'muted', 'my_last_read_at', 'peer',
  'peer_last_read_at', 'theme', 'theme_at', 'theme_by', 'topic', 'unread',
].join(',')
const MSG_KEYS = ['body', 'conversation_id', 'created_at', 'id', 'kind', 'sender_id'].join(',')
const keysOf = (o) => Object.keys(o || {}).sort().join(',')

const tag = rand(6)
const nameA = `zzqa_Al${tag}` // mixed case on purpose
const nameB = `zzqa_bo${tag}`
const nameC = `zzqa_cy${tag}`
let A, B, C // { token, me }
let conv // A perspective
const sentAt = {}

async function main() {
  console.log(`backend smoke against ${URL_}  (run tag ${tag})\n`)

  // ---- identity -----------------------------------------------------------
  await check('join: valid user A (case preserved, token base64url 43)', async () => {
    A = await call('gat_join', { p_username: nameA, p_gender: 'm' })
    assert(A.me.username === nameA, `username ${A.me.username}`)
    assert(/^[A-Za-z0-9_-]{43}$/.test(A.token), `token shape ${A.token}`)
    assert(keysOf(A.me) === [...PROFILE_KEYS.split(','), 'inbox'].sort().join(','), keysOf(A.me))
  })
  await check('join: valid users B and C', async () => {
    B = await call('gat_join', { p_username: nameB, p_gender: 'f' })
    C = await call('gat_join', { p_username: nameC, p_gender: 'f' })
    assert(B.me.gender === 'f' && C.me.id, 'bad B/C')
  })
  await check('join: invalid username (too short) -> username_invalid', () =>
    expectErr('gat_join', { p_username: 'zz', p_gender: 'm' }, 'username_invalid'))
  await check('join: invalid username (bad chars) -> username_invalid', () =>
    expectErr('gat_join', { p_username: 'zzqa bad!', p_gender: 'm' }, 'username_invalid'))
  await check('join: invalid gender -> gender_invalid', () =>
    expectErr('gat_join', { p_username: `zzqa_g${tag}`, p_gender: 'x' }, 'gender_invalid'))
  await check('join: taken case-insensitively -> username_taken', () =>
    expectErr('gat_join', { p_username: nameA.toUpperCase(), p_gender: 'f' }, 'username_taken'))

  if (!A || !B || !C) throw new Error('cannot continue without users')

  await check('me: returns Me with inbox, touches last_seen_at', async () => {
    await sleep(50)
    const me = await call('gat_me', { p_token: A.token })
    assert(me.id === A.me.id && me.inbox === A.me.inbox, 'id/inbox mismatch')
    assert(new Date(me.last_seen_at) > new Date(A.me.last_seen_at), 'last_seen_at not touched')
  })
  await check('unauthorized: bad token -> unauthorized', () =>
    expectErr('gat_me', { p_token: 'nope' }, 'unauthorized'))
  await check('unauthorized: empty token on gat_conversations -> unauthorized', () =>
    expectErr('gat_conversations', { p_token: '' }, 'unauthorized'))

  await check('profiles: verifies ids, drops unknown, no inbox/token leak', async () => {
    const list = await call('gat_profiles', { p_token: A.token, p_ids: [B.me.id, C.me.id, uuid()] })
    assert(Array.isArray(list) && list.length === 2, `len ${list?.length}`)
    assert(list.every((p) => keysOf(p) === PROFILE_KEYS), keysOf(list[0]))
  })
  await check('lookup: case-insensitive', async () => {
    const p = await call('gat_lookup', { p_token: A.token, p_username: nameB.toUpperCase() })
    assert(p.id === B.me.id && p.username === nameB && keysOf(p) === PROFILE_KEYS, JSON.stringify(p))
  })
  await check('lookup: missing -> not_found', () =>
    expectErr('gat_lookup', { p_token: A.token, p_username: `zzqa_no${tag}` }, 'not_found'))

  // ---- realtime inboxes ---------------------------------------------------
  await check('realtime: subscribe both inbox topics', async () => {
    await listen('A', A.me.inbox)
    await listen('B', B.me.inbox)
  })

  // ---- open ---------------------------------------------------------------
  let tOpen = 0
  await check('open: create returns my-perspective Conversation', async () => {
    tOpen = Date.now()
    conv = await call('gat_open', { p_token: A.token, p_peer: B.me.id })
    assert(keysOf(conv) === CONV_KEYS, keysOf(conv))
    assert(conv.peer.id === B.me.id && keysOf(conv.peer) === PROFILE_KEYS, 'peer')
    assert(conv.theme === 'goofy' && conv.unread === 0 && conv.last_message === null && conv.muted === false, 'defaults')
    assert(new Date(conv.my_last_read_at).getTime() === 0, `my_last_read_at ${conv.my_last_read_at}`)
  })
  await check("open: peer receives 'conv' (peer perspective) on its inbox", async () => {
    const ev = await waitEvent('B', (e) => e.event === 'conv' && e.payload?.id === conv.id)
    assert(ev.payload.peer.id === A.me.id && ev.payload.topic === conv.topic, 'perspective')
    return { ok: true, detail: `${ev.at - tOpen}ms` }
  })
  await check('open: re-open returns the same conversation, no 2nd conv event', async () => {
    const again = await call('gat_open', { p_token: A.token, p_peer: B.me.id })
    const fromB = await call('gat_open', { p_token: B.token, p_peer: A.me.id })
    assert(again.id === conv.id && fromB.id === conv.id, 'different ids')
    assert(fromB.peer.id === A.me.id, 'B perspective')
    await sleep(600)
    const n = inboxes.B.events.filter((e) => e.event === 'conv').length
    assert(n === 1, `conv events ${n}`)
  })
  await check('open: self -> self_chat', () => expectErr('gat_open', { p_token: A.token, p_peer: A.me.id }, 'self_chat'))
  await check('open: unknown peer -> not_found', () => expectErr('gat_open', { p_token: A.token, p_peer: uuid() }, 'not_found'))

  // ---- send ---------------------------------------------------------------
  const id1 = uuid()
  let m1
  let tSend = 0
  await check('send: trims body, returns Message', async () => {
    tSend = Date.now()
    const r = await rpc('gat_send', { p_token: A.token, p_conversation: conv.id, p_id: id1, p_body: '  hello b  \n' })
    m1 = r.data
    assert(keysOf(m1) === MSG_KEYS, keysOf(m1))
    assert(m1.id === id1 && m1.body === 'hello b' && m1.kind === 'text' && m1.sender_id === A.me.id, JSON.stringify(m1))
    return { ok: true, detail: `${r.ms}ms` }
  })
  await check('send: idempotent on same id', async () => {
    const again = await call('gat_send', { p_token: A.token, p_conversation: conv.id, p_id: id1, p_body: 'different' })
    assert(again.id === id1 && again.created_at === m1.created_at && again.body === 'hello b', JSON.stringify(again))
    const page = await call('gat_messages', { p_token: A.token, p_conversation: conv.id })
    assert(page.filter((m) => m.id === id1).length === 1, 'duplicate row')
  })
  await check('send: empty body -> body_invalid', () =>
    expectErr('gat_send', { p_token: A.token, p_conversation: conv.id, p_id: uuid(), p_body: '   \n ' }, 'body_invalid'))
  await check('send: 2001 chars -> body_invalid', () =>
    expectErr('gat_send', { p_token: A.token, p_conversation: conv.id, p_id: uuid(), p_body: 'x'.repeat(2001) }, 'body_invalid'))
  await check('send: non-member -> forbidden', () =>
    expectErr('gat_send', { p_token: C.token, p_conversation: conv.id, p_id: uuid(), p_body: 'hi' }, 'forbidden'))

  await check("msg event: recipient inbox gets 'msg' (recipient perspective, unread 1)", async () => {
    const ev = await waitEvent('B', (e) => e.event === 'msg' && e.payload?.message?.id === id1)
    const c = ev.payload.conversation
    assert(keysOf(ev.payload.message) === MSG_KEYS, keysOf(ev.payload.message))
    assert(c.id === conv.id && c.peer.id === A.me.id, 'perspective')
    assert(c.unread === 1 && c.last_message?.id === id1 && c.last_message_at === m1.created_at, `unread ${c.unread}`)
    assert(c.peer_last_read_at === m1.created_at, `peer_last_read_at ${c.peer_last_read_at}`)
    return { ok: true, detail: `${ev.at - tSend}ms after send call` }
  })
  await check("msg event: sender inbox gets 'msg' (sender perspective, unread 0)", async () => {
    const ev = await waitEvent('A', (e) => e.event === 'msg' && e.payload?.message?.id === id1)
    const c = ev.payload.conversation
    assert(c.peer.id === B.me.id && c.unread === 0, 'perspective')
    assert(c.my_last_read_at === m1.created_at, `my_last_read_at ${c.my_last_read_at}`)
  })

  // ---- paging -------------------------------------------------------------
  await check('messages: newest first, p_before paging, limit clamp', async () => {
    for (let i = 0; i < 4; i++) {
      await call('gat_send', { p_token: i % 2 ? A.token : B.token, p_conversation: conv.id, p_id: uuid(), p_body: `m${i}` })
    }
    const p1 = await call('gat_messages', { p_token: B.token, p_conversation: conv.id, p_limit: 2 })
    assert(p1.length === 2 && p1[0].body === 'm3' && p1[1].body === 'm2', p1.map((m) => m.body).join(','))
    const p2 = await call('gat_messages', { p_token: B.token, p_conversation: conv.id, p_before: p1[1].created_at, p_limit: 2 })
    assert(p2.length === 2 && p2[0].body === 'm1' && p2[1].body === 'm0', p2.map((m) => m.body).join(','))
    const p3 = await call('gat_messages', { p_token: B.token, p_conversation: conv.id, p_before: p2[1].created_at, p_limit: 2 })
    assert(p3.length === 1 && p3[0].id === id1, p3.map((m) => m.body).join(','))
    const all = await call('gat_messages', { p_token: B.token, p_conversation: conv.id, p_limit: 0 })
    assert(all.length === 1, `limit 0 should clamp to 1, got ${all.length}`)
    const dflt = await call('gat_messages', { p_token: B.token, p_conversation: conv.id })
    assert(dflt.length === 5, `default page ${dflt.length}`)
  })
  await check('messages: non-member -> forbidden', () =>
    expectErr('gat_messages', { p_token: C.token, p_conversation: conv.id }, 'forbidden'))

  await check('conversations: list, unread from my perspective', async () => {
    const la = await call('gat_conversations', { p_token: A.token })
    const lb = await call('gat_conversations', { p_token: B.token })
    const lc = await call('gat_conversations', { p_token: C.token })
    assert(la.length === 1 && lb.length === 1 && lc.length === 0, 'lengths')
    // A sent id1,m1,m3 ; B sent m0,m2 (after A's last read? A's last message m3 is newest -> unread 0)
    assert(la[0].unread === 0, `A unread ${la[0].unread}`)
    assert(lb[0].unread >= 1 && lb[0].last_message.body === 'm3', `B unread ${lb[0].unread}`)
    assert(keysOf(la[0]) === CONV_KEYS, keysOf(la[0]))
  })

  // ---- read ---------------------------------------------------------------
  await check("read: sets last_read_at, 'read' event to both inboxes", async () => {
    const r = await call('gat_read', { p_token: B.token, p_conversation: conv.id })
    assert(r.at, 'no at')
    const ea = await waitEvent('A', (e) => e.event === 'read' && e.payload?.user_id === B.me.id)
    const eb = await waitEvent('B', (e) => e.event === 'read' && e.payload?.user_id === B.me.id)
    assert(ea.payload.conversation_id === conv.id && ea.payload.at === r.at && eb.payload.at === r.at, 'payload')
    const lb = await call('gat_conversations', { p_token: B.token })
    const la = await call('gat_conversations', { p_token: A.token })
    assert(lb[0].unread === 0 && lb[0].my_last_read_at === r.at, `B unread ${lb[0].unread}`)
    assert(la[0].peer_last_read_at === r.at, 'A sees peer_last_read_at')
    const r2 = await call('gat_read', { p_token: B.token, p_conversation: conv.id })
    assert(new Date(r2.at) >= new Date(r.at), 'moved backwards')
  })
  await check('read: non-member -> forbidden', () =>
    expectErr('gat_read', { p_token: C.token, p_conversation: conv.id }, 'forbidden'))

  // ---- theme --------------------------------------------------------------
  await check("theme: valid -> Conversation, 'theme' event, kind=theme msg to both", async () => {
    const c = await call('gat_theme', { p_token: A.token, p_conversation: conv.id, p_theme: 'cherry' })
    assert(c.theme === 'cherry' && c.theme_by === A.me.id && c.theme_at, JSON.stringify(c).slice(0, 120))
    assert(c.last_message?.kind === 'theme' && c.last_message.body === 'cherry', 'last_message')
    const et = await waitEvent('B', (e) => e.event === 'theme' && e.payload?.theme === 'cherry')
    assert(et.payload.conversation_id === conv.id && et.payload.theme_by === A.me.id && et.payload.theme_at === c.theme_at, 'theme payload')
    await waitEvent('A', (e) => e.event === 'theme' && e.payload?.theme === 'cherry')
    const mb = await waitEvent('B', (e) => e.event === 'msg' && e.payload?.message?.kind === 'theme')
    await waitEvent('A', (e) => e.event === 'msg' && e.payload?.message?.kind === 'theme')
    assert(mb.payload.message.body === 'cherry' && mb.payload.conversation.theme === 'cherry', 'theme msg')
  })
  await check('theme: invalid -> theme_invalid', () =>
    expectErr('gat_theme', { p_token: A.token, p_conversation: conv.id, p_theme: 'nope' }, 'theme_invalid'))

  // ---- mute + heartbeat ---------------------------------------------------
  await check('mute: on/off reflected in conversation', async () => {
    const on = await call('gat_mute', { p_token: B.token, p_conversation: conv.id, p_muted: true })
    assert(on.muted === true, 'on')
    const lb = await call('gat_conversations', { p_token: B.token })
    const la = await call('gat_conversations', { p_token: A.token })
    assert(lb[0].muted === true && la[0].muted === false, 'per-member')
    const off = await call('gat_mute', { p_token: B.token, p_conversation: conv.id, p_muted: false })
    assert(off.muted === false, 'off')
  })
  await check('mute: non-member -> forbidden', () =>
    expectErr('gat_mute', { p_token: C.token, p_conversation: conv.id, p_muted: true }, 'forbidden'))
  await check('heartbeat: visible + hidden', async () => {
    const r1 = await rpc('gat_heartbeat', { p_token: B.token, p_conv: conv.id, p_visible: true })
    const r2 = await rpc('gat_heartbeat', { p_token: B.token, p_visible: false })
    const r3 = await rpc('gat_heartbeat', { p_token: B.token })
    notes.push(`void RPCs answer HTTP ${r1.status} with body ${JSON.stringify(r1.data)}`)
    return { ok: true, detail: `HTTP ${r1.status}/${r2.status}/${r3.status}` }
  })
  await check('heartbeat: bad token -> unauthorized', () => expectErr('gat_heartbeat', { p_token: 'x' }, 'unauthorized'))

  // ---- push ---------------------------------------------------------------
  const ep1 = `https://zzqa.invalid/push/${tag}/1`
  const ep2 = `https://zzqa.invalid/push/${tag}/2`
  const sub = (token, endpoint) =>
    call('gat_push_subscribe', { p_token: token, p_endpoint: endpoint, p_p256dh: 'BPk' + tag, p_auth: 'au' + tag, p_ua: 'zzqa-smoke' })
  const sendFromA = (body) => call('gat_send', { p_token: A.token, p_conversation: conv.id, p_id: uuid(), p_body: body })
  const claim = (id, secret = SECRET) => call('gat_push_claim', { p_secret: secret, p_message: id })

  await check('push_subscribe: B registers an endpoint', async () => {
    await sub(B.token, ep1)
  })
  await check('push_subscribe: empty endpoint -> body_invalid', () =>
    expectErr('gat_push_subscribe', { p_token: B.token, p_endpoint: '', p_p256dh: 'x', p_auth: 'y' }, 'body_invalid'))

  const haveSecret = !!SECRET
  if (!haveSecret) notes.push('GAT_PUSH_SECRET not set: push_claim/push_prune success paths not exercised')

  await check('push_claim: wrong secret -> forbidden', async () => {
    const m = await sendFromA('secret check')
    return expectErr('gat_push_claim', { p_secret: 'wrong', p_message: m.id }, 'forbidden')
  })
  await check('push_claim: recipient inactive -> send true with subs', async () => {
    assert(haveSecret, 'GAT_PUSH_SECRET missing')
    await call('gat_heartbeat', { p_token: B.token, p_visible: false })
    const long = 'p'.repeat(200)
    const m = await sendFromA(long)
    sentAt.inactive = m
    const r = await claim(m.id)
    assert(r.send === true, JSON.stringify(r))
    assert(r.title === nameA && r.url === `/dm/${nameA}` && r.tag === conv.id && r.body === 'p'.repeat(140), JSON.stringify(r).slice(0, 160))
    assert(Array.isArray(r.subs) && r.subs.some((s) => s.endpoint === ep1 && s.p256dh && s.auth), 'subs')
  })
  await check('push_claim: second claim -> send false', async () => {
    assert(haveSecret && sentAt.inactive, 'precondition')
    const r = await claim(sentAt.inactive.id)
    assert(r.send === false, JSON.stringify(r))
  })
  await check('push_claim: active recipient -> send false', async () => {
    assert(haveSecret, 'GAT_PUSH_SECRET missing')
    await call('gat_heartbeat', { p_token: B.token, p_conv: null, p_visible: true })
    const m = await sendFromA('you there?')
    const r = await claim(m.id)
    assert(r.send === false, JSON.stringify(r))
    return { ok: true, detail: r.reason || '' }
  })
  await check('push_claim: muted recipient -> send false', async () => {
    assert(haveSecret, 'GAT_PUSH_SECRET missing')
    await call('gat_heartbeat', { p_token: B.token, p_visible: false })
    await call('gat_mute', { p_token: B.token, p_conversation: conv.id, p_muted: true })
    const m = await sendFromA('muted?')
    const r = await claim(m.id)
    await call('gat_mute', { p_token: B.token, p_conversation: conv.id, p_muted: false })
    assert(r.send === false, JSON.stringify(r))
    return { ok: true, detail: r.reason || '' }
  })
  await check('push_claim: theme message never pushes', async () => {
    assert(haveSecret, 'GAT_PUSH_SECRET missing')
    const c = await call('gat_theme', { p_token: A.token, p_conversation: conv.id, p_theme: 'midnight' })
    const r = await claim(c.last_message.id)
    assert(c.last_message.kind === 'theme' && r.send === false, JSON.stringify(r))
  })

  await check('push_unsubscribe: non-owner cannot remove, owner can', async () => {
    await call('gat_push_unsubscribe', { p_token: A.token, p_endpoint: ep1 })
    if (haveSecret) {
      const r = await claim((await sendFromA('still subscribed?')).id)
      assert(r.send === true && r.subs.some((s) => s.endpoint === ep1), `non-owner removed it: ${JSON.stringify(r)}`)
    }
    await call('gat_push_unsubscribe', { p_token: B.token, p_endpoint: ep1 })
    if (haveSecret) {
      const r = await claim((await sendFromA('gone?')).id)
      assert(r.send === false, `still pushing: ${JSON.stringify(r)}`)
    }
  })
  await check('push_prune: wrong secret -> forbidden', () =>
    expectErr('gat_push_prune', { p_secret: 'wrong', p_endpoints: [ep2] }, 'forbidden'))
  await check('push_prune: removes given endpoints', async () => {
    assert(haveSecret, 'GAT_PUSH_SECRET missing')
    await sub(B.token, ep2)
    const before = await claim((await sendFromA('before prune')).id)
    assert(before.send === true && before.subs.some((s) => s.endpoint === ep2), `setup: ${JSON.stringify(before)}`)
    await call('gat_push_prune', { p_secret: SECRET, p_endpoints: [ep2] })
    const after = await claim((await sendFromA('after prune')).id)
    assert(after.send === false, `still pushing: ${JSON.stringify(after)}`)
  })

  // ---- lockdown -----------------------------------------------------------
  for (const table of ['gat_users', 'gat_messages', 'gat_config', 'gat_push_subs']) {
    await check(`lockdown: anon GET /rest/v1/${table} returns no rows`, async () => {
      const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=5`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      })
      const body = await res.text()
      let rows = null
      try {
        rows = JSON.parse(body)
      } catch {}
      const leaked = Array.isArray(rows) && rows.length > 0
      return { ok: !leaked, detail: `HTTP ${res.status} ${body.slice(0, 70)}` }
    })
  }
  await check('lockdown: internal helper gat_auth not callable', async () => {
    try {
      await rpc('gat_auth', { p_token: A.token })
      return { ok: false, detail: 'gat_auth callable by anon' }
    } catch (e) {
      return { ok: true, detail: `HTTP ${e.status}` }
    }
  })
}

let fatal = null
try {
  await main()
} catch (e) {
  fatal = e
}
try {
  rt.disconnect()
} catch {}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const w = Math.max(...results.map((r) => r.name.length), 10)
console.log(`${'check'.padEnd(w)}  result  detail`)
console.log(`${'-'.repeat(w)}  ------  ${'-'.repeat(40)}`)
for (const r of results) console.log(`${r.name.padEnd(w)}  ${r.ok ? 'PASS  ' : 'FAIL  '}  ${r.detail}`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`)
for (const n of notes) console.log(`note: ${n}`)
if (fatal) console.log(`fatal: ${fatal.message}`)
console.log(`test users: ${nameA}, ${nameB}, ${nameC}  (cleanup: delete from gat_users where username like 'zzqa\\_%')`)
process.exit(failed || fatal ? 1 : 0)
