// Everything the shop sells. Prices here are what shows before the server answers; the server's
// own list (supabase/migrations/20261018100000_gat_shop.sql) is what actually charges.
import type { AuraId, CardId, HatId } from '../../lib/types'
import { PREMIUM_COLORS, type BlobKind, type EyeKind, type MouthKind, type TopKind } from '../../ui/face'
import { GRAFFITI } from '../../themes/graffiti'
import { getTheme } from '../../themes/themes'

export type Kind = 'theme' | 'graffiti' | 'hat' | 'card' | 'aura' | 'color' | 'shape' | 'eyes' | 'mouth' | 'top'
export type Item = { id: string; kind: Kind; key: string; name: string; price: number }

const it = (kind: Kind, key: string, name: string, price: number): Item => ({ id: `${kind}:${key}`, kind, key, name, price })

export const PAID_THEMES: [string, number][] = [
  ['vapor', 250], ['ocean', 250], ['galaxy', 250], ['sunset', 250], ['noir', 250], ['arcade', 250],
  ['aurora', 150], ['forest', 150], ['y2k', 200], ['batman', 300], ['love', 300], ['bff', 300], ['lust', 350],
  ['meteor', 400], ['temple', 400], ['sakuranight', 400], ['butterfly', 400],
]

export const HATS: [HatId, string, number][] = [
  ['cap', 'cap', 120], ['beanie', 'beanie', 120], ['bow', 'bow', 120], ['party', 'party hat', 150], ['chef', 'chef hat', 150],
  ['halo', 'halo', 200], ['tophat', 'top hat', 200], ['cowboy', 'cowboy hat', 200], ['headphones', 'headphones', 200],
  ['flowercrown', 'flower crown', 220], ['wizard', 'wizard hat', 250], ['crown', 'crown', 350],
]
export const CARD_ITEMS: [CardId, string, number][] = [['ink', 'ink', 100], ['gold', 'gold', 150], ['rose', 'rose', 150], ['grape', 'grape', 150], ['mint', 'mint', 150], ['sky', 'sky', 150]]
export const AURA_ITEMS: [AuraId, string, number][] = [['gold', 'gold', 250], ['sunset', 'sunset', 250], ['sakura', 'sakura', 250], ['hearts', 'hearts', 250], ['galaxy', 'galaxy', 300], ['aurora', 'aurora', 300]]

const COLOR_NAMES = ['red', 'lemon', 'teal', 'orchid', 'latte', 'silver']
export const SHAPES: [BlobKind, string][] = [['heart', 'heart'], ['onion', 'onion'], ['ghosty', 'ghost']]
export const EYES: [EyeKind, string, number][] = [['hearts', 'heart eyes', 120], ['stars', 'star eyes', 120], ['shades', 'shades', 150], ['nerd', 'specs', 100], ['dizzy', 'dizzy', 100], ['dead', 'x eyes', 100]]
export const MOUTHS: [MouthKind, string, number][] = [['fangs', 'fangs', 100], ['cat', 'kitty', 80], ['mustache', 'stache', 100], ['braces', 'braces', 80]]
export const TOPS: [TopKind, string, number][] = [['cat', 'cat ears', 100], ['bunny', 'bunny ears', 100], ['flower', 'flower', 100], ['unicorn', 'unicorn horn', 150]]

function build(): Item[] {
  const themeName = (id: string) => getTheme(id).name
  return [
    ...PAID_THEMES.map(([k, p]) => it('theme', k, themeName(k), p)),
    ...Object.keys(GRAFFITI).map((k) => it('graffiti', k, themeName(k), 120)),
    ...HATS.map(([k, n, p]) => it('hat', k, n, p)),
    ...CARD_ITEMS.map(([k, n, p]) => it('card', k, n, p)),
    ...AURA_ITEMS.map(([k, n, p]) => it('aura', k, n, p)),
    ...PREMIUM_COLORS.map((c, i) => it('color', c.slice(1).toLowerCase(), COLOR_NAMES[i], 60)),
    ...SHAPES.map(([k, n]) => it('shape', k, n, 100)),
    ...EYES.map(([k, n, p]) => it('eyes', k, n, p)),
    ...MOUTHS.map(([k, n, p]) => it('mouth', k, n, p)),
    ...TOPS.map(([k, n, p]) => it('top', k, n, p)),
  ]
}

let items: Item[] | null = null
let byId: Map<string, Item> | null = null
export function catalog(): Item[] {
  return (items ??= build())
}
export function itemById(id: string): Item | undefined {
  byId ??= new Map(catalog().map((x) => [x.id, x]))
  return byId.get(id)
}
/** is this id something the shop sells (anything else is free) */
export const isPaid = (id: string) => !!itemById(id)
