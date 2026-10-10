// Spotify now playing: the owner connects once (PKCE, no secret), we poll their own
// current track while the app is open and push it to their profile. Others just read it.
import { create } from 'zustand'

type Track = { t: string; by: string; img: string; url: string }

const CID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || ''
const SCOPE = 'user-read-currently-playing'
const REDIRECT = typeof location !== 'undefined' ? location.origin + '/spotify' : ''
const K = { tok: 'gat.sp.tok', ref: 'gat.sp.ref', exp: 'gat.sp.exp', ver: 'gat.sp.ver' }

export const spotifyEnabled = () => !!CID

type SpotifyState = { connected: boolean; track: Track | null }
export const useSpotify = create<SpotifyState>(() => ({ connected: hasTokens(), track: null }))

function hasTokens(): boolean {
  try {
    return !!localStorage.getItem(K.ref)
  } catch {
    return false
  }
}
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* blocked */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* blocked */
    }
  },
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(digest)
}
function randomString(n: number): string {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => ('0' + (x % 36).toString(36)).slice(-1)).join('')
}

/** send the user to Spotify to authorize */
export async function connectSpotify(): Promise<void> {
  if (!CID) return
  const verifier = randomString(64)
  ls.set(K.ver, verifier)
  const p = new URLSearchParams({
    client_id: CID,
    response_type: 'code',
    redirect_uri: REDIRECT,
    scope: SCOPE,
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
  })
  location.href = 'https://accounts.spotify.com/authorize?' + p.toString()
}

export function disconnectSpotify(): void {
  ls.del(K.tok)
  ls.del(K.ref)
  ls.del(K.exp)
  useSpotify.setState({ connected: false, track: null })
  push?.(null)
  stop()
}

async function exchange(code: string): Promise<boolean> {
  const verifier = ls.get(K.ver)
  if (!verifier) return false
  const body = new URLSearchParams({ client_id: CID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier })
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) return false
  const j = await r.json()
  ls.set(K.tok, j.access_token)
  if (j.refresh_token) ls.set(K.ref, j.refresh_token)
  ls.set(K.exp, String(Date.now() + (j.expires_in - 60) * 1000))
  ls.del(K.ver)
  return true
}

async function token(): Promise<string | null> {
  const exp = Number(ls.get(K.exp) || 0)
  const tok = ls.get(K.tok)
  if (tok && Date.now() < exp) return tok
  const ref = ls.get(K.ref)
  if (!ref) return null
  const body = new URLSearchParams({ client_id: CID, grant_type: 'refresh_token', refresh_token: ref })
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) {
    if (r.status === 400) disconnectSpotify() // refresh token revoked
    return null
  }
  const j = await r.json()
  ls.set(K.tok, j.access_token)
  if (j.refresh_token) ls.set(K.ref, j.refresh_token)
  ls.set(K.exp, String(Date.now() + (j.expires_in - 60) * 1000))
  return j.access_token as string
}

let timer: ReturnType<typeof setInterval> | null = null
let push: ((np: Track | null) => void) | null = null
let lastKey = ''

async function tick(): Promise<void> {
  if (document.visibilityState !== 'visible') return
  const tok = await token()
  if (!tok) return
  let r: Response
  try {
    r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: 'Bearer ' + tok } })
  } catch {
    return
  }
  if (r.status === 204 || r.status === 202) return clear()
  if (!r.ok) return
  const j = await r.json().catch(() => null)
  const item = j?.item
  if (!j?.is_playing || !item || item.type !== 'track') return clear()
  const track: Track = {
    t: item.name,
    by: (item.artists || []).map((a: { name: string }) => a.name).join(', '),
    img: item.album?.images?.[item.album.images.length - 1]?.url || item.album?.images?.[0]?.url || '',
    url: item.external_urls?.spotify || '',
  }
  if (!/^https:\/\/i\.scdn\.co\/image\//.test(track.img) || !/^https:\/\/open\.spotify\.com\/track\//.test(track.url)) return
  const key = track.url
  useSpotify.setState({ track })
  if (key !== lastKey) {
    lastKey = key
    push?.(track)
  }
}
function clear(): void {
  useSpotify.setState({ track: null })
  if (lastKey) {
    lastKey = ''
    push?.(null)
  }
}

function start(): void {
  if (timer) return
  void tick()
  timer = setInterval(() => void tick(), 30000)
  document.addEventListener('visibilitychange', onVis)
}
function stop(): void {
  if (timer) clearInterval(timer)
  timer = null
  lastKey = ''
  document.removeEventListener('visibilitychange', onVis)
}
const onVis = () => {
  if (document.visibilityState === 'visible') void tick()
}

/** called once on boot: finish any pending login, then start polling if connected */
export function initSpotify(pushFn: (np: Track | null) => void): void {
  if (!CID) return
  push = pushFn
  if (location.pathname === '/spotify') {
    const q = new URLSearchParams(location.search)
    const code = q.get('code')
    history.replaceState(null, '', '/')
    if (code) {
      void exchange(code).then((ok) => {
        if (ok) {
          useSpotify.setState({ connected: true })
          start()
        }
      })
      return
    }
  }
  if (hasTokens()) start()
}
