import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { ImageMsg } from './image'
import { IconClose } from '../../ui/icons'
import { useMediaSrc } from '../../lib/useMediaSrc'

export function ImageBubble({ img, open, onClose }: { img: ImageMsg; open: boolean; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const src = useMediaSrc(img.url)
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
      <span className={'img-b' + (loaded ? ' is-loaded' : '')} style={{ width, height }}>
        <img src={src} alt="" draggable={false} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} />
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="img-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            >
              <motion.img
                src={src}
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
