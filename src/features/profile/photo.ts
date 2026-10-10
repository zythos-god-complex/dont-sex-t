// Optional profile photo: square crop, 320px jpeg, its own bucket (never purged). Only our bucket's urls ever render.
import { SUPABASE_KEY, SUPABASE_URL } from '../../lib/env'
import { api } from '../../lib/api'
import { getToken } from '../../lib/engine'

import { PHOTO_BASE } from '../../ui/photoUrl'

async function square(file: File, size = 320): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.86))
  if (!blob) throw new Error('encode')
  return blob
}

export async function uploadPhoto(file: File): Promise<string> {
  const tok = getToken()
  if (!tok) throw new Error('no session')
  const blob = await square(file)
  const path = await api.uploadTicket(tok, 'gat-pfp', 'jpg')
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/gat-pfp/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': 'image/jpeg' },
    body: blob,
  })
  if (!r.ok) throw new Error('upload failed')
  return PHOTO_BASE + path
}
