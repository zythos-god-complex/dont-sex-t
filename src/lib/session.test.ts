import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal DOM fakes (vitest runs in node).
class FakeStorage {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}

function fakeDocument() {
  const jar = new Map<string, string>()
  const writes: string[] = []
  const link = { rel: 'manifest', attrs: { href: '/api/manifest' } as Record<string, string>, getAttribute(k: string) { return this.attrs[k] ?? null }, setAttribute(k: string, v: string) { this.attrs[k] = v } }
  return {
    writes,
    link,
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
    set cookie(v: string) {
      writes.push(v)
      const [pair, ...attrs] = v.split(';').map((s) => s.trim())
      const i = pair.indexOf('=')
      const k = pair.slice(0, i)
      const val = pair.slice(i + 1)
      if (attrs.some((a) => a.toLowerCase() === 'max-age=0')) jar.delete(k)
      else jar.set(k, val)
    },
    querySelector: () => link,
    head: { appendChild: () => {} },
  }
}

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ012345_-'

let doc: ReturnType<typeof fakeDocument>
let store: FakeStorage
let replaced: string | null

async function load() {
  vi.resetModules()
  return import('./session')
}

beforeEach(() => {
  doc = fakeDocument()
  store = new FakeStorage()
  replaced = null
  vi.stubGlobal('document', doc)
  vi.stubGlobal('localStorage', store)
  vi.stubGlobal('location', { href: 'https://goofy.test/dm/sam?t=' + TOKEN + '&x=1#h', protocol: 'https:' })
  vi.stubGlobal('history', { state: null, replaceState: (_s: unknown, _t: string, url: string) => { replaced = url } })
})

describe('session', () => {
  it('writes cookies and localStorage with the right attributes', async () => {
    const s = await load()
    s.writeSession(TOKEN, 'Sam_1')
    expect(store.getItem('gat.t')).toBe(TOKEN)
    expect(store.getItem('gat.u')).toBe('Sam_1')
    const w = doc.writes.find((x) => x.startsWith('gat_t='))!
    expect(w).toContain('Max-Age=34560000')
    expect(w).toContain('Path=/')
    expect(w).toContain('SameSite=Lax')
    expect(w).toContain('Secure')
    expect(s.readSession()).toEqual({ token: TOKEN, username: 'Sam_1' })
  })

  it('repopulates cookies from localStorage', async () => {
    store.setItem('gat.t', TOKEN)
    store.setItem('gat.u', 'sam')
    const s = await load()
    expect(s.readSession()).toEqual({ token: TOKEN, username: 'sam' })
    expect(doc.cookie).toContain(`gat_t=${TOKEN}`)
  })

  it('repopulates localStorage from cookies (cookie wins)', async () => {
    doc.cookie = `gat_t=${TOKEN}; Path=/`
    doc.cookie = 'gat_u=sam; Path=/'
    store.setItem('gat.t', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')
    const s = await load()
    expect(s.readSession()?.token).toBe(TOKEN)
    expect(store.getItem('gat.t')).toBe(TOKEN)
  })

  it('clears everything', async () => {
    const s = await load()
    s.writeSession(TOKEN, 'sam')
    s.clearSession()
    expect(s.readSession()).toBeNull()
    expect(store.getItem('gat.t')).toBeNull()
  })

  it('adopts ?t= and strips it from the url', async () => {
    const s = await load()
    expect(s.takeUrlToken()).toBe(TOKEN)
    expect(replaced).toBe('/dm/sam?x=1#h')
  })

  it('ignores junk ?t= values but still strips them', async () => {
    vi.stubGlobal('location', { href: 'https://goofy.test/?t=<script>', protocol: 'https:' })
    const s = await load()
    expect(s.takeUrlToken()).toBeNull()
    expect(replaced).toBe('/')
  })

  it('points the manifest link at the token', async () => {
    const s = await load()
    s.setManifestToken(TOKEN)
    expect(doc.link.getAttribute('href')).toBe(`/api/manifest?t=${TOKEN}`)
    s.setManifestToken(null)
    expect(doc.link.getAttribute('href')).toBe('/api/manifest')
  })

  it('validates token shape', async () => {
    const s = await load()
    expect(s.isValidTokenShape(TOKEN)).toBe(true)
    expect(s.isValidTokenShape('short')).toBe(false)
    expect(s.isValidTokenShape('a'.repeat(65))).toBe(false)
    expect(s.isValidTokenShape(null)).toBe(false)
  })
})
