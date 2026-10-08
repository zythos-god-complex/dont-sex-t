// Session persistence: cookies (gat_t, gat_u) mirrored in localStorage (gat.t, gat.u).
// Read order: cookie, then localStorage; whichever exists repopulates the other.

export type Session = { token: string; username: string | null }

const COOKIE_T = 'gat_t'
const COOKIE_U = 'gat_u'
const LS_T = 'gat.t'
const LS_U = 'gat.u'
const MAX_AGE = 34560000

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

export function isValidTokenShape(t: unknown): t is string {
  return typeof t === 'string' && TOKEN_RE.test(t)
}

function hasDoc(): boolean {
  return typeof document !== 'undefined'
}

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function readCookie(name: string): string | null {
  if (!hasDoc()) return null
  let raw = ''
  try {
    raw = document.cookie || ''
  } catch {
    return null
  }
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return part.slice(i + 1).trim()
      }
    }
  }
  return null
}

function isHttps(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'https:'
}

export function writeCookie(name: string, value: string, maxAge = MAX_AGE): void {
  if (!hasDoc()) return
  const secure = isHttps() ? '; Secure' : ''
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* ignore */
  }
}

function lsGet(k: string): string | null {
  try {
    return ls()?.getItem(k) ?? null
  } catch {
    return null
  }
}
function lsSet(k: string, v: string): void {
  try {
    ls()?.setItem(k, v)
  } catch {
    /* ignore */
  }
}
function lsDel(k: string): void {
  try {
    ls()?.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function readSession(): Session | null {
  const ct = readCookie(COOKIE_T)
  const cu = readCookie(COOKIE_U)
  const lt = lsGet(LS_T)
  const lu = lsGet(LS_U)
  const token = isValidTokenShape(ct) ? ct : isValidTokenShape(lt) ? lt : null
  if (!token) return null
  const username = (token === ct ? cu || lu : lu || cu) || null
  // repopulate whichever side is missing / stale
  if (ct !== token) writeCookie(COOKIE_T, token)
  if (lt !== token) lsSet(LS_T, token)
  if (username) {
    if (cu !== username) writeCookie(COOKIE_U, username)
    if (lu !== username) lsSet(LS_U, username)
  }
  return { token, username }
}

export function writeSession(token: string, username: string | null): void {
  writeCookie(COOKIE_T, token)
  lsSet(LS_T, token)
  if (username) {
    writeCookie(COOKIE_U, username)
    lsSet(LS_U, username)
  }
}

export function clearSession(): void {
  writeCookie(COOKIE_T, '', 0)
  writeCookie(COOKIE_U, '', 0)
  lsDel(LS_T)
  lsDel(LS_U)
}

/** Reads `?t=` from the URL, strips it with history.replaceState, returns it if it looks like a token. */
export function takeUrlToken(): string | null {
  if (typeof location === 'undefined') return null
  let url: URL
  try {
    url = new URL(location.href)
  } catch {
    return null
  }
  if (!url.searchParams.has('t')) return null
  const t = url.searchParams.get('t')
  url.searchParams.delete('t')
  try {
    history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash)
  } catch {
    /* ignore */
  }
  return isValidTokenShape(t) ? t : null
}

/** Points <link rel="manifest"> at /api/manifest?t=<token> so an iOS home screen install carries identity. */
export function setManifestToken(token: string | null): void {
  if (!hasDoc()) return
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  const href = token ? `/api/manifest?t=${encodeURIComponent(token)}` : '/api/manifest'
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}
