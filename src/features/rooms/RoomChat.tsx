import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { peek } from '../profile/peek'
import { Ink } from '../../ui/Ink'
import { getDraft, setDraft } from '../../lib/drafts'
import { useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useMe, useNow } from '../../lib/hooks'
import { daySeparator, emojiOnlyCount, linkify, needsSeparator } from '../../lib/format'
import type { Profile } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Badge, Sheet, TypingDots, spring, useIsDesktop } from '../../ui/kit'
import { useBlocks } from '../../lib/engine'
import { useChatScroll } from '../chat/ChatScreen'
import { StickerTray } from '../chat/Tray'
import { IconAlert, IconArrowDown, IconBack, IconClose, IconCopy, IconPlus, IconReply, IconSend, IconTrash, IconUsers } from '../../ui/icons'
import { MessageMenu, type MenuAction } from '../chat/MessageMenu'
import { EMOJI_GROUPS } from '../chat/emojis'
import { getTheme, themeVars } from '../../themes/themes'
import { useThemeMode } from '../../themes/mode'
import { Ambient } from '../../themes/Ambient'
import { goBack } from '../shell/nav'
import { LockedSticker, Sticker } from '../stickers/Sticker'
import { NSFW_STICKERS, displayBody, stickerOf } from '../stickers/stickers'
import { Crew, Faces } from './Crew'
import { PeoplePicker } from './PeoplePicker'
import { addPeople, enterRoom, fetchRoom, leaveRoom, loadOlderRoom, reactRoom, removeRoomMsg, retryRoom, roomPeople, roomTyping, sendRoom, useRooms, type Room, type RoomMsg } from './rooms'

const EMPTY: RoomMsg[] = []
const EMPTY_P: Profile[] = []
const EMPTY_H: { id: string; name: string }[] = []
const group = (a: RoomMsg | undefined, b: RoomMsg | undefined) =>
  !!a && !!b && a.sender_id === b.sender_id && Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < 180000 && !needsSeparator(a, b)

