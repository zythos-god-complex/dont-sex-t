import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { peek } from '../profile/peek'
import { Ink } from '../../ui/Ink'
import { getDraft, setDraft } from '../../lib/drafts'
import { useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useMe, useNow } from '../../lib/hooks'
import { daySeparator, emojiOnlyCount, linkify, needsSeparator } from '../../lib/format'
import type { Profile } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Sheet, TypingDots, spring, useIsDesktop } from '../../ui/kit'
import { IconAlert, IconArrowDown, IconBack, IconSend, IconSticker, IconUsers } from '../../ui/icons'
import { getTheme, themeVars } from '../../themes/themes'
import { useThemeMode } from '../../themes/mode'
import { ModeButton } from '../chat/ChatScreen'
import { Ambient } from '../../themes/Ambient'
import { goBack } from '../shell/nav'
import { LockedSticker, Sticker } from '../stickers/Sticker'
import { NSFW_STICKERS, STICKERS, stickerBody, stickerOf } from '../stickers/stickers'
import { Crew } from './Crew'
import { PeoplePicker } from './PeoplePicker'
import { addPeople, enterRoom, fetchRoom, leaveRoom, loadOlderRoom, removeRoomMsg, retryRoom, roomPeople, roomTyping, sendRoom, useRooms, type Room, type RoomMsg } from './rooms'

const EMPTY: RoomMsg[] = []
const group = (a: RoomMsg | undefined, b: RoomMsg | undefined) =>
  !!a && !!b && a.sender_id === b.sender_id && Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) < 180000 && !needsSeparator(a, b)

function Bubble({ m, mine, joinPrev, joinNext, mod, fresh }: { m: RoomMsg; mine: boolean; joinPrev: boolean; joinNext: boolean; mod?: boolean; fresh?: boolean }) {
  const [arm, setArm] = useState(false)
  const name = m.sender?.username ?? ''
  const stk = stickerOf(m.body)
  const emoji = stk ? 0 : emojiOnlyCount(m.body)
  const big = emoji > 0 && emoji <= 3
  const cls = ['b', mine ? 'mine' : 'theirs', joinPrev ? 'jp' : '', joinNext ? 'jn' : '', big ? 'b-emoji' : '', stk ? 'b-sticker' : ''].join(' ')
  return (
    <>
      {!mine && !joinPrev && <button type="button" className="b-who" onClick={() => peek(name, m.sender_id)}>{name}</button>}
      <motion.div
        className={'b-row ' + (mine ? 'mine' : 'theirs') + (joinNext ? ' jn' : '')}
        initial={fresh ? { opacity: 0, x: mine ? 14 : -14, y: 8, scale: 0.94 } : false}
        animate={{ opacity: m.state === 'sending' ? 0.7 : 1, x: 0, y: 0, scale: 1 }}
        transition={spring}
      >
        {!mine && <span className="b-face" onClick={() => peek(name, m.sender_id)}>{!joinNext && <GoofyFace name={name} size={28} blink={false} />}</span>}
        <div className={cls} onClick={mod && !m.state ? () => setArm((v) => !v) : undefined}>
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
      </motion.div>
      {arm && (
        <button className={'rm-del' + (mine ? ' mine' : '')} onClick={() => void removeRoomMsg(m)}>
          remove
        </button>
      )}
      {m.state === 'failed' && (
        <button className="mine-status is-failed" onClick={() => retryRoom(m.room_id, m.id)}>
          <IconAlert size={14} /> tap to retry
        </button>
      )}
    </>
  )
}

