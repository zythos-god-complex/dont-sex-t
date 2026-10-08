import type { FaceMood } from '../../ui/GoofyFace'

export type StickerKind = 'hey' | 'bye' | 'kiss' | 'love' | 'lol' | 'sad' | 'angry' | 'gn' | 'hype' | 'shy' | 'hugs' | 'dead'

export const STICKERS: { id: StickerKind; caption: string; mood: FaceMood }[] = [
  { id: 'hey', caption: 'hey!', mood: 'happy' },
  { id: 'kiss', caption: 'mwah', mood: 'wink' },
  { id: 'love', caption: 'love ya', mood: 'happy' },
  { id: 'lol', caption: 'lmaooo', mood: 'happy' },
  { id: 'hugs', caption: 'hugs', mood: 'happy' },
  { id: 'shy', caption: 'hehe', mood: 'wink' },
  { id: 'hype', caption: 'lets gooo', mood: 'happy' },
  { id: 'sad', caption: 'sad', mood: 'sleepy' },
  { id: 'angry', caption: 'grrr', mood: 'shocked' },
  { id: 'dead', caption: 'im dead', mood: 'shocked' },
  { id: 'gn', caption: 'gn', mood: 'sleepy' },
  { id: 'bye', caption: 'bye bye', mood: 'happy' },
]

export type CoupleKind =
  | 'c_kiss' | 'c_hug' | 'c_cuddle' | 'c_boop' | 'c_highfive' | 'c_dance'
  | 'c_hands' | 'c_forehead' | 'c_cheek' | 'c_missyou' | 'c_heart' | 'c_pillow'

/** a = the sender, b = the other person */
export const COUPLES: { id: CoupleKind; caption: string; a: FaceMood; b: FaceMood }[] = [
  { id: 'c_kiss', caption: 'mwah', a: 'kiss', b: 'kiss' },
  { id: 'c_hug', caption: 'hugs', a: 'happy', b: 'happy' },
  { id: 'c_cuddle', caption: 'cuddles', a: 'sleepy', b: 'wink' },
  { id: 'c_cheek', caption: 'smooch', a: 'wink', b: 'shocked' },
  { id: 'c_forehead', caption: 'us', a: 'sleepy', b: 'sleepy' },
  { id: 'c_heart', caption: 'my fav', a: 'happy', b: 'happy' },
  { id: 'c_hands', caption: 'together', a: 'happy', b: 'happy' },
  { id: 'c_missyou', caption: 'miss u', a: 'sleepy', b: 'sleepy' },
  { id: 'c_boop', caption: 'boop', a: 'happy', b: 'shocked' },
  { id: 'c_highfive', caption: 'yesss', a: 'happy', b: 'happy' },
  { id: 'c_dance', caption: 'vibing', a: 'happy', b: 'wink' },
  { id: 'c_pillow', caption: 'take that', a: 'happy', b: 'shocked' },
]

const RE = /^\[\[sticker:([a-z_]+)\]\]$/
export function stickerOf(body: string | null | undefined): StickerKind | null {
  const m = body ? RE.exec(body) : null
  return m && STICKERS.some((s) => s.id === m[1]) ? (m[1] as StickerKind) : null
}
export function coupleOf(body: string | null | undefined): CoupleKind | null {
  const m = body ? RE.exec(body) : null
  return m && COUPLES.some((s) => s.id === m[1]) ? (m[1] as CoupleKind) : null
}
export const stickerBody = (k: StickerKind | CoupleKind) => `[[sticker:${k}]]`
/** Human text for previews, quotes, toasts. */
export function displayBody(body: string): string {
  return stickerOf(body) || coupleOf(body) ? 'sent a sticker' : body
}
