import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useMe } from '../../lib/hooks'
import { spring } from '../../ui/kit'
import { coinText, openShop, useShop } from './shop'

/** a goof coin: the brand's sticker gold with a little face */
export function Coin({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={'coin ' + (className ?? '')} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.4" fill="#FFC83D" stroke="#17131F" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="7.3" fill="none" stroke="#E39A12" strokeWidth="1.3" />
      <circle cx="9.7" cy="10.5" r="1.15" fill="#17131F" />
      <circle cx="14.3" cy="10.5" r="1.15" fill="#17131F" />
      <path d="M9.2 13.4 Q12 16 14.8 13.4" fill="none" stroke="#17131F" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 8.4 A6.6 6.6 0 0 1 9.1 5.9" fill="none" stroke="#FFF1C2" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** a padlock whose shackle swings open */
export function Lock({ size = 18, open = false, delay = 0, className }: { size?: number; open?: boolean; delay?: number; className?: string }) {
  return (
    <svg className={'lock-ico ' + (className ?? '')} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <motion.path
        d="M7.6 11.2V8.1a4.4 4.4 0 0 1 8.8 0v3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        style={{ transformBox: 'fill-box', originX: 1, originY: 1 }}
        initial={false}
        animate={open ? { rotate: 34, y: -2.6 } : { rotate: 0, y: 0 }}
        transition={{ delay, type: 'spring', stiffness: 520, damping: 12 }}
      />
      <rect x="5" y="10.6" width="14" height="10" rx="3.2" fill="currentColor" />
      <circle cx="12" cy="15.3" r="1.7" className="lock-hole" />
    </svg>
  )
}

/** a number that rolls to its new value instead of jumping */
export function useTicker(v: number): number {
  const [shown, setShown] = useState(v)
  const from = useRef(v)
  useEffect(() => {
    const a = from.current
    if (a === v) return
    if (Math.abs(v - a) > 20000 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = v
      setShown(v)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const dur = Math.min(1200, 450 + Math.abs(v - a) / 30)
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const cur = Math.round(a + (v - a) * (1 - Math.pow(1 - k, 3)))
      from.current = cur
      setShown(cur)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [v])
  return shown
}

/** header chip: your coins, and the way into the shop */
export function CoinChip() {
  const me = useMe()
  const coins = useShop((s) => (s.loaded ? s.coins : (me?.coins ?? 0)))
  const shown = useTicker(coins)
  const prev = useRef(coins)
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null)
  useEffect(() => {
    const d = coins - prev.current
    prev.current = coins
    if (d !== 0 && Math.abs(d) < 5000) setGain({ n: d, k: Date.now() })
  }, [coins])
  useEffect(() => {
    if (!gain) return
    const t = setTimeout(() => setGain(null), 1400)
    return () => clearTimeout(t)
  }, [gain])
  if (!me) return null
  return (
    <button type="button" className="coin-chip" aria-label={`shop, ${coins} coins`} onClick={() => openShop(coins < 100 ? 'earn' : 'themes')}>
      <motion.span key={gain?.k ?? 0} initial={gain ? { rotate: gain.n > 0 ? -30 : 30, scale: 1.4 } : false} animate={{ rotate: 0, scale: 1 }} transition={spring} className="coin-chip-ico">
        <Coin size={20} />
      </motion.span>
      <span className="tnum">{coinText(shown)}</span>
      <AnimatePresence>
        {gain && (
          <motion.i key={gain.k} className={'coin-gain tnum' + (gain.n < 0 ? ' is-spend' : '')} initial={{ y: 0, opacity: 0 }} animate={{ y: -22, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            {gain.n > 0 ? '+' : '-'}
            {Math.abs(gain.n)}
          </motion.i>
        )}
      </AnimatePresence>
    </button>
  )
}
