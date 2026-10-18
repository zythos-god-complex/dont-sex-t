// The shop: goof coins from ads buy themes, graffiti, face parts, hats and flair. One sheet, one buy
// card and one ad player for the whole app; pickers elsewhere call askBuy() to buy in place.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../lib/hooks'
import { useStore } from '../../lib/store'
import { saveAvatar, saveFlair } from '../../lib/engine'
import { GoofyFace } from '../../ui/GoofyFace'
import { Aura, CARDS } from '../../ui/Aura'
import { Sheet, spring } from '../../ui/kit'
import { IconCheck, IconClose, IconLock, IconPlay } from '../../ui/icons'
import { avatarFromTraits, faceTraits, type AvatarConfig } from '../../ui/face'
import { getTheme, themeVars } from '../../themes/themes'
import { graffitiTile } from '../../themes/graffiti'
import { useThemeMode } from '../../themes/mode'
import { openMeSheet } from '../shell/meSheet'
import { catalog, itemById, type Item, type Kind } from './catalog'
import { Coin } from './Coin'
import {
  adClaim,
  adStart,
  askBuy,
  buy,
  closeAd,
  closeBuy,
  closeShop,
  coinText,
  loadShop,
  openAd,
  openShop,
  owns,
  takeGift,
  useOwnsFn,
  useShop,
  useShopUi,
  type ShopTab,
} from './shop'

const FIELD: Partial<Record<Kind, keyof AvatarConfig>> = { color: 'color', shape: 'blob', eyes: 'eyes', mouth: 'mouth', top: 'top' }
const KIND_LABEL: Record<Kind, string> = {
  theme: 'chat theme',
  graffiti: 'doodle wall for this theme',
  hat: 'hat',
  card: 'profile card',
  aura: 'nameplate',
  color: 'face color',
  shape: 'face shape',
  eyes: 'eyes',
  mouth: 'mouth',
  top: 'on top',
}

function useFace(): { name: string; face: AvatarConfig } {
  const me = useMe()
  const name = me?.username ?? ''
  const cur = me?.avatar ?? avatarFromTraits(faceTraits(name))
  // previews always show the drawn face, even for people using a photo
  return { name, face: { ...cur, photo: undefined } }
}

function withPart(face: AvatarConfig, it: Item): AvatarConfig {
  const f = FIELD[it.kind]
  if (!f) return face
  const v = it.kind === 'color' ? '#' + it.key.toUpperCase() : it.key
  return { ...face, [f]: v }
}

/** what the item looks like, at tile or card size */
export function ItemPreview({ item, big = false }: { item: Item; big?: boolean }) {
  useThemeMode()
  const { name, face } = useFace()
  const fs = big ? 104 : 58
  if (item.kind === 'theme' || item.kind === 'graffiti') {
    const t = getTheme(item.key)
    const tile = item.kind === 'graffiti' ? graffitiTile(item.key) : null
    return (
      <span className={'shop-sw' + (big ? ' is-big' : '')} style={{ ...themeVars(t), background: t.bg }}>
        {tile && <span className="shop-sw-graf" style={{ background: t.accent, WebkitMaskImage: tile, maskImage: tile }} />}
        <span className="sw-b sw-recv" />
        <span className="sw-b sw-sent" />
      </span>
    )
  }
  if (item.kind === 'hat') return <GoofyFace name={name} avatar={face} hat={item.key as never} size={fs} blink={false} />
  if (item.kind === 'card') {
    const c = CARDS.find((x) => x.id === item.key) ?? CARDS[0]
    return (
      <span className={'shop-card' + (big ? ' is-big' : '')} style={{ '--sw-bg': c.bg, '--sw-edge': c.edge } as CSSProperties}>
        <GoofyFace name={name} avatar={face} size={big ? 56 : 30} blink={false} hat={null} />
        <i />
        <i />
      </span>
    )
  }
  if (item.kind === 'aura')
    return (
      <span className={'shop-plate' + (big ? ' is-big' : '')}>
        <Aura id={item.key as never} />
        <GoofyFace name={name} avatar={face} size={big ? 34 : 22} blink={false} hat={null} />
        <b className="ellipsis">{name}</b>
      </span>
    )
  return <GoofyFace name={name} avatar={withPart(face, item)} size={fs} blink={false} hat={null} />
}

