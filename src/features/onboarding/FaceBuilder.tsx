import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, spring } from '../../ui/kit'
import { IconCheck, IconDice } from '../../ui/icons'
import {
  BLOB_KINDS,
  BROW_KINDS,
  EYE_KINDS,
  FACE_COLORS,
  MOUTH_KINDS,
  TOP_KINDS,
  partItem,
  randomAvatar,
  type AvatarConfig,
} from '../../ui/face'
import { itemById } from '../shop/catalog'
import { askBuy, coinText, useOwnsFn, useShop } from '../shop/shop'
import { Coin, Lock } from '../shop/Coin'

type Tab = 'color' | 'shape' | 'eyes' | 'mouth' | 'top' | 'brows'

function Tile({ on, onPick, children, label, price }: { on: boolean; onPick: () => void; children: React.ReactNode; label: string; price?: number | null }) {
  return (
    <motion.button type="button" className={'fb-tile' + (on ? ' is-on' : '') + (price ? ' is-shop' : '')} onClick={onPick} whileTap={{ scale: 0.9 }} transition={spring} aria-pressed={on} aria-label={label + (price ? ', in the shop' : '')}>
      {children}
      <AnimatePresence initial={false}>
        {!!price && (
          <motion.span key="price" className="fb-price tnum" exit={{ y: -10, opacity: 0, scale: 0.7, transition: { duration: 0.35 } }}>
            <Lock size={10} />
            <Coin size={11} />
            {coinText(price)}
          </motion.span>
        )}
      </AnimatePresence>
      {on && (
        <motion.span className="fb-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
          <IconCheck size={12} />
        </motion.span>
      )}
    </motion.button>
  )
}

/** shop: signed in, so shop parts show with their price and buy in place; off at sign up, where they stay hidden */
export function FaceBuilder({ name, value, onChange, onDone, shop = false }: { name: string | null; value: AvatarConfig; onChange: (a: AvatarConfig) => void; onDone: () => void; shop?: boolean }) {
  const [tab, setTab] = useState<Tab>('color')
  const [spin, setSpin] = useState(0)
  const has = useOwnsFn()
  const prices = useShop((s) => s.prices)
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch })
  // a part you already wear counts as yours; a shop part you don't have shows its price
  type Part = Parameters<typeof partItem>[0]
  const cost = (part: Part, v: string, cur: string): number | null => {
    const id = partItem(part, v)
    if (!id || v === cur || has(id)) return null
    return prices[id] ?? itemById(id)?.price ?? null
  }
  const shown = (part: Part, v: string, cur: string) => shop || v === cur || !partItem(part, v)
  const pick = (part: Part, v: string, cur: string, patch: Partial<AvatarConfig>) => {
    const id = partItem(part, v)
    if (id && v !== cur && !has(id)) return askBuy(id, () => set(patch))
    set(patch)
  }
  const face = (a: AvatarConfig, size = 58) => <GoofyFace name={name} avatar={a} size={size} blink={false} />
  // tops and brows are small: a bigger face cropped to its upper half so the difference shows
  const zoom = (a: AvatarConfig) => <span className="fb-zoom">{face(a, 104)}</span>

  return (
    <div className="fb">
      <div className="fb-preview">
        <motion.div key={JSON.stringify(value)} initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
          <GoofyFace name={name} avatar={value} size={128} />
        </motion.div>
        <motion.button
          type="button"
          className="fb-dice"
          aria-label="shuffle"
          animate={{ rotate: spin * 360 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={() => {
            setSpin((n) => n + 1)
            onChange(randomAvatar(shop ? has : undefined))
          }}
        >
          <IconDice size={24} />
        </motion.button>
      </div>

      <Segmented
        layoutId="fb-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'color', label: 'color' },
          { id: 'shape', label: 'shape' },
          { id: 'eyes', label: 'eyes' },
          { id: 'mouth', label: 'mouth' },
          { id: 'top', label: 'top' },
          { id: 'brows', label: 'brows' },
        ]}
      />

      <div className="fb-grid">
        {tab === 'color' &&
          FACE_COLORS.filter((c) => shown('color', c, value.color)).map((c) => (
            <Tile key={c} label={c} on={value.color === c} price={cost('color', c, value.color)} onPick={() => pick('color', c, value.color, { color: c })}>
              <span className="fb-color" style={{ background: c }} />
            </Tile>
          ))}
        {tab === 'shape' &&
          BLOB_KINDS.filter((b) => shown('shape', b, value.blob)).map((b) => (
            <Tile key={b} label={b} on={value.blob === b} price={cost('shape', b, value.blob)} onPick={() => pick('shape', b, value.blob, { blob: b })}>
              {face({ ...value, blob: b })}
            </Tile>
          ))}
        {tab === 'eyes' &&
          EYE_KINDS.filter((e) => shown('eyes', e, value.eyes)).map((e) => (
            <Tile key={e} label={e} on={value.eyes === e} price={cost('eyes', e, value.eyes)} onPick={() => pick('eyes', e, value.eyes, { eyes: e })}>
              {face({ ...value, eyes: e })}
            </Tile>
          ))}
        {tab === 'mouth' &&
          MOUTH_KINDS.filter((m) => shown('mouth', m, value.mouth)).map((m) => (
            <Tile key={m} label={m} on={value.mouth === m} price={cost('mouth', m, value.mouth)} onPick={() => pick('mouth', m, value.mouth, { mouth: m })}>
              {face({ ...value, mouth: m })}
            </Tile>
          ))}
        {tab === 'top' &&
          TOP_KINDS.filter((t) => shown('top', t, value.top)).map((t) => (
            <Tile key={'top' + t} label={t} on={value.top === t} price={cost('top', t, value.top)} onPick={() => pick('top', t, value.top, { top: t })}>
              {zoom({ ...value, top: t })}
            </Tile>
          ))}
        {tab === 'brows' && (
          <>
            {BROW_KINDS.map((b) => (
              <Tile key={'brow' + b} label={b ?? 'no brows'} on={value.brows === b} onPick={() => set({ brows: b })}>
                {zoom({ ...value, brows: b, eyes: value.eyes === 'three' && b ? 'pair' : value.eyes })}
              </Tile>
            ))}
            <Tile label="blush" on={value.blush} onPick={() => set({ blush: !value.blush })}>
              {face({ ...value, blush: true })}
              <span className="fb-tag">blush</span>
            </Tile>
            <Tile label="freckles" on={value.freckles} onPick={() => set({ freckles: !value.freckles })}>
              {face({ ...value, freckles: true })}
              <span className="fb-tag">freckles</span>
            </Tile>
          </>
        )}
      </div>

      <button type="button" className="fb-done" onClick={onDone}>
        done
      </button>
    </div>
  )
}
