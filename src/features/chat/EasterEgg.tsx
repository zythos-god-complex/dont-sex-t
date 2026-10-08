import { useId } from 'react'
import { motion } from 'motion/react'
import { GoofyFace } from '../../ui/GoofyFace'
import { FACE_PALETTE } from '../../ui/face'

const EGG = 'M50 4C78 4 94 50 94 74C94 100 74 116 50 116C26 116 6 100 6 74C6 50 22 4 50 4Z'
const TOP = '0,0 100,0 100,62 88,70 76,60 64,70 52,60 40,70 28,60 16,70 0,62'
const BOTTOM = '0,62 16,70 28,60 40,70 52,60 64,70 76,60 88,70 100,62 100,120 0,120'

function EggHalf({ clip, id }: { clip: string; id: string }) {
  return (
    <svg viewBox="0 0 100 120" className="egg-svg" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <polygon points={clip} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <path d={EGG} fill="#FFF6E0" stroke="#17131F" strokeWidth={3.5} />
        <circle cx="32" cy="38" r="6" fill="#FF9ECF" />
        <circle cx="66" cy="30" r="4.5" fill="#5BC0FF" />
        <circle cx="70" cy="58" r="7" fill="#B6E35A" />
        <circle cx="28" cy="80" r="6.5" fill="#FFC83D" />
        <circle cx="62" cy="92" r="5.5" fill="#C69CFF" />
        <circle cx="48" cy="62" r="4" fill="#FF8A3D" />
      </g>
    </svg>
  )
}

const BITS = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.2
  const r = 120 + (i % 5) * 26
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.85 - 30, c: FACE_PALETTE[i % FACE_PALETTE.length], s: 8 + (i % 4) * 3, round: i % 3 !== 0 }
})

/** "double send" easter egg: an egg wobbles, cracks, and your face pops out. */
export function EasterEgg({ me }: { me: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <motion.div className="egg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      <div className="egg-stage">
        {BITS.map((b, i) => (
          <motion.span
            key={i}
            className="egg-bit"
            style={{ background: b.c, width: b.s, height: b.s, borderRadius: b.round ? '50%' : 3 }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{ x: b.x, y: [0, b.y, b.y + 90], scale: [0, 1.2, 0.8], opacity: [1, 1, 0], rotate: 220 }}
            transition={{ duration: 1.25, delay: 0.62, ease: 'easeOut' }}
          />
        ))}
        <motion.div className="egg-face" initial={{ scale: 0, y: 30 }} animate={{ scale: 1, y: -16 }} transition={{ delay: 0.58, type: 'spring', stiffness: 420, damping: 11 }}>
          <GoofyFace name={me} size={104} mood="happy" />
        </motion.div>
        <motion.div
          className="egg-wobble"
          initial={{ y: -120, scale: 0.6 }}
          animate={{ y: 0, scale: 1, rotate: [0, -12, 12, -9, 9, 0] }}
          transition={{ y: { type: 'spring', stiffness: 380, damping: 16 }, scale: { duration: 0.25 }, rotate: { duration: 0.5, delay: 0.1 } }}
        >
          <motion.div className="egg-half" initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }} animate={{ x: -70, y: -120, rotate: -55, opacity: 0 }} transition={{ delay: 0.6, duration: 0.7, ease: 'easeOut' }}>
            <EggHalf clip={TOP} id={'eggt' + uid} />
          </motion.div>
          <motion.div className="egg-half" initial={{ y: 0, opacity: 1 }} animate={{ y: 90, rotate: 12, opacity: 0 }} transition={{ delay: 0.6, duration: 0.6, ease: 'easeIn' }}>
            <EggHalf clip={BOTTOM} id={'eggb' + uid} />
          </motion.div>
        </motion.div>
      </div>
      <motion.div className="egg-title" initial={{ scale: 0.4, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ delay: 0.7, type: 'spring', stiffness: 520, damping: 13 }}>
        wow, it's an easter egg
      </motion.div>
      <motion.div className="egg-sub" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.95 }}>
        double send unlocked
      </motion.div>
    </motion.div>
  )
}
