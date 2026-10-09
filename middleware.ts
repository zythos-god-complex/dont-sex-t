// Site gate. Runs on Vercel before anything is served. The password lives only in the
// SITE_PASSWORD env var; the browser gets an HttpOnly cookie holding a hash, never the password.

export const config = {
  // the database calls /api/push directly, it can't log in
  matcher: ['/((?!api/push|api/manifest|icons/|favicon.svg).*)'],
}

const COOKIE = 'gat_gate'
// accounts that walk straight in (their login cookie is checked against the database)
const ALLOW = (process.env.SITE_ALLOW || 'ember,admin').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://afxnqxxntxfawcgxmyac.supabase.co').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'

/** Username behind a GoofyAhhTalk login token, or null (bad, banned or unreachable). */
async function whoIs(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gat_me`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    })
    if (!r.ok) return null
    const me = (await r.json()) as { username?: string }
    return typeof me?.username === 'string' ? me.username : null
  } catch {
    return null
  }
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gat-gate-v2:' + text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function cookieOf(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

/** Accept the password exactly, or without a leading ':' (in case that was just a separator). */
function matches(input: string, pass: string): boolean {
  const a = input.trim()
  return a === pass || (pass.startsWith(':') && a === pass.slice(1))
}

const page = (err: boolean) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#FBF5EC"><title>GoofyAhhTalk</title><meta name="robots" content="noindex">
<style>
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{display:grid;place-items:center;padding:16px;font-family:ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",sans-serif;color:#17131F;
background:radial-gradient(circle at 1px 1px,rgba(23,19,31,.075) 1px,transparent 0) 0 0/22px 22px,#FBF5EC}
form{width:min(360px,100%);display:flex;flex-direction:column;align-items:center;gap:14px}
.face{width:110px;height:110px;animation:bob 2.4s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-6px) rotate(-4deg)}}
h1{font-size:26px;font-weight:800;letter-spacing:-.04em}
h1 span{color:#FF5C39}
.row{width:100%;display:flex;gap:8px;${err ? 'animation:shake .4s;' : ''}}
@keyframes shake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
input{flex:1;min-width:0;height:54px;border-radius:18px;border:2.5px solid ${err ? '#E5383B' : '#17131F'};background:#fff;padding:0 18px;font:inherit;font-size:17px;font-weight:600;outline:none;box-shadow:0 4px 0 #17131F}
button{width:54px;height:54px;border-radius:18px;border:2.5px solid #17131F;background:#FF5C39;color:#fff;font-size:22px;font-weight:800;box-shadow:0 4px 0 #17131F;cursor:pointer}
button:active,input:focus{transform:translateY(2px);box-shadow:0 2px 0 #17131F}
</style></head><body>
<form method="post" action="/__gate">
<svg class="face" viewBox="0 0 100 100"><path d="M50 8C74 8 92 24 92 50S76 92 50 92 8 78 8 52 26 8 50 8z" fill="#FFC83D" stroke="#17131F" stroke-width="4"/>
<circle cx="36" cy="44" r="10" fill="#fff" stroke="#17131F" stroke-width="3"/><circle cx="38" cy="46" r="5" fill="#17131F"/>
<circle cx="64" cy="44" r="10" fill="#fff" stroke="#17131F" stroke-width="3"/><circle cx="66" cy="46" r="5" fill="#17131F"/>
<path d="M38 66q12 ${err ? '-8' : '10'} 24 0" fill="none" stroke="#17131F" stroke-width="4" stroke-linecap="round"/></svg>
<h1>GoofyAhh<span>Talk</span></h1>
<div class="row"><input type="password" name="p" autocomplete="current-password" autofocus aria-label="password"><button type="submit" aria-label="enter">&#8594;</button></div>
</form></body></html>`

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })

export default async function middleware(req: Request): Promise<Response | undefined> {
  const pass = process.env.SITE_PASSWORD
  if (!pass) return // gate off when no password is configured
  const url = new URL(req.url)
  const want = await sha(pass)

  if (url.pathname === '/__gate' && req.method === 'POST') {
    const form = await req.formData().catch(() => null)
    const input = String(form?.get('p') ?? '')
    if (!matches(input, pass)) return html(page(true), 401)
    return new Response(null, {
      status: 303,
      headers: {
        location: '/',
        'set-cookie': `${COOKIE}=${want}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store',
      },
    })
  }

  if (cookieOf(req, COOKIE) === want) return // unlocked: serve the site as usual

  // allowed accounts skip the password: unlock and reload the same page
  const token = cookieOf(req, 'gat_t') || url.searchParams.get('t')
  if (token && req.method === 'GET') {
    const name = await whoIs(token)
    if (name && ALLOW.includes(name.toLowerCase()))
      return new Response(null, {
        status: 307,
        headers: {
          location: url.pathname + url.search,
          'set-cookie': `${COOKIE}=${want}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
          'cache-control': 'no-store',
        },
      })
  }
  // assets and json behind the gate just fail; pages get the password screen
  const accept = req.headers.get('accept') || ''
  if (!accept.includes('text/html')) return new Response('locked', { status: 401, headers: { 'cache-control': 'no-store' } })
  return html(page(false), 401)
}