function List({ room }: { room: Room }) {
  const me = useMe()
  const now = useNow(60000)
  const all = useRooms((s) => s.msgs[room.id]) ?? EMPTY
  const msgs = useMemo(() => all.filter((m) => m.kind !== 'removed'), [all])
  const mod = me?.admin === true && room.kind === 'public'
  const openedAt = useRef(Date.now())
  const more = useRooms((s) => !!s.more[room.id])
  const typers = useRooms((s) => s.typing[room.id])
  const typing = typers ? Object.values(typers) : []
  const scroller = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const mounted = useRef(false)
  const prev = useRef({ first: '', last: '', h: 0 })
  const [jump, setJump] = useState(false)
  const first = msgs[0]?.id ?? ''
  const last = msgs[msgs.length - 1]?.id ?? ''

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const p = prev.current
    if (!mounted.current && msgs.length) {
      mounted.current = true
      el.scrollTop = el.scrollHeight
    } else if (first !== p.first && last === p.last) el.scrollTop += el.scrollHeight - p.h
    else if (last !== p.last) {
      const lm = msgs[msgs.length - 1]
      if (atBottom.current || lm?.sender_id === me?.id) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
        setJump(false)
      } else setJump(true)
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
    items.push(<Bubble key={m.id} m={m} mine={m.sender_id === me?.id} joinPrev={group(msgs[i - 1], m)} joinNext={group(m, msgs[i + 1])} mod={mod} fresh={Date.parse(m.created_at) > openedAt.current - 5000} />)
  }

  return (
    <div className="msgs-wrap">
      <div
        className="msgs scroll-y"
        ref={scroller}
        onScroll={() => {
          const el = scroller.current!
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
          if (atBottom.current && jump) setJump(false)
        }}
      >
        <div ref={top} className="msgs-top" />
        {msgs.length === 0 ? (
          <div className="room-empty">
            <Crew seed={room.seed} size={150} count={room.kind === 'private' && (room.members ?? 3) < 3 ? 2 : 3} />
            <span className="room-empty-name">{room.name}</span>
          </div>
        ) : (
          <div className="msgs-inner">{items}</div>
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
        {jump && (
          <motion.button className="jump" onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            new message <IconArrowDown size={15} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function Composer({ room }: { room: Room }) {
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
    void sendRoom(room.id, body)
    setText('')
    ta.current?.focus()
  }
  const has = text.trim().length > 0
  return (
    <div className="composer-wrap">
      <AnimatePresence initial={false}>
        {tray && (
          <motion.div className="stk-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            <div className="stk-tray-in">
              <div className="stk-grid">
                {STICKERS.filter((st) => st.pack !== 'lust').map((st) => (
                  <motion.button
                    key={st.id}
                    type="button"
                    className="stk-pick"
                    aria-label={st.caption}
                    whileTap={{ scale: 0.82 }}
                    onClick={() => {
                      navigator.vibrate?.(8)
                      void sendRoom(room.id, stickerBody(st.id))
                    }}
                  >
                    <Sticker kind={st.id} name={me?.username ?? ''} size={78} />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="composer">
        <button
          type="button"
          className={'stk-toggle' + (tray ? ' is-on' : '')}
          aria-label="stickers"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!tray) ta.current?.blur()
            setTray((v) => !v)
          }}
        >
          <IconSticker size={24} />
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
  const [people, setPeople] = useState<Profile[]>([])
  const [picked, setPicked] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const here = useRooms((s) => s.here[room.id] ?? 0)
  const priv = room.kind === 'private'
  useEffect(() => {
    if (!open || !priv) return
    setPicked([])
    roomPeople(room.id).then(setPeople).catch(() => {})
  }, [open, room.id, priv])
  const add = async () => {
    if (!picked.length) return
    setBusy(true)
    try {
      await addPeople(room.id, picked.map((p) => p.id))
      setPeople(await roomPeople(room.id))
      setPicked([])
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="room">
      <div className="settings">
        <div className="rs-head">
          <Crew seed={room.seed} size={120} count={priv && people.length < 3 ? 2 : 3} />
          <span className="rs-title">{room.name}</span>
          <span className="room-here empty-sub">{here} here</span>
        </div>
        {priv && (
          <>
            <h3 className="settings-label">{people.length} people</h3>
            {people.map((p) => (
              <button key={p.id} type="button" className="rs-user" onClick={() => nav('/dm/' + encodeURIComponent(p.username))}>
                <GoofyFace name={p.username} size={40} />
                <span className="grow ellipsis">{p.username}</span>
              </button>
            ))}
            <h3 className="settings-label">add people</h3>
            <PeoplePicker picked={picked} onChange={setPicked} exclude={people.map((p) => p.id)} />
            {picked.length > 0 && (
              <button type="button" className="rs-go" disabled={busy} onClick={() => void add()}>
                add {picked.length}
              </button>
            )}
            <button
              type="button"
              className="rs-leave"
              onClick={async () => {
                await leaveRoom(room.id).catch(() => {})
                onClose()
                nav('/rooms')
              }}
            >
              leave room
            </button>
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
  const here = useRooms((s) => s.here[room.id] ?? 0)
  const typers = useRooms((s) => s.typing[room.id])
  const names = typers ? Object.values(typers).map((t) => t.name) : []
  const mode = useThemeMode()
  const theme = getTheme(room.theme, mode)
  useEffect(() => enterRoom(room), [room.id, room.topic])

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
          <Crew seed={room.seed} size={52} count={room.kind === 'private' && (room.members ?? 3) < 3 ? 2 : 3} />
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
        <ModeButton />
        <button className="icon-btn" onClick={() => setSheet(true)} aria-label="people">
          <IconUsers size={24} />
        </button>
      </header>
      <List room={room} />
      <Composer room={room} />
      <PeopleSheet room={room} open={sheet} onClose={() => setSheet(false)} />
    </div>
  )
}

export default function RoomChat({ id }: { id: string }) {
  const [, nav] = useLocation()
  const desktop = useIsDesktop()
  const room = useRooms((s) => s.rooms[id])
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    setMissing(false)
    void fetchRoom(id).then((r) => !r && setMissing(true))
  }, [id])
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
      <div className="chat-center">{missing ? <span className="chat-center-name">room not found</span> : <TypingDots />}</div>
    </div>
  )
}
