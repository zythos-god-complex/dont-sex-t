import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { badgeCount } from '../lib/format'

export const spring = { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.8 }
export const softSpring = { type: 'spring' as const, stiffness: 380, damping: 36 }

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }} aria-label="GoofyAhhTalk">
      <span>goofy</span>
      <span className="wordmark-ahh">ahh</span>
      <span>talk</span>
    </span>
  )
}

export function Badge({ n, className }: { n: number; className?: string }) {
  const prev = useRef(n)
  const [pop, setPop] = useState(0)
  useEffect(() => {
    if (n > prev.current) setPop((p) => p + 1)
    prev.current = n
  }, [n])
  if (n <= 0) return null
  return (
    <motion.span key={pop} className={'badge tnum ' + (className ?? '')} initial={{ scale: pop ? 1.35 : 0.6 }} animate={{ scale: 1 }} transition={spring}>
      {badgeCount(n)}
    </motion.span>
  )
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={'typing-dots ' + (className ?? '')} aria-label="typing">
      <i />
      <i />
      <i />
    </span>
  )
}

export type SegItem<T extends string> = { id: T; label: string; count?: number }

export function Segmented<T extends string>({ items, value, onChange, layoutId }: { items: SegItem<T>[]; value: T; onChange: (v: T) => void; layoutId: string }) {
  return (
    <div className="seg" role="tablist">
      {items.map((it) => {
        const on = it.id === value
        return (
          <button key={it.id} role="tab" aria-selected={on} className={'seg-item' + (on ? ' is-on' : '')} onClick={() => onChange(it.id)}>
            {on && <motion.span layoutId={layoutId} className="seg-pill" transition={spring} />}
            <span className="seg-label">{it.label}</span>
            {it.count !== undefined && <span className="seg-count tnum">{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={'toggle' + (on ? ' is-on' : '')} onClick={() => onChange(!on)}>
      <motion.span className="toggle-knob" layout transition={{ type: 'spring', stiffness: 700, damping: 30 }} />
    </button>
  )
}

export function useIsDesktop(): boolean {
  const q = '(min-width: 960px)'
  const [v, setV] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setV(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return v
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const desktop = useIsDesktop()
  const drag = useDragControls()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose()
  }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          {desktop ? (
            <motion.aside className="panel" role="dialog" aria-label={label} initial={{ x: '104%' }} animate={{ x: 0 }} exit={{ x: '104%' }} transition={softSpring}>
              {children}
            </motion.aside>
          ) : (
            <motion.div
              className="sheet"
              role="dialog"
              aria-label={label}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={softSpring}
              drag="y"
              dragControls={drag}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.9 }}
              onDragEnd={onDragEnd}
            >
              <div className="sheet-grab" onPointerDown={(e) => drag.start(e)}>
                <span />
              </div>
              {children}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