/** are you wearing it right now (hats, cards, nameplates, face parts) */
function useWearing(it: Item): boolean {
  const me = useMe()
  const { face } = useFace()
  if (!me) return false
  if (it.kind === 'hat' || it.kind === 'card' || it.kind === 'aura') return me.flair?.[it.kind] === it.key
  const f = FIELD[it.kind]
  if (!f) return false
  return String(face[f]).toLowerCase() === (it.kind === 'color' ? '#' + it.key : it.key)
}

function wear(it: Item, off = false): Promise<unknown> {
  if (it.kind === 'hat' || it.kind === 'card' || it.kind === 'aura') return saveFlair({ [it.kind]: off ? 'none' : it.key })
  const f = FIELD[it.kind]
  if (!f) return Promise.resolve()
  const me = useStore.getState().me
  if (!me) return Promise.resolve()
  const cur = me.avatar ?? avatarFromTraits(faceTraits(me.username))
  const next = withPart({ ...cur, photo: undefined }, it)
  return saveAvatar({ ...next, brows: next.eyes === 'three' ? null : next.brows })
}

function Price({ item }: { item: Item }) {
  const p = useShop((s) => s.prices[item.id] ?? item.price)
  return (
    <span className="shop-price tnum">
      <Coin size={14} />
      {coinText(p)}
    </span>
  )
}

function Tile({ item }: { item: Item }) {
  const has = useOwnsFn()(item.id)
  const wearing = useWearing(item)
  const wearable = item.kind !== 'theme' && item.kind !== 'graffiti'
  const [busy, setBusy] = useState(false)
  const tap = () => {
    if (!has) return askBuy(item.id)
    if (!wearable || busy) return
    if (wearing && FIELD[item.kind]) return
    setBusy(true)
    void wear(item, wearing)
      .catch(() => {})
      .finally(() => setBusy(false))
  }
  return (
    <motion.button type="button" className={'shop-tile' + (has ? ' is-owned' : '') + (wearing ? ' is-on' : '')} onClick={tap} whileTap={{ scale: 0.95 }} transition={spring} aria-label={item.name + (has ? (wearing ? ', wearing' : ', owned') : '')}>
      <span className="shop-tile-prev">
        <ItemPreview item={item} />
        {wearing && (
          <span className="shop-tile-check">
            <IconCheck size={13} />
          </span>
        )}
      </span>
      <span className="shop-tile-name ellipsis">{item.name}</span>
      {has ? <span className="shop-owned">{wearing ? 'wearing' : wearable ? 'wear' : 'yours'}</span> : <Price item={item} />}
    </motion.button>
  )
}

function Grid({ items }: { items: Item[] }) {
  const has = useOwnsFn()
  // things you can still get first, the ones you have after
  const list = [...items].sort((a, b) => Number(has(a.id)) - Number(has(b.id)))
  return (
    <div className="shop-grid">
      {list.map((it) => (
        <Tile key={it.id} item={it} />
      ))}
    </div>
  )
}

/** where real ads go later */
function AdSlot({ small = false }: { small?: boolean }) {
  return (
    <div className={'ad-slot' + (small ? ' is-small' : '')} aria-hidden="true">
      <span className="ad-tag">ad</span>
      <span>ads will be here</span>
    </div>
  )
}

function KeepFirst() {
  return (
    <div className="shop-keep">
      <GoofyFace name="tour.goof" size={46} mood="wink" blink={false} />
      <div className="grow">
        <b>temp accounts can't shop</b>
        <span>keep this account and the coins are yours</span>
      </div>
      <button
        type="button"
        className="shop-keep-btn"
        onClick={() => {
          closeBuy()
          closeShop()
          setTimeout(() => openMeSheet('me'), 200)
        }}
      >
        keep it
      </button>
    </div>
  )
}

