import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { getTheme } from '../../themes/themes'
import { Ambient } from '../../themes/Ambient'

// Where the next theme change should bloom from (set when you tap a swatch).
let pendingOrigin: { x: number; y: number } | null = null
export function setThemeOrigin(x: number, y: number) {
  pendingOrigin = { x, y }
}

const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const DURATION = 0.85

type Reveal = { id: string; x: number; y: number; w: number; h: number; r: number; key: number }

/** Circular wipe from the tap point (CSS keyframes so iOS Safari animates it too) plus two shockwave rings. */
function Bloom({ rv, onDone }: { rv: Reveal; onDone: () => void }) {
  const t = getTheme(rv.id)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    // timers, not animation callbacks: iOS Safari sometimes never reports completion
    const timer = setTimeout(() => done.current(), DURATION * 1000 + 60)
    return () => clearTimeout(timer)
  }, [])
  const vars = { '--x': `${rv.x}px`, '--y': `${rv.y}px`, '--d': `${DURATION}s` } as React.CSSProperties
  return (
    <>
      <div className="wipe" style={{ ...vars, background: t.bg }}>
        <Ambient kind={t.ambient} />
      </div>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="theme-ring"
          style={{ left: rv.x, top: rv.y, borderColor: t.accent }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: 9, opacity: 0 }}
          transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }}
        />
      ))}
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
    const hide = setTimeout(() => setLabel((l) => (l?.key === key ? null : l)), 1600)
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
