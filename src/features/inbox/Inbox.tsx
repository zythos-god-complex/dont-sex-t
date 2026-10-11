import { Link, useLocation, useRoute } from 'wouter'
import { Sheet } from '../../ui/kit'
import { clearChat, removeChat, respondRequest } from '../../lib/engine'
import { create } from 'zustand'
import { Flame, Melt } from '../../ui/Flame'
import { AnimatePresence, motion } from 'motion/react'
import { useConversations, useIsOnline, useMe, useNow, usePeerTyping } from '../../lib/hooks'
import { messagePreview, relTime } from '../../lib/format'
import type { Conversation } from '../../lib/types'
import { Aura } from '../../ui/Aura'
import { useFlairFor } from '../../ui/flair'
import { GoofyFace } from '../../ui/GoofyFace'
import { Badge, TypingDots, spring } from '../../ui/kit'
import { peek } from '../profile/peek'
import { IconPin } from '../../ui/icons'
import { MeButton } from '../shell/MeSheet'
import { useRef, useState } from 'react'
import { togglePin, usePins } from './pins'

export type InboxProps = { variant: 'screen' | 'rail' }

function Row({ c, active, now, meId, pinned }: { c: Conversation; active: boolean; now: number; meId: string | null; pinned: boolean }) {
  const [, nav] = useLocation()
  // long press opens the same pin / delete choices as chat info
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null)
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.row-acts')) return
    const st = { x: e.clientX, y: e.clientY, fired: false, t: setTimeout(() => {
      st.fired = true
      navigator.vibrate?.(14)
      useRowMenu.setState({ c })
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
  const asking = c.status === 'pending' && !!c.requester && c.requester !== meId
  const when = c.last_message?.created_at ?? c.last_message_at ?? c.created_at
  const fl = useFlairFor(c.peer.username)
  const aura = fl?.aura
  const plate = !!aura && aura !== 'none'
  const open = () => nav('/dm/' + encodeURIComponent(c.peer.username))
  return (
    <motion.div
      layout="position"
      transition={spring}
      role="button"
      tabIndex={0}
      className={'row-item' + (active ? ' is-active' : '') + (unread ? ' is-unread' : '') + (pinned ? ' is-pinned' : '') + (plate ? ' has-aura' : '') + (asking ? ' is-ask' : '')}
      onPointerDown={down}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerMove={move}
      onContextMenu={(e) => {
        e.preventDefault()
        useRowMenu.setState({ c })
      }}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      onClick={(e) => {
        if (press.current?.fired || (e.target as HTMLElement).closest('.row-acts, .row-face')) return
        open()
      }}
    >
      {plate && <Aura id={aura} />}
      <span
        className="row-face"
        onClick={() => peek(c.peer.username, c.peer.id)}
      >
        <GoofyFace name={c.peer.username} size={50} presence={online ? 'online' : null} />
      </span>
      <span className="row-main">
        <span className="row-name">
          <span className="ellipsis">{c.peer.username}</span>
          {fl && <i className="vchk" aria-label="verified" />}
          <Flame convId={c.id} />
        </span>
        <span className={'row-preview ellipsis' + (typing ? ' is-typing' : '') + (asking ? ' is-ask' : '')}>
          {typing ? (
            <>
              <TypingDots /> typing...
            </>
          ) : (
            messagePreview(c.last_message, meId) || 'say hi'
          )}
        </span>
      </span>
      {asking ? (
        <span className="row-acts">
          <button type="button" className="row-no" onClick={() => void respondRequest(c.id, false)}>
            nah
          </button>
          <button type="button" className="row-yes" onClick={() => void respondRequest(c.id, true)}>
            accept
          </button>
        </span>
      ) : (
        <span className="row-side">
          <Melt convId={c.id} />
          <span className="row-time tnum">
            {pinned && <IconPin size={13} filled className="row-pin" />}
            {relTime(when, now)}
          </span>
          <Badge n={c.unread} />
        </span>
      )}
    </motion.div>
  )
}

// long press on a chat: same choices and words as chat info
const useRowMenu = create<{ c: Conversation | null }>(() => ({ c: null }))

function RowMenu() {
  const c = useRowMenu((s) => s.c)
  const pins = usePins((s) => s.ids)
  const [ask, setAsk] = useState(false)
  const last = useRef(c)
  if (c) last.current = c
  const close = () => {
    useRowMenu.setState({ c: null })
    setAsk(false)
  }
  const cur = last.current
  if (!cur) return null
  const pinned = pins.includes(cur.id)
  return (
    <Sheet open={!!c} onClose={close} label={'chat with ' + cur.peer.username}>
      <div className="rm-menu">
        <button
          type="button"
          className="rm-head"
          onClick={() => {
            close()
            setTimeout(() => peek(cur.peer.username, cur.peer.id), 180)
          }}
        >
          <GoofyFace name={cur.peer.username} size={44} />
          <span className="rm-name ellipsis">{cur.peer.username}</span>
        </button>
        <button
          type="button"
          className="rm-btn"
          onClick={() => {
            togglePin(cur.id)
            close()
          }}
        >
          <IconPin size={20} filled={pinned} />
          {pinned ? 'unpin chat' : 'pin chat'}
        </button>
        {!ask ? (
          <button type="button" className="rm-btn is-red" onClick={() => setAsk(true)}>
            delete chat
          </button>
        ) : (
          <div className="del-ask">
            <b>delete chat?</b>
            <button
              type="button"
              className="del-opt"
              onClick={() => {
                void removeChat(cur.id)
                close()
              }}
            >
              for me
            </button>
            <button
              type="button"
              className="del-opt is-both"
              onClick={() => {
                void clearChat(cur.id, true)
                close()
              }}
            >
              for both
            </button>
            <button type="button" className="del-cancel" onClick={() => setAsk(false)}>
              cancel
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export default function Inbox({ variant }: InboxProps) {
  const me = useMe()
  const convs = useConversations()
  const now = useNow(30000)
  const [inChat, params] = useRoute('/dm/:username')
  const activeName = inChat ? decodeURIComponent(params!.username).toLowerCase() : null
  const pins = usePins((s) => s.ids)
  const shown = convs.filter((c) => c.last_message || c.peer.username.toLowerCase() === activeName || pins.includes(c.id))
  const isFriend = (c: Conversation) => !!c.my_friend && !!c.peer_friend
  const asking = (c: Conversation) => c.status === 'pending' && !!c.requester && c.requester !== me?.id
  // pinned first inside each section, then most recent (the list already comes newest first)
  const order = (l: Conversation[]) => [...l.filter((c) => pins.includes(c.id)), ...l.filter((c) => !pins.includes(c.id))]
  const sections: [string, Conversation[]][] = [
    ['requests', shown.filter(asking)],
    ['friends', order(shown.filter((c) => !asking(c) && isFriend(c)))],
    ['strangers', order(shown.filter((c) => !asking(c) && !isFriend(c)))],
  ]

  return (
    <div className={'inbox inbox-' + variant}>
      {variant === 'screen' && (
        <header className="m-head">
          <h1 className="m-title is-left">chats</h1>
          <div className="m-head-actions">
            <MeButton />
          </div>
        </header>
      )}
      <div className="inbox-list scroll-y">
        {shown.length === 0 ? (
          <div className="empty empty-sm">
            <GoofyFace name="lonely.potato" size={variant === 'rail' ? 72 : 110} mood="neutral" />
            <p className="empty-title">no chats yet</p>
            {variant !== 'rail' && (
              <div className="empty-acts">
                <Link href="/" className="empty-act is-ink">
                  find someone
                </Link>
              </div>
            )}
          </div>
        ) : (
          sections.map(([label, list]) =>
            list.length ? (
              <section key={label} className={'inbox-sec is-' + label}>
                <h3 className="inbox-label">
                  {label}
                  {label === 'requests' && <i className="inbox-n tnum">{list.length}</i>}
                </h3>
                <AnimatePresence initial={false}>
                  {list.map((c) => (
                    <Row key={c.id} c={c} now={now} meId={me?.id ?? null} pinned={pins.includes(c.id)} active={c.peer.username.toLowerCase() === activeName} />
                  ))}
                </AnimatePresence>
              </section>
            ) : null,
          )
        )}
      </div>
      <RowMenu />
    </div>
  )
}
