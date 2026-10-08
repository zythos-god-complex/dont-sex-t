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
 * header when the other person changed it): a circular wipe, a shockwave ring and a name sticker.
 */
export function ThemeBackground({ themeId, host }: { themeId: string; host: RefObject<HTMLDivElement | null> }) {
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
    setReveal({ id: themeId, x, y, key: ++seq.current })
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
          onAnimationComplete={() => {
            setBase(reveal.id)
            setReveal(null)
          }}
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
            <motion.div
              className="theme-sticker"
              style={{ background: n.accent, color: n.accentInk }}
              initial={{ scale: 0.3, rotate: -18, opacity: 0, y: 20 }}
              animate={{ scale: [0.3, 1.12, 1], rotate: [-18, 4, -3], opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.55, ease: 'easeOut' }}
            >
              {n.name}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
