import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { getTheme } from '../../themes/themes'
import { Ambient } from '../../themes/Ambient'

// Where the next theme change should bloom from (set when you tap a swatch).
let pendingOrigin: { x: number; y: number } | null = null
export function setThemeOrigin(x: number, y: number) {
  pendingOrigin = { x, y }
}

const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const DURATION = 1.05
const EASE = [0.76, 0, 0.24, 1] as const // expo in-out: slow start, fast middle, feather landing

type Reveal = { id: string; x: number; y: number; w: number; h: number; r: number; key: number }

/** The expanding liquid circle. Pure transforms (mask scales up, content counter-scales), so it stays 60fps on phones. */
function Bloom({ rv, onDone }: { rv: Reveal; onDone: () => void }) {
  const t = getTheme(rv.id)
  const s = useMotionValue(0.0005)
  const inv = useTransform(s, (v) => 1 / Math.max(v, 0.0005))
  const glow = useTransform(s, [0, 0.15, 0.8, 1], [0, 0.55, 0.45, 0])
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const c = animate(s, 1, { duration: DURATION, ease: EASE })
    // timers, not animation callbacks: iOS Safari sometimes never reports completion
    const timer = setTimeout(() => done.current(), DURATION * 1000 + 60)
    return () => {
      c.stop()
      clearTimeout(timer)
    }
  }, [s])
  const d = rv.r * 2
  return (
    <>
      <motion.div className="bloom" style={{ left: rv.x - rv.r, top: rv.y - rv.r, width: d, height: d, scale: s }}>
        <motion.div
          className="bloom-inner"
          style={{ left: rv.r - rv.x, top: rv.r - rv.y, width: rv.w, height: rv.h, background: t.bg, scale: inv, transformOrigin: `${rv.x}px ${rv.y}px` }}
        >
          <Ambient kind={t.ambient} />
        </motion.div>
      </motion.div>
      <motion.div
        className="bloom-edge"
        style={{ left: rv.x - rv.r, top: rv.y - rv.r, width: d, height: d, scale: s, opacity: glow, color: t.accent }}
      />
    </>
  )
}

/**
 * Chat background. A theme change blooms out of the tapped swatch (or pours down from the header
 * when the other person changed it) as a soft-edged liquid circle while the chat breathes back.
 */
export function ThemeBackground({ themeId, host, onPhase }: { themeId: string; host: RefObject<HTMLDivElement | null>; onPhase?: (on: boolean) => void }) {
  const [base, setBase] = useState(themeId)
  const [rv, setRv] = useState<Reveal | null>(null)
  const [label, setLabel] = useState<{ name: string; key: number } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (themeId === (rv?.id ?? base)) return
    const el = host.current
    if (reduce || !el) {
      setBase(themeId)
      setRv(null)
      return
    }
    const b = el.getBoundingClientRect()
    let x = b.width / 2
    let y = 0
    if (pendingOrigin) {
      x = Math.min(b.width, Math.max(0, pendingOrigin.x - b.left))
      y = Math.min(b.height, Math.max(0, pendingOrigin.y - b.top))
    }
    pendingOrigin = null
    const r = Math.hypot(Math.max(x, b.width - x), Math.max(y, b.height - y)) + 24
    if (rv) setBase(rv.id)
    const key = ++seq.current
    setRv({ id: themeId, x, y, w: b.width, h: b.height, r, key })
    onPhase?.(true)
    setLabel({ name: getTheme(themeId).name, key })
    const hide = setTimeout(() => setLabel((l) => (l?.key === key ? null : l)), 1700)
    return () => clearTimeout(hide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId])

  const b = getTheme(base)
  const t = getTheme(rv?.id ?? base)
  return (
    <>
      <div className="chat-bg" style={{ background: b.bg }}>
        <Ambient kind={b.ambient} />
      </div>
      {rv && (
        <div className="chat-bg bloom-host">
          <Bloom
            key={rv.key}
            rv={rv}
            onDone={() => {
              setBase(rv.id)
              setRv(null)
              onPhase?.(false)
            }}
          />
        </div>
      )}
      <AnimatePresence>
        {label && (
          <motion.div
            key={label.key}
            className="theme-label"
            style={{ background: t.accent, color: t.accentInk }}
            initial={{ y: -24, opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { delay: 0.45, type: 'spring', stiffness: 420, damping: 22 } }}
            exit={{ y: -12, opacity: 0, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.28 } }}
          >
            {label.name}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
