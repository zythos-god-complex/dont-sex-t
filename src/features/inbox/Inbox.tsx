import { Link, useLocation, useRoute } from 'wouter'
import { Flame, Melt } from '../../ui/Flame'
import { AnimatePresence, motion } from 'motion/react'
import { useConversations, useIsOnline, useMe, useNow, usePeerTyping } from '../../lib/hooks'
import { messagePreview, relTime } from '../../lib/format'
import type { Conversation } from '../../lib/types'
import { Aura } from '../../ui/Aura'
import { useFlairFor } from '../../ui/flair'
import { GoofyFace } from '../../ui/GoofyFace'
import { Badge, TypingDots, spring } from '../../ui/kit'
import { IconBack, IconPin } from '../../ui/icons'
import { useRef, useState } from 'react'
import { togglePin, usePins } from './pins'

export type InboxProps = { variant: 'screen' | 'rail' }

function Row({ c, active, now, meId, pinned }: { c: Conversation; active: boolean; now: number; meId: string | null; pinned: boolean }) {
  const [, nav] = useLocation()
  const [nope, setNope] = useState(0)
  // long press pins / unpins; a full set of pins makes the row shake instead
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null)
  const down = (e: React.PointerEvent) => {
    const st = { x: e.clientX, y: e.clientY, fired: false, t: setTimeout(() => {
      st.fired = true
      if (togglePin(c.id)) navigator.vibrate?.(14)
      else {
        navigator.vibrate?.([10, 40, 10])
        setNope((n) => n + 1)
      }
    }, 450) }
    press.current = st
  }
  const cancel = () => press.current && clearTimeout(press.current.t)
  const move = (e: React.PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancel()
  }
  const hide = useMe()?.show_status === false || c.peer.show_status === false
  const online = useIsOnline(c.peer.id) && !hide
  const typing = usePeerTyping(c.id)
  const unread = c.unread > 0
  const when = c.last_message?.created_at ?? c.last_message_at ?? c.created_at
  const fl = useFlairFor(c.peer.username)
  const aura = fl?.aura
  const plate = !!aura && aura !== 'none'
  return (
    <motion.button
      layout="position"
      transition={spring}
      className={'row-item' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '') + (pinned ? ' is-pinned' : '') + (plate ? ' has-aura' : '')}
      animate={nope ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
      key={'n' + nope}
      onPointerDown={down}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={move}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (press.current?.fired) return
        nav('/dm/' + encodeURIComponent(c.peer.username))
      }}
    >
      {plate && <Aura id={aura} />}
      <GoofyFace name={c.peer.username} size={50} presence={online ? 'online' : null} />
      <span className="row-main">
        <span className="row-name ellipsis">{c.peer.username}{fl && <i className="vchk" aria-label="verified" />}<Flame convId={c.id} /></span>
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
        <Melt convId={c.id} />
          <span className="row-time tnum">
          {pinned && <IconPin size={13} filled className="row-pin" />}
          {relTime(when, now)}
        </span>
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
  const pins = usePins((s) => s.ids)
  const all = convs.filter((c) => c.last_message || c.peer.username.toLowerCase() === activeName || pins.includes(c.id))
  const list = [...pins.map((id) => all.find((c) => c.id === id)).filter((c): c is Conversation => !!c), ...all.filter((c) => !pins.includes(c.id))]

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
            {variant !== 'rail' && (
              <div className="empty-acts">
                <Link href="/" className="empty-act is-ink">
                  find someone
                </Link>
              </div>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {list.map((c) => (
              <Row key={c.id} c={c} now={now} meId={me?.id ?? null} pinned={pins.includes(c.id)} active={c.peer.username.toLowerCase() === activeName} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
