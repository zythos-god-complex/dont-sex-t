import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { GoofyFace } from '../../ui/GoofyFace'

/** Polls /version.json; when a newer build is live, offers a refresh with what changed. */
export default function UpdateBanner() {
  const [notes, setNotes] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const f = () => setTyping(document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT')
    document.addEventListener('focusin', f)
    document.addEventListener('focusout', () => setTimeout(f, 0))
    return () => document.removeEventListener('focusin', f)
  }, [])
  useEffect(() => {
    if (import.meta.env.DEV) return
    let stop = false
    const check = async () => {
      try {
        const r = await fetch('/version.json', { cache: 'no-store' })
        const v = (await r.json()) as { id?: string; notes?: string }
        if (!stop && v.id && v.id !== __BUILD_ID__) setNotes(v.notes || 'fresh stuff')
      } catch {
        /* offline */
      }
    }
    const t = setInterval(check, 60000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    void check()
    return () => {
      stop = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return (
    <AnimatePresence>
      {notes && !hidden && !typing && (
        <motion.div
          className="upd"
          initial={{ y: -120, opacity: 0, rotate: -4 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        >
          <GoofyFace name="update.goof" size={44} mood="happy" />
          <div className="upd-main">
            <b>new update dropped</b>
            <span>{notes}</span>
          </div>
          <div className="upd-actions">
            <button type="button" className="upd-go" onClick={() => location.reload()}>
              refresh
            </button>
            <button type="button" className="upd-x" aria-label="later" onClick={() => setHidden(true)}>
              later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