function Earn() {
  const ads = useShop((s) => s.ads)
  const temp = useShop((s) => s.temp)
  if (temp) return <KeepFirst />
  const out = ads.left <= 0
  return (
    <>
      <div className="earn-card">
        <span className="earn-art" aria-hidden="true">
          <Coin size={46} className="earn-c1" />
          <Coin size={34} className="earn-c2" />
          <Coin size={26} className="earn-c3" />
        </span>
        <div className="earn-text">
          <b>watch an ad</b>
          <span className="tnum">
            +{ads.coins} coins · {out ? 'back tomorrow' : `${ads.left} left today`}
          </span>
        </div>
        <button type="button" className="earn-go" disabled={out} onClick={openAd}>
          <IconPlay size={16} /> watch
        </button>
      </div>
      <AdSlot />
    </>
  )
}

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'earn', label: 'earn' },
  { id: 'themes', label: 'themes' },
  { id: 'graffiti', label: 'graffiti' },
  { id: 'face', label: 'face' },
  { id: 'hats', label: 'hats' },
  { id: 'flair', label: 'flair' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="settings-label">{title}</h3>
      {children}
    </>
  )
}

function ShopBody() {
  const tab = useShopUi((s) => s.tab)
  const coins = useShop((s) => s.coins)
  const all = catalog()
  const of = (k: Kind) => all.filter((x) => x.kind === k)
  return (
    <div className="shop">
      <header className="shop-head">
        <h2 className="shop-title">shop</h2>
        <span className="shop-bal tnum" aria-label={`${coins} coins`}>
          <Coin size={22} />
          {coins.toLocaleString('en-US')}
        </span>
      </header>
      <div className="shop-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={'shop-tab' + (tab === t.id ? ' is-on' : '')}
            onClick={(e) => {
              e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
              useShopUi.setState({ tab: t.id })
            }}
          >
            {tab === t.id && <motion.span layoutId="shop-tab" className="shop-tab-pill" transition={spring} />}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="shop-body" key={tab}>
        {tab === 'earn' && <Earn />}
        {tab === 'themes' && <Grid items={of('theme')} />}
        {tab === 'graffiti' && <Grid items={of('graffiti')} />}
        {tab === 'face' && (
          <>
            <Section title="eyes">
              <Grid items={of('eyes')} />
            </Section>
            <Section title="mouth">
              <Grid items={of('mouth')} />
            </Section>
            <Section title="on top">
              <Grid items={of('top')} />
            </Section>
            <Section title="shape">
              <Grid items={of('shape')} />
            </Section>
            <Section title="color">
              <Grid items={of('color')} />
            </Section>
          </>
        )}
        {tab === 'hats' && <Grid items={of('hat')} />}
        {tab === 'flair' && (
          <>
            <Section title="nameplate">
              <Grid items={of('aura')} />
            </Section>
            <Section title="profile card">
              <Grid items={of('card')} />
            </Section>
          </>
        )}
        {tab !== 'earn' && <AdSlot small />}
      </div>
    </div>
  )
}

