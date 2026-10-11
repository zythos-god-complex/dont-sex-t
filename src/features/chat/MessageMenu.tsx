// One menu for every message: react, reply, copy, share, unsend. Opens from a tap, a long press or a right click.
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { IconSmilePlus } from '../../ui/icons'

export const REACTIONS = ['❤️', '😂', '💀', '😮', '😢', '👍']
export type MenuAction = { id: string; label: string; ico: ReactNode; danger?: boolean; go: () => void }

export function MessageMenu({ anchor, mine, current, onReact, onMore, actions, onClose }: { anchor: DOMRect; mine: boolean; current?: string; onReact: (e: string) => void; onMore: () => void; actions: MenuAction[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  // under the bubble when it fits, above it otherwise, centered as a last resort
  useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 220
    const vh = window.innerHeight
    const below = anchor.bottom + 8
    const above = anchor.top - 8 - h
    const top = below + h <= vh - 12 ? below : above >= 12 ? above : Math.max(12, (vh - h) / 2)
    setPos(mine ? { top, right: Math.max(10, window.innerWidth - anchor.right) } : { top, left: Math.max(10, anchor.left) })
  }, [anchor, mine])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', k)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  return createPortal(
    // taps in here are not chat taps (confetti counting) and not bubble taps
    <div className="mm" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <motion.div className="mm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        ref={box}
        className={'mm-box' + (mine ? ' is-mine' : '')}
        style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 560, damping: 32 }}
      >
        <div className="mm-reacts">
          {REACTIONS.map((e) => (
            <motion.button key={e} type="button" className={'mm-r' + (e === current ? ' is-on' : '')} whileTap={{ scale: 1.35 }} onClick={() => onReact(e)}>
              {e}
            </motion.button>
          ))}
          <button type="button" className="mm-r mm-more" aria-label="more emojis" onClick={onMore}>
            <IconSmilePlus size={22} />
          </button>
        </div>
        {actions.length > 0 && (
          <div className="mm-acts">
            {actions.map((a) => (
              <button key={a.id} type="button" className={'mm-act' + (a.danger ? ' is-danger' : '')} onClick={a.go}>
                <span>{a.label}</span>
                {a.ico}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  )
}
