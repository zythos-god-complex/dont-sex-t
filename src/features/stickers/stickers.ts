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

const RE = /^\[\[sticker:([a-z]+)\]\]$/
export function stickerOf(body: string | null | undefined): StickerKind | null {
  const m = body ? RE.exec(body) : null
  return m && STICKERS.some((s) => s.id === m[1]) ? (m[1] as StickerKind) : null
}
export const stickerBody = (k: StickerKind) => `[[sticker:${k}]]`
/** Human text for previews, quotes, toasts. */
export function displayBody(body: string): string {
  return stickerOf(body) ? 'sent a sticker' : body
}