function Layer({ children, onClose, className }: { children: ReactNode; onClose: () => void; className: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <motion.div className={'pop-scrim ' + className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </motion.div>,
    document.body,
  )
}

function BuyCard() {
  const buying = useShopUi((s) => s.buying)
  const item = buying ? itemById(buying.id) : undefined
  return <AnimatePresence>{buying && item && <BuyInner key={item.id} item={item} then={buying.then} />}</AnimatePresence>
}

function BuyInner({ item, then }: { item: Item; then?: () => void }) {
  const coins = useShop((s) => s.coins)
  const temp = useShop((s) => s.temp)
  const ads = useShop((s) => s.ads)
  const price = useShop((s) => s.prices[item.id] ?? item.price)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(owns(item.id) ? 'done' : 'idle')
  const wearable = item.kind !== 'theme' && item.kind !== 'graffiti'
  const poor = coins < price
  const go = async () => {
    if (state === 'busy') return
    setState('busy')
    const r = await buy(item.id)
    if (r === 'ok') {
      navigator.vibrate?.([12, 40, 18])
      setState('done')
      if (then) {
        then()
        setTimeout(closeBuy, 900)
      }
    } else setState(r === 'poor' ? 'idle' : 'error')
  }
  return (
    <Layer onClose={closeBuy} className="buy-layer">
      <motion.div className="buy-card" role="dialog" aria-label={'unlock ' + item.name} initial={{ y: 40, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, scale: 0.95, opacity: 0 }} transition={spring}>
        <button type="button" className="icon-btn buy-x" aria-label="close" onClick={closeBuy}>
          <IconClose size={20} />
        </button>
        <motion.div className="buy-prev" animate={state === 'done' ? { scale: [1, 1.12, 1], rotate: [0, -4, 0] } : {}} transition={{ duration: 0.5 }}>
          <ItemPreview item={item} big />
          {state === 'done' && (
            <span className="buy-burst" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2
                return (
                  <motion.i
                    key={i}
                    initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                    animate={{ x: Math.cos(a) * 88, y: Math.sin(a) * 62, scale: 1, opacity: 0 }}
                    transition={{ duration: 0.75, ease: 'easeOut' }}
                  />
                )
              })}
            </span>
          )}
        </motion.div>
        <h3 className="buy-name">{item.name}</h3>
        <p className="buy-kind">{KIND_LABEL[item.kind]}</p>
        {state === 'done' ? (
          <>
            <p className="buy-yours">
              <IconCheck size={16} /> yours
            </p>
            {!then && wearable ? (
              <button
                type="button"
                className="buy-go"
                onClick={() => {
                  void wear(item).catch(() => {})
                  closeBuy()
                }}
              >
                wear it
              </button>
            ) : (
              !then && (
                <button type="button" className="buy-go" onClick={closeBuy}>
                  nice
                </button>
              )
            )}
          </>
        ) : temp ? (
          <KeepFirst />
        ) : poor ? (
          <>
            <div className="buy-need tnum">
              <span className="buy-have">
                <Coin size={16} /> {coins.toLocaleString('en-US')} / {price.toLocaleString('en-US')}
              </span>
              <span className="buy-bar">
                <i style={{ width: `${Math.min(100, (coins / price) * 100)}%` }} />
              </span>
            </div>
            <button type="button" className="buy-go is-ad" disabled={ads.left <= 0} onClick={openAd}>
              <IconPlay size={16} /> {ads.left > 0 ? `watch an ad · +${ads.coins}` : 'no more ads today'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="buy-go" disabled={state === 'busy'} onClick={() => void go()}>
              {state === 'busy' ? (
                <span className="dots-loader">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  <IconLock size={16} /> unlock · <Coin size={16} /> {price.toLocaleString('en-US')}
                </>
              )}
            </button>
            <p className="buy-left tnum">{state === 'error' ? "didn't go through, try again" : `${(coins - price).toLocaleString('en-US')} left after`}</p>
          </>
        )}
      </motion.div>
    </Layer>
  )
}

/** the rewarded ad. no real ads yet, so a placeholder runs the same clock the server checks */
function AdPlayer() {
  const open = useShopUi((s) => s.ad)
  return <AnimatePresence>{open && <AdInner />}</AnimatePresence>
}

