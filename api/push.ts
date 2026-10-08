import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'

// Called by the DB (pg_net) after a message insert: POST { message_id } with header x-gat-secret.
// Flow: gat_push_claim -> web-push to each subscription -> gat_push_prune for 404/410.

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://afxnqxxntxfawcgxmyac.supabase.co').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'
const VAPID_PUBLIC =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BJg6GPhZEyOprJNso1yn69QiozHlQOSJaTi1nK69MPieD6PkWsht3kZTCqhvrBk5M-ChP2FmE399W8X2y4266hU'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const SECRET = process.env.GAT_PUSH_SECRET || ''

type Sub = { endpoint: string; p256dh: string; auth: string }
type Claim = { send: boolean; title?: string; body?: string; url?: string; tag?: string; subs?: Sub[] }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${fn} ${r.status} ${text.slice(0, 200)}`)
  return (text ? JSON.parse(text) : null) as T
}

function readBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body as unknown
  if (!b) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'))
    } catch {
      return {}
    }
  }
  return b as Record<string, unknown>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const header = req.headers['x-gat-secret']
  const secret = Array.isArray(header) ? header[0] : header
  if (!SECRET || secret !== SECRET) return res.status(401).json({ error: 'unauthorized' })

  const body = readBody(req)
  const messageId = typeof body.message_id === 'string' ? body.message_id : ''
  if (!UUID_RE.test(messageId)) return res.status(400).json({ error: 'message_id' })
  if (!VAPID_PRIVATE) return res.status(500).json({ error: 'vapid_not_configured' })

  let claim: Claim
  try {
    claim = await rpc<Claim>('gat_push_claim', { p_secret: SECRET, p_message: messageId })
  } catch (e) {
    return res.status(502).json({ error: 'claim_failed', detail: e instanceof Error ? e.message : String(e) })
  }
  if (!claim || !claim.send) return res.status(200).json({ sent: 0, skipped: true })

  webpush.setVapidDetails('https://goofyahhtalk.vercel.app', VAPID_PUBLIC, VAPID_PRIVATE)
  const payload = JSON.stringify({
    title: claim.title || 'GoofyAhhTalk',
    body: claim.body || '',
    url: claim.url || '/',
    tag: claim.tag || undefined,
  })
  const subs = Array.isArray(claim.subs) ? claim.subs : []
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 3600,
        urgency: 'high',
      }),
    ),
  )
  const gone: string[] = []
  let sent = 0
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent++
    else {
      failed++
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode
      if (code === 404 || code === 410) gone.push(subs[i].endpoint)
    }
  })
  let pruned = 0
  if (gone.length) {
    try {
      await rpc('gat_push_prune', { p_secret: SECRET, p_endpoints: gone })
      pruned = gone.length
    } catch {
      /* ignore */
    }
  }
  return res.status(200).json({ sent, failed, pruned })
}
