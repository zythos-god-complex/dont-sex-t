// Only profile photos from our own bucket ever render (no outside image urls in avatars).
import { SUPABASE_URL } from '../lib/env'

export const PHOTO_BASE = `${SUPABASE_URL}/storage/v1/object/public/gat-pfp/`
export const isPhoto = (u: unknown): u is string => typeof u === 'string' && u.startsWith(PHOTO_BASE) && u.length < 260
