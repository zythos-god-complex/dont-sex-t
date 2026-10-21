import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { ImageMsg } from './image'
import { IconClose } from '../../ui/icons'
import { useMediaSrc } from '../../lib/useMediaSrc'

/**
 * View once only: a website can't block screenshots, so this does what it can. The photo goes dark
 * whenever the page loses focus or hides (app switcher, screen recorders that steal focus, desktop
 * snipping tools) and for a moment after a screenshot key combo.
 */
function useShield(on: boolean): boolean {
  const [hide, setHide] = useState(false)
  useEffect(() => {
    if (!on) return
    let t: ReturnType<typeof setTimeout> | undefined
    const flash = () => {
      setHide(true)
      clearTimeout(t)
      t = setTimeout(() => setHide(document.hidden || !document.hasFocus()), 1500)
    }
    const sync = () => setHide(document.hidden || !document.hasFocus())
    const key = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.shiftKey && (e.metaKey || e.key === 'Meta')) || (e.metaKey && e.key === 'Shift')) flash()
    }
    window.addEventListener('blur', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('keydown', key, true)
    window.addEventListener('keyup', key, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('blur', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keyup', key, true)
    }
  }, [on])
  return on && hide
}

export function ImageBubble({ img, open, onClose, blur }: { img: ImageMsg; open: boolean; onClose: () => void; blur?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const src = useMediaSrc(img.url, !blur)
  const shield = useShield(open && !!blur)
  const ratio = img.w && img.h ? img.w / img.h : 1
  // portrait shots stay narrow, panoramas stay short
  const width = Math.round(Math.min(250, Math.max(150, 250 * Math.min(1, ratio * 1.15))))
  const height = Math.round(Math.min(330, Math.max(110, width / ratio)))

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  return (
    <>
      <span className={'img-b' + (loaded ? ' is-loaded' : '') + (blur ? ' is-once' : '')} style={{ width, height }}>
        <img src={src || undefined} alt="" draggable={false} decoding="async" onLoad={() => setLoaded(true)} />
        {blur && <i className="once-badge">1</i>}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className={'img-view' + (blur ? ' is-once' : '') + (shield ? ' is-shield' : '')}
              onContextMenu={blur ? (e) => e.preventDefault() : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            >
              {blur && <i className="img-timer" />}
              {shield && <span className="img-shield">no peeking</span>}
              <motion.img
                src={src || undefined}
                alt=""
                initial={{ scale: 0.7, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                drag="y"
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={(_, i) => Math.abs(i.offset.y) > 110 && onClose()}
                onClick={(e) => e.stopPropagation()}
              />
              <button type="button" className="img-x" aria-label="close" onClick={onClose}>
                <IconClose size={22} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
