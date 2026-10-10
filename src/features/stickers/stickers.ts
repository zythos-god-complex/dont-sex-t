import type { HatId } from '../../lib/types'
import type { FaceMood } from '../../ui/GoofyFace'

export type StickerKind =
  | 'hey' | 'bye' | 'kiss' | 'love' | 'lol' | 'sad' | 'angry' | 'gn' | 'hype' | 'shy' | 'hugs' | 'dead'
  | 'hate' | 'nope' | 'ew' | 'talkhand' | 'trash' | 'clown' | 'blocked' | 'loser'
  | 'lust' | 'uup' | 'kissme' | 'thirsty' | 'spicy' | 'peach' | 'downbad' | 'naughty'
  | 'boo' | 'trickortreat' | 'hexed' | 'ghosting' | 'candy' | 'spooked'

export type StickerPack = 'me' | 'hate' | 'lust' | 'boo'

export const STICKERS: { id: StickerKind; caption: string; mood: FaceMood; pack: StickerPack; hat?: HatId }[] = [
  { id: 'hey', caption: 'hey!', mood: 'happy', pack: 'me' },
  { id: 'kiss', caption: 'mwah', mood: 'wink', pack: 'me' },
  { id: 'love', caption: 'love ya', mood: 'happy', pack: 'me' },
  { id: 'lol', caption: 'lmaooo', mood: 'happy', pack: 'me' },
  { id: 'hugs', caption: 'hugs', mood: 'happy', pack: 'me' },
  { id: 'shy', caption: 'hehe', mood: 'wink', pack: 'me' },
  { id: 'hype', caption: 'lets gooo', mood: 'happy', pack: 'me' },
  { id: 'sad', caption: 'sad', mood: 'sleepy', pack: 'me' },
  { id: 'angry', caption: 'grrr', mood: 'shocked', pack: 'me' },
  { id: 'dead', caption: 'im dead', mood: 'shocked', pack: 'me' },
  { id: 'gn', caption: 'gn', mood: 'sleepy', pack: 'me' },
  { id: 'bye', caption: 'bye bye', mood: 'happy', pack: 'me' },

  { id: 'hate', caption: 'i hate u', mood: 'angry', pack: 'hate' },
  { id: 'nope', caption: 'nope', mood: 'smug', pack: 'hate' },
  { id: 'ew', caption: 'ew', mood: 'disgust', pack: 'hate' },
  { id: 'talkhand', caption: 'talk to the hand', mood: 'smug', pack: 'hate' },
  { id: 'trash', caption: 'ur trash', mood: 'smug', pack: 'hate' },
  { id: 'clown', caption: 'clown', mood: 'smug', pack: 'hate' },
  { id: 'blocked', caption: 'blocked', mood: 'smug', pack: 'hate' },
  { id: 'loser', caption: 'loser', mood: 'smug', pack: 'hate' },

  { id: 'lust', caption: 'come here', mood: 'flirty', pack: 'lust' },
  { id: 'uup', caption: 'u up?', mood: 'smug', pack: 'lust' },
  { id: 'kissme', caption: 'kiss me', mood: 'kiss', pack: 'lust' },
  { id: 'thirsty', caption: 'thirsty', mood: 'happy', pack: 'lust' },
  { id: 'spicy', caption: 'spicy', mood: 'shocked', pack: 'lust' },
  { id: 'peach', caption: 'nice', mood: 'flirty', pack: 'lust' },
  { id: 'downbad', caption: 'down bad', mood: 'happy', pack: 'lust' },
  { id: 'naughty', caption: 'naughty', mood: 'flirty', pack: 'lust' },

  { id: 'boo', caption: 'boo!', mood: 'shocked', pack: 'boo', hat: 'ghost' },
  { id: 'trickortreat', caption: 'trick or treat', mood: 'happy', pack: 'boo', hat: 'pumpkin' },
  { id: 'hexed', caption: 'hexed u', mood: 'wink', pack: 'boo', hat: 'witch' },
  { id: 'ghosting', caption: 'ghosting u', mood: 'sleepy', pack: 'boo', hat: 'ghost' },
  { id: 'candy', caption: 'gimme candy', mood: 'happy', pack: 'boo', hat: 'pumpkin' },
  { id: 'spooked', caption: 'spooked', mood: 'shocked', pack: 'boo', hat: 'witch' },
]

/** Stickers only shown when both people have nsfw on. */
export const NSFW_STICKERS: readonly StickerKind[] = STICKERS.filter((s) => s.pack === 'lust').map((s) => s.id)

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
  if (/^\[\[voice:/.test(body)) return 'voice message'
  if (/^\[\[img:/.test(body)) return 'photo'
  return stickerOf(body) || coupleOf(body) ? 'sent a sticker' : body
}
