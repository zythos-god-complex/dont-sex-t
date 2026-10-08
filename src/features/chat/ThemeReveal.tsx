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

type Reveal = { id: string; x: string; y: string; key: number }

/**
 * Chat background with a theme change that blooms out of the tapped swatch (or drops from the
 * header when the other person changed it): a circular wipe, shockwave rings and a name pill that drops in under the header.
 */
export function ThemeBackground({ themeId, host, onPhase }: { themeId: string; host: RefObject<HTMLDivElement | null>; onPhase?: (on: boolean) => void }) {
  const [label, setLabel] = useState<{ name: string; key: number } | null>(null)
  const [base, setBase] = useState(themeId)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (themeId === base && !reveal) return
    if (reveal?.id === themeId) return
    if (reduce) {
      setBase(themeId)
      setReveal(null)
      return
    }
    let x = '50%'
    let y = '0%'
    const r = host.current?.getBoundingClientRect()
    if (pendingOrigin && r) {
      x = `${((pendingOrigin.x - r.left) / r.width) * 100}%`
      y = `${((pendingOrigin.y - r.top) / r.height) * 100}%`
    }
    pendingOrigin = null
    if (reveal) setBase(reveal.id)
    const key = ++seq.current
    setReveal({ id: themeId, x, y, key })
    onPhase?.(true)
    setLabel({ name: getTheme(themeId).name, key })
    // timers, not animation callbacks: iOS Safari sometimes never reports completion
    const done = setTimeout(() => {
      setBase(themeId)
      setReveal((r) => (r?.key === key ? null : r))
      onPhase?.(false)
    }, 920)
    const hide = setTimeout(() => setLabel((l) => (l?.key === key ? null : l)), 1600)
    return () => {
      clearTimeout(done)
      clearTimeout(hide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId])

  const b = getTheme(base)
  const n = reveal ? getTheme(reveal.id) : null
  return (
    <>
      <div className="chat-bg" style={{ background: b.bg }}>
        <Ambient kind={b.ambient} />
      </div>
      {reveal && n && (
        <motion.div
          key={reveal.key}
          className="chat-bg"
          style={{ background: n.bg }}
          initial={{ clipPath: `circle(0% at ${reveal.x} ${reveal.y})` }}
          animate={{ clipPath: `circle(150% at ${reveal.x} ${reveal.y})` }}
          transition={{ duration: 0.85, ease: [0.7, 0, 0.2, 1] }}
        >
          <Ambient kind={n.ambient} />
        </motion.div>
      )}
      <AnimatePresence>
        {reveal && n && (
          <motion.div key={'fx' + reveal.key} className="theme-fx" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                className="theme-ring"
                style={{ left: reveal.x, top: reveal.y, borderColor: n.accent }}
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 9, opacity: 0 }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {label && (
          <motion.div
            key={label.key}
            className="theme-label"
            style={{ background: getTheme(themeId).accent, color: getTheme(themeId).accentInk }}
            initial={{ y: -24, opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', transition: { delay: 0.3, type: 'spring', stiffness: 420, damping: 22 } }}
            exit={{ y: -12, opacity: 0, scale: 0.92, filter: 'blur(4px)', transition: { duration: 0.28 } }}
          >
            {label.name}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
