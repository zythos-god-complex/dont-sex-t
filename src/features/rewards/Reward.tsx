// Daily check-in: the first open of the day earns a streak freeze (up to 2 saved).
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { create } from 'zustand'
import { IconFlame } from '../../ui/icons'
import { usePulse } from '../../lib/pulse'

export const useReward = create<{ freezes: number; show: boolean }>(() => ({ freezes: 0, show: false }))

export function DailyReward() {
  const show = useReward((s) => s.show)
  const freezes = useReward((s) => s.freezes)
  // a freeze only means something once you have a streak to save
  const streaky = usePulse((p) => Object.values(p.streaks).some((x) => x && x.n > 0))
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => useReward.setState({ show: false }), 3600)
    return () => clearTimeout(t)
  }, [show])
  return (
    <AnimatePresence>
      {show && streaky && (
        <motion.button type="button" className="reward" onClick={() => useReward.setState({ show: false })} initial={{ y: -40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -40, opacity: 0 }}>
          <span className="reward-ico">
            <IconFlame size={20} />
          </span>
          <span>
            <b>streak freeze +1</b>
            <small>{freezes} saved</small>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
