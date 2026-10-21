// On-device history. The server forgets everything after 4h, so every message, room message and
// voice/photo file we see is copied into IndexedDB and read back from here once the server copy is gone.
import { SUPABASE_KEY } from './env'
import { getToken } from './engine'

type Row = { id: string; created_at: string; [k: string]: unknown }
type Store = 'msgs' | 'rmsgs' | 'media' | 'meta'

let dbp: Promise<IDBDatabase | null> | null = null
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open('gat-archive', 1)
      req.onupgradeneeded = () => {
        const d = req.result
        d.createObjectStore('msgs', { keyPath: 'id' }).createIndex('by', ['conversation_id', 'created_at'])
        d.createObjectStore('rmsgs', { keyPath: 'id' }).createIndex('by', ['room_id', 'created_at'])
        d.createObjectStore('media')
        d.createObjectStore('meta')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbp
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((res) => {
    tx.oncomplete = () => res()
    tx.onerror = () => res()
    tx.onabort = () => res()
  })
}

async function putMany(store: Store, rows: Row[]) {
  if (!rows.length) return
  const d = await db()
  if (!d) return
  try {
    const tx = d.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const r of rows) os.put(r)
    await done(tx)
  } catch {
    /* quota or private mode */
  }
}

/** Rows of one chat/room older than `before` (or newest), ascending, at most `limit`. */
async function range<T>(store: 'msgs' | 'rmsgs', key: string, before: string | null, limit: number): Promise<T[]> {
  const d = await db()
  if (!d) return []
  return new Promise((resolve) => {
    try {
      const idx = d.transaction(store).objectStore(store).index('by')
      const upper = before ? [key, before] : [key, '￿']
      const req = idx.openCursor(IDBKeyRange.bound([key, ''], upper, false, true), 'prev')
      const out: T[] = []
      req.onsuccess = () => {
        const c = req.result
        if (c && out.length < limit) {
          out.push(c.value as T)
          c.continue()
        } else resolve(out.reverse())
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

// owner guard: a different account on the same browser starts with a clean archive
export async function claimArchive(userId: string): Promise<void> {
  const d = await db()
  if (!d) return
  try {
    const owner = await new Promise<unknown>((res) => {
      const r = d.transaction('meta').objectStore('meta').get('owner')
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
    })
    if (owner === userId) return
    const tx = d.transaction(['msgs', 'rmsgs', 'media', 'meta'], 'readwrite')
    if (owner) for (const s of ['msgs', 'rmsgs', 'media'] as const) tx.objectStore(s).clear()
    tx.objectStore('meta').put(userId, 'owner')
    await done(tx)
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ messages

const seen = new WeakSet<object>()

/** Save messages (skips objects already saved; edited copies like new reactions are new objects). */
export function archiveMsgs(list: Row[]): void {
  const fresh = list.filter((m) => m && !seen.has(m) && typeof m.id === 'string' && !m.id.startsWith('tmp') && !(m as { state?: string }).state)
  if (!fresh.length) return
  for (const m of fresh) seen.add(m)
  void putMany('msgs', fresh)
  for (const m of fresh) grabMedia(m.body as string)
}
export const olderMsgs = <T>(convId: string, before: string | null, limit: number) => range<T>('msgs', convId, before, limit)

export function archiveRoomMsgs(list: Row[]): void {
  const fresh = list.filter((m) => m && !seen.has(m) && typeof m.id === 'string' && !m.id.startsWith('tmp') && !(m as { state?: string }).state)
  if (!fresh.length) return
  for (const m of fresh) seen.add(m)
  void putMany('rmsgs', fresh)
}
export const olderRoomMsgs = <T>(roomId: string, before: string | null, limit: number) => range<T>('rmsgs', roomId, before, limit)

// ------------------------------------------------------------------ media

const MEDIA_RE = /^\[\[(?:voice|img):(https:\/\/[^|\]]+)\|/
const wanted = new Set<string>()
const queue: string[] = []
let active = 0

/**
 * Voice notes and photos are private: the file only comes back for someone who is in that chat, and the
 * server checks the account's token on every request. A plain link to the file opens nothing.
 */
async function fetchMedia(url: string): Promise<Blob | null> {
  const tok = getToken()
  if (!tok) return null
  try {
    const r = await fetch(url.replace('/storage/v1/object/public/', '/storage/v1/object/authenticated/'), {
      headers: { apikey: SUPABASE_KEY, 'x-gat-token': tok },
    })
    return r.ok ? await r.blob() : null
  } catch {
    return null
  }
}

async function putMedia(url: string, blob: Blob): Promise<void> {
  const d = await db()
  if (!d) return
  try {
    const tx = d.transaction('media', 'readwrite')
    tx.objectStore('media').put(blob, url)
    await done(tx)
  } catch {
    /* quota or private mode */
  }
}

// one download per file, however many bubbles and the archive ask at once
const inflight = new Map<string, Promise<Blob | null>>()
function loadMedia(url: string, keep: boolean): Promise<Blob | null> {
  let p = inflight.get(url)
  if (!p) {
    p = (async () => {
      const have = await getMedia(url)
      if (have) return have
      const blob = await fetchMedia(url)
      if (blob && keep) await putMedia(url, blob)
      return blob
    })().finally(() => inflight.delete(url))
    inflight.set(url, p)
  }
  return p
}

function grabMedia(body: string | undefined) {
  const m = body ? MEDIA_RE.exec(body) : null
  // view-once photos never get a copy on the device
  if (!m || wanted.has(m[1]) || body!.endsWith('|1]]')) return
  wanted.add(m[1])
  queue.push(m[1])
  pump()
}

function pump() {
  while (active < 2 && queue.length) {
    const url = queue.shift()!
    active++
    void loadMedia(url, true)
      .then((blob) => {
        // not there yet (the message can show up a beat before its file is readable) or offline: let a later look try again
        if (!blob) wanted.delete(url)
      })
      .catch(() => wanted.delete(url))
      .finally(() => {
        active--
        pump()
      })
  }
}

export async function getMedia(url: string): Promise<Blob | null> {
  const d = await db()
  if (!d) return null
  return new Promise((res) => {
    try {
      const r = d.transaction('media').objectStore('media').get(url)
      r.onsuccess = () => res((r.result as Blob) ?? null)
      r.onerror = () => res(null)
    } catch {
      res(null)
    }
  })
}

const objUrls = new Map<string, string>()
/** the local address of a file we already have open, if any (no waiting) */
export const peekMedia = (url: string): string | undefined => objUrls.get(url)

/** Local object URL for a voice note or photo: this device's copy, else fetched now (and kept unless `keep` is off). '' if it can't be had. */
export async function mediaSrc(url: string, keep = true): Promise<string> {
  const hit = objUrls.get(url)
  if (hit) return hit
  const blob = await loadMedia(url, keep)
  if (!blob) return ''
  const u = URL.createObjectURL(blob)
  objUrls.set(url, u)
  return u
}

/** Drop this device's copy of a chat up to `upTo` (delete chat). */
export async function wipeConv(convId: string, upTo: string): Promise<void> {
  const d = await db()
  if (!d) return
  try {
    const tx = d.transaction('msgs', 'readwrite')
    const req = tx.objectStore('msgs').index('by').openCursor(IDBKeyRange.bound([convId, ''], [convId, upTo]))
    req.onsuccess = () => {
      const c = req.result
      if (!c) return
      c.delete()
      c.continue()
    }
    await done(tx)
  } catch {
    /* ignore */
  }
}
