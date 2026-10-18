// Goof coins and what you own. The server keeps the truth (gat_shop); this mirrors it so pickers,
// the header chip and the shop all agree, and every buy or ad claim comes back with the new state.
import { create } from 'zustand'
import { api, isApiError } from '../../lib/api'
import { getToken } from '../../lib/engine'
import { useStore } from '../../lib/store'
import type { ShopState } from '../../lib/types'
import { itemById, type Item } from './catalog'

type S = {
  loaded: boolean
  coins: number
  owned: Set<string>
  prices: Record<string, number>
  ads: { left: number; coins: number; seconds: number }
  gift: number | null
  temp: boolean
}
export const useShop = create<S>(() => ({ loaded: false, coins: 0, owned: new Set(), prices: {}, ads: { left: 0, coins: 25, seconds: 15 }, gift: null, temp: false }))

function apply(st: ShopState) {
  useShop.setState((s) => ({ loaded: true, coins: st.coins, owned: new Set(st.owned), prices: st.prices, ads: st.ads, temp: st.temp, gift: st.gift ?? s.gift }))
  const me = useStore.getState().me
  if (me && me.coins !== st.coins) useStore.setState({ me: { ...me, coins: st.coins } })
}

let loading: Promise<void> | null = null
export function loadShop(): Promise<void> {
  const t = getToken()
  if (!t) return Promise.resolve()
  return (loading ??= api
    .shop(t)
    .then(apply)
    .catch(() => {})
    .finally(() => {
      loading = null
    }))
}

export const priceOf = (it: Item) => useShop.getState().prices[it.id] ?? it.price

// left locked for the admin on purpose so the buy flow can be tried (same list as gat_owns)
const ADMIN_LOCKED = ['theme:galaxy', 'hat:wizard']

/** free things, admin, and anything bought; before the shop loads only free things count */
export function owns(id: string | null | undefined): boolean {
  if (!id) return true
  if (!itemById(id)) return true
  const s = useShop.getState()
  if (s.owned.has(id)) return true
  const me = useStore.getState().me
  return !s.loaded && !!me?.admin && !ADMIN_LOCKED.includes(id)
}
export function useOwns(id: string | null | undefined): boolean {
  useShop((s) => s.owned)
  return owns(id)
}
/** re-render when ownership changes, and hand back the checker */
export function useOwnsFn(): (id: string | null | undefined) => boolean {
  useShop((s) => s.owned)
  useShop((s) => s.loaded)
  return owns
}

export type BuyResult = 'ok' | 'poor' | 'temp' | 'error'
export async function buy(id: string): Promise<BuyResult> {
  const t = getToken()
  if (!t) return 'error'
  if (owns(id)) return 'ok'
  try {
    apply(await api.buy(t, id))
    return owns(id) ? 'ok' : 'error'
  } catch (e) {
    if (isApiError(e, 'not_enough')) {
      void loadShop()
      return 'poor'
    }
    if (isApiError(e, 'not_allowed')) return 'temp'
    return 'error'
  }
}

export async function adStart(slot = 'reward'): Promise<{ id: string; seconds: number } | 'limit' | 'temp' | 'error'> {
  const t = getToken()
  if (!t) return 'error'
  try {
    return await api.adStart(t, slot)
  } catch (e) {
    if (isApiError(e, 'rate_limited')) return 'limit'
    if (isApiError(e, 'not_allowed')) return 'temp'
    return 'error'
  }
}

export async function adClaim(id: string): Promise<'ok' | 'soon' | 'error'> {
  const t = getToken()
  if (!t) return 'error'
  try {
    apply(await api.adClaim(t, id))
    return 'ok'
  } catch (e) {
    if (isApiError(e, 'too_soon')) return 'soon'
    void loadShop()
    return 'error'
  }
}

export const takeGift = () => useShop.setState({ gift: null })

/** what the shop sheet and the buy card show; one of each for the whole app */
export const useShopUi = create<{ open: boolean; tab: ShopTab; buying: { id: string; then?: () => void } | null; ad: boolean }>(() => ({ open: false, tab: 'earn', buying: null, ad: false }))
export type ShopTab = 'earn' | 'themes' | 'graffiti' | 'face' | 'hats' | 'flair'
export const openShop = (tab: ShopTab = 'themes') => useShopUi.setState({ open: true, tab })
export const closeShop = () => useShopUi.setState({ open: false })
/** the little buy card, from anywhere: a locked theme swatch, a face part, a hat */
export const askBuy = (id: string, then?: () => void) => useShopUi.setState({ buying: { id, then } })
export const closeBuy = () => useShopUi.setState({ buying: null })
export const openAd = () => useShopUi.setState({ ad: true })
export const closeAd = () => useShopUi.setState({ ad: false })

/** 15000 -> 15k, 1250 -> 1,250 */
export function coinText(n: number): string {
  if (n >= 100_000) return Math.floor(n / 1000) + 'k'
  if (n >= 10_000) return (Math.floor(n / 100) / 10).toString().replace(/\.0$/, '') + 'k'
  return n.toLocaleString('en-US')
}
