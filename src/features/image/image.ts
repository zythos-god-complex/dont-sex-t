import { SUPABASE_URL, SUPABASE_KEY } from '../../lib/env'

// An image travels as a message body: [[img:<public url>|<w>|<h>]]
const RE = /^\[\[img:(https:\/\/[^|\]]+)\|(\d+)\|(\d+)\]\]$/
export type ImageMsg = { url: string; w: number; h: number }

export function imageOf(body: string | null | undefined): ImageMsg | null {
  const m = body ? RE.exec(body) : null
  return m ? { url: m[1], w: +m[2], h: +m[3] } : null
}
export const imageBody = (url: string, w: number, h: number) => `[[img:${url}|${w}|${h}]]`

/** Downscale to a sane size and re-encode. GIFs pass through so they keep moving. */
/** Decode with createImageBitmap, falling back to an <img> (some Android browsers reject one or the other). */
async function decode(file: File): Promise<{ src: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bmp = await createImageBitmap(file)
    return { src: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((ok, no) => {
      img.onload = () => ok()
      img.onerror = () => no(new Error('decode'))
      img.src = url
    })
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  }
}

export async function prepImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const im = await decode(file)
  const max = 1600
  const k = Math.min(1, max / Math.max(im.width, im.height))
  const w = Math.max(1, Math.round(im.width * k))
  const h = Math.max(1, Math.round(im.height * k))
  if (file.type === 'image/gif' && file.size < 6_000_000) {
    im.done()
    return { blob: file, w, h }
  }
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  cv.getContext('2d')!.drawImage(im.src, 0, 0, w, h)
  im.done()
  const blob = await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', 0.84))
  return { blob, w, h }
}

export async function uploadImage(blob: Blob, userId: string): Promise<string> {
  const type = blob.type || 'image/jpeg'
  const ext = type === 'image/gif' ? 'gif' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/gat-img/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': type },
    body: blob,
  })
  if (!r.ok) throw new Error(`upload ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`)
  return `${SUPABASE_URL}/storage/v1/object/public/gat-img/${path}`
}