function AdInner() {
  const coins = useShop((s) => s.ads.coins)
  const [view, setView] = useState<{ id: string; left: number } | 'limit' | 'temp' | 'error' | null>(null)
  const [claim, setClaim] = useState<'idle' | 'busy' | 'done'>('idle')
  useEffect(() => {
    let live = true
    void adStart().then((r) => live && setView(typeof r === 'string' ? r : { id: r.id, left: r.seconds }))
    return () => {
      live = false
    }
  }, [])
  const counting = !!view && typeof view === 'object' && view.left > 0
  useEffect(() => {
    if (!counting) return
    // the clock only runs while you can see it
    const t = setInterval(() => {
      if (document.hidden) return
      setView((v) => (v && typeof v === 'object' ? { ...v, left: Math.max(0, v.left - 1) } : v))
    }, 1000)
    return () => clearInterval(t)
  }, [counting])
  const take = async () => {
    if (!view || typeof view !== 'object' || claim !== 'idle') return
    setClaim('busy')
    let r = await adClaim(view.id)
    if (r === 'soon') {
      await new Promise((ok) => setTimeout(ok, 1200))
      r = await adClaim(view.id)
    }
    if (r === 'ok') {
      setClaim('done')
      navigator.vibrate?.([10, 30, 10, 30, 16])
      setTimeout(closeAd, 1100)
    } else setClaim('idle')
  }
  const total = useShop((s) => s.ads.seconds) || 15
  const left = view && typeof view === 'object' ? view.left : total
  return (
    <Layer onClose={closeAd} className="ad-layer">
      <motion.div className="ad-card" role="dialog" aria-label="ad" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={spring}>
        <div className="ad-top">
          <span className="ad-tag">ad</span>
          <button type="button" className="icon-btn" aria-label="close ad" onClick={closeAd}>
            <IconClose size={20} />
          </button>
        </div>
        <div className="ad-stage">
          {view === 'limit' ? (
            <>
              <GoofyFace name="tour.goof" size={70} mood="sleepy" blink={false} />
              <b>that's all the ads for today</b>
              <span>more tomorrow</span>
            </>
          ) : view === 'temp' ? (
            <KeepFirst />
          ) : view === 'error' ? (
            <>
              <GoofyFace name="tour.goof" size={70} mood="shocked" blink={false} />
              <b>couldn't load an ad</b>
            </>
          ) : claim === 'done' ? (
            <motion.div className="ad-won" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
              <Coin size={84} />
              <b className="tnum">+{coins}</b>
            </motion.div>
          ) : (
            <>
              <Coin size={70} className="ad-spin" />
              <b>ads will be here</b>
              <span>real ads are coming soon</span>
            </>
          )}
        </div>
        {view && typeof view === 'object' && claim !== 'done' && (
          <div className="ad-foot">
            {left > 0 ? (
              <span className="ad-clock tnum" style={{ '--p': `${((total - left) / total) * 100}%` } as CSSProperties}>
                <i />
                {left}s
              </span>
            ) : (
              <button type="button" className="buy-go" disabled={claim === 'busy'} onClick={() => void take()}>
                <Coin size={18} /> claim +{coins}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </Layer>
  )
}

/** the one time launch gift */
function GiftCard() {
  const gift = useShop((s) => s.gift)
  return (
    <AnimatePresence>
      {gift && (
        <Layer onClose={takeGift} className="gift-layer">
          <motion.div className="gift-card" role="dialog" aria-label="launch gift" initial={{ y: 60, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 20 }}>
            <span className="gift-rain" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <motion.span
                  key={i}
                  style={{ left: `${(i * 37) % 100}%` }}
                  initial={{ y: -40, rotate: 0, opacity: 0 }}
                  animate={{ y: 260, rotate: 360 * (i % 2 ? 1 : -1), opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.8 + (i % 4) * 0.3, delay: (i % 7) * 0.12, repeat: Infinity, ease: 'easeIn' }}
                >
                  <Coin size={16 + (i % 3) * 6} />
                </motion.span>
              ))}
            </span>
            <span className="gift-big">
              <Coin size={86} />
            </span>
            <h3>launch gift</h3>
            <p className="gift-n tnum">{gift.toLocaleString('en-US')} goof coins</p>
            <p className="gift-sub">themes, hats, graffiti and face stuff are in the shop</p>
            <button
              type="button"
              className="buy-go"
              onClick={() => {
                takeGift()
                openShop('themes')
              }}
            >
              open the shop
            </button>
            <button type="button" className="gift-later" onClick={takeGift}>
              later
            </button>
          </motion.div>
        </Layer>
      )}
    </AnimatePresence>
  )
}

/** mounted once in App */
export function ShopHost() {
  const me = useMe()
  const open = useShopUi((s) => s.open)
  const id = me?.id
  const temp = !!me?.temp
  useEffect(() => {
    if (id) void loadShop()
  }, [id, temp])
  if (!me) return null
  return (
    <>
      <Sheet open={open} onClose={closeShop} label="shop">
        <ShopBody />
      </Sheet>
      <BuyCard />
      <AdPlayer />
      <GiftCard />
    </>
  )
}
