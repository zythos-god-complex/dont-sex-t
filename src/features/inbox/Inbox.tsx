import { Link, useLocation, useRoute } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useConversations, useIsOnline, useMe, useNow, usePeerTyping } from '../../lib/hooks'
import { messagePreview, relTime } from '../../lib/format'
import type { Conversation } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Badge, TypingDots, spring } from '../../ui/kit'
import { IconBack } from '../../ui/icons'

export type InboxProps = { variant: 'screen' | 'rail' }

function Row({ c, active, now, meId }: { c: Conversation; active: boolean; now: number; meId: string | null }) {
  const [, nav] = useLocation()
  const hide = useMe()?.show_status === false || c.peer.show_status === false
  const online = useIsOnline(c.peer.id) && !hide
  const typing = usePeerTyping(c.id)
  const unread = c.unread > 0
  const when = c.last_message?.created_at ?? c.last_message_at ?? c.created_at
  return (
    <motion.button
      layout="position"
      transition={spring}
      className={'row-item' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '')}
      onClick={() => nav('/dm/' + encodeURIComponent(c.peer.username))}
    >
      <GoofyFace name={c.peer.username} size={50} presence={online ? 'online' : null} />
      <span className="row-main">
        <span className="row-name ellipsis">{c.peer.username}</span>
        <span className={'row-preview ellipsis' + (typing ? ' is-typing' : '')}>
          {typing ? (
            <>
              <TypingDots /> typing...
            </>
          ) : (
            c.status === 'pending' && c.requester && c.requester !== meId ? (
              <b className="row-req">wants to chat</b>
            ) : (
              messagePreview(c.last_message, meId) || 'say hi'
            )
          )}
        </span>
      </span>
      <span className="row-side">
        <span className="row-time tnum">{relTime(when, now)}</span>
        <Badge n={c.unread} />
      </span>
    </motion.button>
  )
}

export default function Inbox({ variant }: InboxProps) {
  const me = useMe()
  const convs = useConversations()
  const now = useNow(30000)
  const [inChat, params] = useRoute('/dm/:username')
  const activeName = inChat ? decodeURIComponent(params!.username).toLowerCase() : null
  const list = convs.filter((c) => c.last_message || c.peer.username.toLowerCase() === activeName)

  return (
    <div className={'inbox inbox-' + variant}>
      {variant === 'screen' && (
        <header className="m-head">
          <Link href="/" className="icon-btn" aria-label="back">
            <IconBack size={26} />
          </Link>
          <h1 className="m-title">dms</h1>
          <span className="icon-btn-spacer" />
        </header>
      )}
      <div className="inbox-list scroll-y">
        {list.length === 0 ? (
          <div className="empty empty-sm">
            <GoofyFace name="lonely.potato" size={variant === 'rail' ? 72 : 110} mood="neutral" />
            <p className="empty-title">no dms yet</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {list.map((c) => (
              <Row key={c.id} c={c} now={now} meId={me?.id ?? null} active={c.peer.username.toLowerCase() === activeName} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