function Bubble({ m, mine, joinPrev, joinNext, mod, fresh, meId, onReply }: { m: RoomMsg; mine: boolean; joinPrev: boolean; joinNext: boolean; mod?: boolean; fresh?: boolean; meId: string | null; onReply: (m: RoomMsg) => void }) {
  const name = m.sender?.username ?? ''
  const stk = stickerOf(m.body)
  const emoji = stk ? 0 : emojiOnlyCount(m.body)
  const big = emoji > 0 && emoji <= 3
  const cls = ['b', mine ? 'mine' : 'theirs', joinPrev ? 'jp' : '', joinNext ? 'jn' : '', big ? 'b-emoji' : '', stk ? 'b-sticker' : ''].join(' ')
  const bubble = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [more, setMore] = useState(false)
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const tapT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastTap = useRef(0)
  const moved = useRef(false)
  const reactions = m.reactions ?? {}
  const mineR = meId ? reactions[meId] : undefined
  const counts = new Map<string, number>()
  for (const e of Object.values(reactions)) counts.set(e, (counts.get(e) ?? 0) + 1)
  const chips = [...counts.entries()]
  const live = !m.state
  const replyName = useRoomName(m.room_id, m.reply?.sender_id ?? '')
  // same as 1:1 chats: tap or hold for the menu, double tap for a heart
  const openMenu = () => {
    press.current = null
    const r = bubble.current?.getBoundingClientRect()
    if (!r || !live) return
    navigator.vibrate?.(10)
    setMenu(r)
  }
  const closeMenu = useCallback(() => setMenu(null), [])
  const cancel = () => {
    if (press.current) clearTimeout(press.current.t)
    press.current = null
  }
  const onDown = (e: React.PointerEvent) => {
    moved.current = false
    if ((e.target as HTMLElement).closest('a, button')) return
    press.current = { t: setTimeout(openMenu, 380), x: e.clientX, y: e.clientY }
  }
  const onMove = (e: React.PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      moved.current = true
      cancel()
    }
  }
  const onUp = (e: React.PointerEvent) => {
    const wasPress = !press.current
    cancel()
    if (moved.current || wasPress || menu || (e.target as HTMLElement).closest('a, button')) return
    const now = Date.now()
    clearTimeout(tapT.current)
    if (now - lastTap.current < 280) {
      lastTap.current = 0
      void reactRoom(m, '❤️')
    } else {
      lastTap.current = now
      tapT.current = setTimeout(openMenu, 290)
    }
  }
  const pick = (e: string) => {
    setMenu(null)
    void reactRoom(m, e)
  }
  const actions: MenuAction[] = [
    { id: 'reply', label: 'reply', ico: <IconReply size={19} />, go: () => (setMenu(null), onReply(m)) },
    ...(!stk ? [{ id: 'copy', label: 'copy', ico: <IconCopy size={19} />, go: () => (setMenu(null), void navigator.clipboard?.writeText(m.body).catch(() => {})) }] : []),
    ...(mod ? [{ id: 'remove', label: 'remove', ico: <IconTrash size={19} />, danger: true, go: () => (setMenu(null), void removeRoomMsg(m)) }] : []),
  ]
  return (
    <>
      {!mine && !joinPrev && <button type="button" className="b-who" onClick={() => peek(name, m.sender_id)}>{name}</button>}
      <motion.div
        data-mid={m.id}
        className={'b-row ' + (mine ? 'mine' : 'theirs') + (joinNext ? ' jn' : '') + (chips.length ? ' has-reacts' : '') + (menu ? ' is-menu' : '')}
        initial={fresh ? { opacity: 0, x: mine ? 14 : -14, y: 8, scale: 0.94 } : false}
        animate={{ opacity: m.state === 'sending' ? 0.7 : 1, x: 0, y: 0, scale: 1 }}
        transition={spring}
      >
        {!mine && <span className="b-face" onClick={() => peek(name, m.sender_id)}>{!joinNext && <GoofyFace name={name} size={28} blink={false} />}</span>}
        <div className="b-wrap">
          <div
            ref={bubble}
            className={cls}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={cancel}
            onPointerLeave={cancel}
            onContextMenu={(e) => {
              e.preventDefault()
              openMenu()
            }}
          >
            {m.reply && (
              <button
                type="button"
                className="b-quote"
                onClick={() => {
                  const el = document.querySelector(`[data-mid="${m.reply!.id}"]`)
                  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  el?.classList.add('flash')
                  setTimeout(() => el?.classList.remove('flash'), 1200)
                }}
              >
                <b>{m.reply.sender_id === meId ? 'you' : replyName}</b>
                <span>{displayBody(m.reply.body)}</span>
              </button>
            )}
            {stk ? (
              NSFW_STICKERS.includes(stk) ? <LockedSticker size={130} /> : <Sticker kind={stk} name={name} size={130} />
            ) : (
              linkify(m.body).map((p, i) =>
                p.href ? (
                  <a key={i} href={p.href} target="_blank" rel="noreferrer noopener">
                    {p.text}
                  </a>
                ) : (
                  <Ink key={i} text={p.text} />
                ),
              )
            )}
          </div>
          {chips.length > 0 && (
            <button type="button" className="b-reacts" onClick={openMenu}>
              {chips.map(([e, n]) => (
                <span key={e} className={e === mineR ? 'is-mine' : ''}>
                  {e}
                  {n > 1 && <small>{n}</small>}
                </span>
              ))}
            </button>
          )}
        </div>
      </motion.div>
      <AnimatePresence>
        {menu && <MessageMenu anchor={menu} mine={mine} current={mineR} onReact={pick} onMore={() => (setMenu(null), setMore(true))} actions={actions} onClose={closeMenu} />}
      </AnimatePresence>
      <Sheet open={more} onClose={() => setMore(false)} label="pick an emoji">
        <div className="emoji-sheet">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.name}>
              <h3 className="settings-label">{g.name}</h3>
              <div className="emoji-grid">
                {g.list.map((e, i) => (
                  <button key={e + i} type="button" className={'emoji-cell' + (e === mineR ? ' is-on' : '')} onClick={() => (setMore(false), pick(e))}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
      {m.state === 'failed' &&
        (m.err === 'blocked' ? (
          <span className="mine-status is-failed">
            <IconAlert size={14} /> not sent
          </span>
        ) : m.err === 'fast' ? (
          <span className="mine-status is-failed">
            <IconAlert size={14} /> too fast
          </span>
        ) : (
          <button className="mine-status is-failed" onClick={() => retryRoom(m.room_id, m.id)}>
            <IconAlert size={14} /> tap to retry
          </button>
        ))}
    </>
  )
}

/** a name for whoever wrote the quoted message, from what this room already loaded */
function useRoomName(roomId: string, userId: string): string {
  return useRooms((s) => s.msgs[roomId]?.find((x) => x.sender_id === userId)?.sender?.username ?? s.people[roomId]?.find((p) => p.id === userId)?.username ?? 'someone')
}

function List({ room, onPeople, onReply }: { room: Room; onPeople: () => void; onReply: (m: RoomMsg) => void }) {
  const me = useMe()
  const now = useNow(60000)
  const all = useRooms((s) => s.msgs[room.id]) ?? EMPTY
  const blocked = useBlocks((b) => b.blocked)
  const blockedBy = useBlocks((b) => b.blockedBy)
  const gone = (id: string) => blocked.includes(id) || blockedBy.includes(id)
  // blocks hold in rooms too: their messages and typing never show
  const msgs = useMemo(() => all.filter((m) => m.kind !== 'removed' && !gone(m.sender_id)), [all, blocked, blockedBy])
  const mod = me?.admin === true && room.kind === 'public'
  const openedAt = useRef(Date.now())
  const [unreadAt] = useState(room.unread)
  const more = useRooms((s) => !!s.more[room.id])
  const typers = useRooms((s) => s.typing[room.id])
  const typing = typers ? Object.entries(typers).filter(([id]) => !gone(id)).map(([, t]) => t) : []
  const people = useRooms((s) => s.people[room.id])
  const herePeople = useRooms((s) => s.herePeople[room.id])
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const mounted = useRef(false)
  const prev = useRef({ first: '', last: '', h: 0 })
  const [far, setFar] = useState(false)
  const [missed, setMissed] = useState(0)
  const first = msgs[0]?.id ?? ''
  const last = msgs[msgs.length - 1]?.id ?? ''
  useChatScroll(scroller, inner, atBottom)
  // the first unread, counted back from the end when the room opened
  const newFrom = useMemo(() => {
    if (!unreadAt) return null
    const theirs = msgs.filter((m) => m.sender_id !== me?.id && !m.state)
    return theirs[Math.max(0, theirs.length - unreadAt)]?.id ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadAt, msgs.length > 0])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const p = prev.current
    if (!mounted.current && msgs.length) {
      mounted.current = true
      const sep = newFrom ? el.querySelector<HTMLElement>('.sep.is-new') : null
      if (sep && el.scrollHeight - sep.offsetTop > el.clientHeight) {
        el.scrollTop = Math.max(0, sep.offsetTop - 70)
        atBottom.current = false
      } else el.scrollTop = el.scrollHeight
    } else if (first !== p.first && last === p.last) el.scrollTop += el.scrollHeight - p.h
    else if (last !== p.last) {
      const lm = msgs[msgs.length - 1]
      if (atBottom.current || lm?.sender_id === me?.id) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      else setMissed((n) => n + 1)
    }
    prev.current = { first, last, h: el.scrollHeight }
  })

  useEffect(() => {
    if (typing.length && atBottom.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [typing.length])

  useEffect(() => {
    const el = top.current
    if (!el || !more) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && void loadOlderRoom(room.id), { root: scroller.current, rootMargin: '300px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, room.id])

  const items: React.ReactNode[] = []
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    if (needsSeparator(msgs[i - 1], m)) items.push(<div key={'sep' + m.id} className="sep">{daySeparator(m.created_at, now)}</div>)
    if (m.id === newFrom) items.push(<div key="new" className="sep is-new">new</div>)
    items.push(<Bubble key={m.id} meId={me?.id ?? null} onReply={onReply} m={m} mine={m.sender_id === me?.id} joinPrev={group(msgs[i - 1], m) && m.id !== newFrom} joinNext={group(m, msgs[i + 1]) && msgs[i + 1]?.id !== newFrom} mod={mod} fresh={Date.parse(m.created_at) > openedAt.current - 5000} />)
  }
  const priv = room.kind === 'private'
  const faces = priv ? (people ?? []).map((p) => p.username) : (herePeople ?? []).filter((p) => !gone(p.id)).map((p) => p.name)

  return (
    <div className="msgs-wrap">
      <div
        className="msgs scroll-y"
        ref={scroller}
        onScroll={() => {
          const el = scroller.current!
          const gap = el.scrollHeight - el.scrollTop - el.clientHeight
          atBottom.current = gap < 90
          if (atBottom.current && missed) setMissed(0)
          const f = gap > el.clientHeight * 0.8
          if (f !== far) setFar(f)
        }}
      >
        <div ref={top} className="msgs-top" />
        {msgs.length === 0 ? (
          <div className="room-empty">
            {faces.length ? <Faces names={faces} size={72} /> : <Crew seed={room.seed} size={150} count={priv && (room.members ?? 3) < 3 ? 2 : 3} />}
            <span className="room-empty-name">{room.name}</span>
            {priv && (
              <button type="button" className="empty-act is-ink" onClick={onPeople}>
                add people
              </button>
            )}
          </div>
        ) : (
          <div className="msgs-inner" ref={inner}>{items}</div>
        )}
        <AnimatePresence>
          {typing.length > 0 && (
            <motion.div className="b-row theirs typing-row" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring}>
              <span className="b-face">
                <GoofyFace name={typing[0].name} size={28} blink={false} />
              </span>
              <span className="b theirs b-typing">
                <TypingDots />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {(far || missed > 0) && (
          <motion.button
            className="jump"
            aria-label="latest messages"
            onClick={() => {
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
              setMissed(0)
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={spring}
          >
            <IconArrowDown size={20} />
            <Badge n={missed} className="jump-badge" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function Composer({ room, replyTo, onClearReply }: { room: Room; replyTo: RoomMsg | null; onClearReply: () => void }) {
  const me = useMe()
  const [text, setText] = useState(() => getDraft('r:' + room.id))
  useEffect(() => setDraft('r:' + room.id, text), [room.id, text])
  const [tray, setTray] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [text])
  useEffect(() => () => roomTyping(room.id, false), [room.id])
  const send = () => {
    const body = text.trim()
    if (!body) return
    void sendRoom(room.id, body, replyTo ? { id: replyTo.id, sender_id: replyTo.sender_id, body: replyTo.body } : null)
    onClearReply()
    setText('')
    ta.current?.focus()
  }
  const has = text.trim().length > 0
  return (
    <div className="composer-wrap">
      <AnimatePresence>
        {replyTo && (
          <motion.div className="reply-bar" initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 8, height: 0 }} transition={spring}>
            <div className="reply-bar-in">
              <IconReply size={18} />
              <div className="reply-bar-text">
                <b>replying to {replyTo.sender_id === me?.id ? 'yourself' : replyTo.sender?.username ?? 'someone'}</b>
                <span>{displayBody(replyTo.body)}</span>
              </div>
              <button type="button" aria-label="cancel reply" onClick={onClearReply}>
                <IconClose size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {tray && (
          <motion.div className="stk-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <div className="stk-tray-in">
              <StickerTray name={me?.username ?? ''} spicy={false} couples={false} onSend={(body) => void sendRoom(room.id, body)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="composer">
        <button
          type="button"
          className={'stk-toggle' + (tray ? ' is-on' : '')}
          aria-label={tray ? 'close' : 'stickers'}
          aria-expanded={tray}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!tray) ta.current?.blur()
            setTray((v) => !v)
          }}
        >
          <IconPlus size={24} />
        </button>
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder="message..."
          aria-label="message"
          maxLength={2000}
          enterKeyHint={fine ? 'send' : 'enter'}
          onFocus={() => setTray(false)}
          onChange={(e) => {
            setText(e.target.value)
            roomTyping(room.id, e.target.value.trim().length > 0)
          }}
          onBlur={() => roomTyping(room.id, false)}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey && fine && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        <motion.button
          className="send"
          aria-label="send"
          disabled={!has}
          animate={{ scale: has ? 1 : 0.85, opacity: has ? 1 : 0.5 }}
          whileTap={{ scale: 0.86 }}
          onPointerDown={(e) => e.preventDefault()}
          onClick={send}
        >
          <IconSend size={20} />
        </motion.button>
      </div>
    </div>
  )
}

function PeopleSheet({ room, open, onClose }: { room: Room; open: boolean; onClose: () => void }) {
  const [, nav] = useLocation()
  const me = useMe()
  const people = useRooms((s) => s.people[room.id]) ?? EMPTY_P
  const herePeople = useRooms((s) => s.herePeople[room.id]) ?? EMPTY_H
  const blocked = useBlocks((b) => b.blocked)
  const blockedBy = useBlocks((b) => b.blockedBy)
  const [picked, setPicked] = useState<Profile[]>([])
  const [leaveArm, setLeaveArm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<'add' | 'leave' | null>(null)
  const priv = room.kind === 'private'
  const hereIds = new Set(herePeople.map((p) => p.id))
  useEffect(() => {
    if (!open) return
    // a fresh open never starts armed
    setLeaveArm(false)
    setErr(null)
    setPicked([])
    if (priv) roomPeople(room.id).catch(() => {})
  }, [open, room.id, priv])
  useEffect(() => {
    if (!leaveArm) return
    const t = setTimeout(() => setLeaveArm(false), 3000)
    return () => clearTimeout(t)
  }, [leaveArm])
  const add = async () => {
    if (!picked.length) return
    setBusy(true)
    setErr(null)
    try {
      await addPeople(room.id, picked.map((p) => p.id))
      setPicked([])
    } catch {
      setErr('add')
    } finally {
      setBusy(false)
    }
  }
  const leave = async () => {
    if (!leaveArm) return setLeaveArm(true)
    try {
      await leaveRoom(room.id)
      onClose()
      nav('/rooms', { replace: true })
    } catch {
      setLeaveArm(false)
      setErr('leave')
    }
  }
  const open2 = (id: string, name: string) => {
    onClose()
    setTimeout(() => peek(name, id), 180)
  }
  const gone = (id: string) => blocked.includes(id) || blockedBy.includes(id)
  // you first, then everyone else; a green dot for whoever is in the room right now
  const rows: { id: string; name: string; here: boolean }[] = priv
    ? [...people].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id)).filter((p) => !gone(p.id)).map((p) => ({ id: p.id, name: p.username, here: hereIds.has(p.id) }))
    : herePeople.filter((p) => !gone(p.id)).sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id)).map((p) => ({ ...p, here: true }))
  return (
    <Sheet open={open} onClose={onClose} label="room">
      <div className="settings">
        <div className="rs-head is-row">
          {priv && people.length ? <Faces names={people.map((p) => p.username)} size={40} /> : <Crew seed={room.seed} size={52} count={3} still />}
          <span className="rs-head-text">
            <span className="rs-title ellipsis">{room.name}</span>
            <span className="room-here">{priv ? `${people.length || room.members || 1} people` : ''}{herePeople.length ? `${priv ? ', ' : ''}${herePeople.length} here` : ''}</span>
          </span>
        </div>
        {rows.length > 0 && <h3 className="settings-label">{priv ? 'people' : 'here now'}</h3>}
        {rows.map((p) =>
          p.id === me?.id ? (
            <span key={p.id} className="rs-user is-me">
              <GoofyFace name={p.name} size={40} presence={p.here ? 'online' : null} />
              <span className="grow ellipsis">{p.name}</span>
              <i className="rs-you">you</i>
            </span>
          ) : (
            <button key={p.id} type="button" className="rs-user" onClick={() => open2(p.id, p.name)}>
              <GoofyFace name={p.name} size={40} presence={p.here ? 'online' : null} />
              <span className="grow ellipsis">{p.name}</span>
            </button>
          ),
        )}
        {priv && (
          <>
            <h3 className="settings-label">add people</h3>
            <PeoplePicker picked={picked} onChange={setPicked} exclude={people.map((p) => p.id)} />
            {picked.length > 0 ? (
              <button type="button" className="rs-go is-sticky" disabled={busy} onClick={() => void add()}>
                {err === 'add' ? 'try again' : `add ${picked.length}`}
              </button>
            ) : (
              <button type="button" className={'rs-leave' + (leaveArm ? ' is-armed' : '')} onClick={() => void leave()}>
                {err === 'leave' ? 'try again' : leaveArm ? 'leave room?' : 'leave room'}
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

function Live({ room }: { room: Room }) {
  const [, nav] = useLocation()
  const desktop = useIsDesktop()
  const [sheet, setSheet] = useState(false)
  const [replyTo, setReplyTo] = useState<RoomMsg | null>(null)
  useEffect(() => setReplyTo(null), [room.id])
  const here = useRooms((s) => s.here[room.id] ?? 0)
  const typers = useRooms((s) => s.typing[room.id])
  const blocked = useBlocks((b) => b.blocked)
  const names = typers ? Object.entries(typers).filter(([id]) => !blocked.includes(id)).map(([, t]) => t.name) : []
  const people = useRooms((s) => s.people[room.id])
  const mode = useThemeMode()
  const theme = getTheme(room.theme, mode)
  useEffect(() => enterRoom(room), [room.id, room.topic])
  useEffect(() => {
    if (room.kind === 'private') roomPeople(room.id).catch(() => {})
  }, [room.id, room.kind])

  const status = names.length ? (
    <span className="st-typing">
      {names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.length} people`} typing
      <TypingDots />
    </span>
  ) : here > 0 ? (
    <span className="room-here">{here} here</span>
  ) : room.kind === 'private' ? (
    `${room.members ?? 1} people`
  ) : null

  return (
    <div className={'chat scheme-' + theme.scheme + ' theme-' + theme.id} style={themeVars(theme)}>
      <div className="chat-bg" style={{ background: theme.bg }}>
        <Ambient kind={theme.ambient} />
      </div>
      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
        <button type="button" className="chat-peer" style={{ textAlign: 'left' }} onClick={() => setSheet(true)}>
          {room.kind === 'private' && people?.length ? <Faces names={people.map((p) => p.username)} size={34} /> : <Crew seed={room.seed} size={52} count={room.kind === 'private' && (room.members ?? 3) < 3 ? 2 : 3} />}
          <div className="chat-peer-text">
            <span className="chat-peer-name ellipsis">{room.name}</span>
            <AnimatePresence mode="wait" initial={false}>
              {status && (
                <motion.span key={names.length ? 't' : 'h'} className={'chat-peer-status' + (names.length ? ' is-typing' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {status}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </button>
        <button className="icon-btn" onClick={() => setSheet(true)} aria-label="people">
          <IconUsers size={24} />
        </button>
      </header>
      <List room={room} onPeople={() => setSheet(true)} onReply={setReplyTo} />
      <Composer room={room} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      <PeopleSheet room={room} open={sheet} onClose={() => setSheet(false)} />
    </div>
  )
}

export default function RoomChat({ id }: { id: string }) {
  const [, nav] = useLocation()
  const desktop = useIsDesktop()
  const room = useRooms((s) => s.rooms[id])
  const [state, setState] = useState<'loading' | 'missing' | 'error'>('loading')
  const [n, setN] = useState(0)
  useEffect(() => {
    setState('loading')
    fetchRoom(id).then((r) => !r && setState('missing'), () => setState('error'))
  }, [id, n])
  if (room) return <Live room={room} />
  return (
    <div className="chat scheme-light" style={themeVars(getTheme('goofy'))}>
      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
      </header>
      <div className="chat-center">
        {state === 'missing' ? (
          <>
            <span className="chat-center-name">room not found</span>
            <button type="button" className="empty-act is-ink" onClick={() => nav('/rooms', { replace: true })}>
              rooms
            </button>
          </>
        ) : state === 'error' ? (
          <button type="button" className="empty-act is-ink" onClick={() => setN((x) => x + 1)}>
            retry
          </button>
        ) : (
          <TypingDots />
        )}
      </div>
    </div>
  )
}
