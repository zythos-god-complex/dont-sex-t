import { useLocation } from 'wouter'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useToasts } from '../../lib/hooks'
import { dismissToast } from '../../lib/engine'
import { GoofyFace } from '../../ui/GoofyFace'
import { spring } from '../../ui/kit'
import { displayBody } from '../stickers/stickers'
import { useStore } from '../../lib/store'

export default function Toasts() {
  const toasts = useToasts()
  const [, nav] = useLocation()
  const convs = useStore((s) => s.conversations)
  const meId = useStore((s) => s.me?.id)
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.slice(-2).map((t) => {
          const c = convs[t.convId]
          const ask = c?.status === 'pending' && c.requester !== meId
          return (
          <motion.button
            key={t.id}
            layout
            className={'toast' + (ask ? ' is-ask' : '')}
            initial={{ y: -80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, transition: { duration: 0.18 } }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.8, bottom: 0.1 }}
            onDragEnd={(_: unknown, i: PanInfo) => {
              if (i.offset.y < -30 || i.velocity.y < -300) dismissToast(t.id)
            }}
            onClick={() => {
              dismissToast(t.id)
              nav('/dm/' + encodeURIComponent(t.username))
            }}
          >
            <GoofyFace name={t.username} size={38} />
            <span className="toast-main">
              <span className="toast-name">
                <span className="ellipsis">{t.username}</span>
                {ask && <i className="toast-tag">new chat</i>}
              </span>
              <span className="toast-body ellipsis">{displayBody(t.body)}</span>
            </span>
          </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
