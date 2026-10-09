import { createPortal } from 'react-dom'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'wouter'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import {
  useHasMore,
  useLoadingOlder,
  useMe,
  useMessages,
  useMyLastStatus,
  useNow,
  usePeerStatus,
  usePeerTyping,
  usePushBusy,
  usePushState,
  useResolveChat,
} from '../../lib/hooks'
import { clearChat, loadOlder, nameHistory, react, respondRequest, retry, sendMessage, setActiveConv, setBlocked, setTheme, setTyping, setVoice, setImages, sendConfetti, onPeerConfetti, openOnce, unsend } from '../../lib/engine'
import { togglePush } from '../../lib/push'
import { activeAgo, relTime, daySeparator, emojiOnlyCount, hereFor, linkify, needsSeparator, sameGroup } from '../../lib/format'
import type { Conversation, Message } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, Sheet, Toggle, TypingDots, spring, useIsDesktop } from '../../ui/kit'
import { IconMoon, IconSun, IconPin, IconImage, IconMic, IconSticker, IconClose, IconReply, IconSmilePlus, IconAlert, IconArrowDown, IconBack, IconBell, IconCheck, IconGear, IconSend } from '../../ui/icons'
import { getTheme, themeList, themeVars } from '../../themes/themes'
import { flipModeFrom, useThemeMode } from '../../themes/mode'
import { flushSync } from 'react-dom'
import { goHome } from '../shell/nav'
import { EasterEgg } from './EasterEgg'
import { Recorder } from '../voice/Recorder'
import { VoiceBubble } from '../voice/VoiceBubble'
import { voiceOf } from '../voice/voice'
import { GONE, imageOf, imageBody, prepImage, uploadImage } from '../image/image'
import { ImageBubble } from '../image/ImageBubble'
import { Confetti, type ConfettiHandle } from './Confetti'
import { LockedSticker, Sticker } from '../stickers/Sticker'
import { useStore } from '../../lib/store'
import { MAX_PINS, togglePin, usePins } from '../inbox/pins'
import { COUPLES, NSFW_STICKERS, STICKERS, coupleOf, displayBody, stickerBody, stickerOf } from '../stickers/stickers'
import { CoupleSticker } from '../stickers/CoupleSticker'
import { EMOJI_GROUPS } from './emojis'
import { Aura } from '../../ui/Aura'
import { useFlairFor } from '../../ui/flair'
import { ProfileCard } from '../profile/ProfileCard'
import { ThemeBackground, setThemeOrigin } from './ThemeReveal'
import { AMBIENT_LABEL, PARTICLE_AMBIENTS, setAmbientPrefs, useAmbientPrefs } from '../../themes/ambientPrefs'

export type ChatScreenProps = { username: string }

export default function ChatScreen({ username }: ChatScreenProps) {
  const { status, conversation } = useResolveChat(username)
  if (conversation) return <ChatView conv={conversation} />
  return <ChatPlaceholder username={username} status={status} />
}

function ChatPlaceholder({ username, status }: { username: string; status: string }) {
  const [, nav] = useLocation()
  const desktop = useIsDesktop()
  const t = getTheme('goofy')
  return (
    <div className="chat" style={themeVars(t)}>
      <div className="chat-bg" style={{ background: t.bg }} />
      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goHome(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
      </header>
      <div className="chat-center">
        <GoofyFace name={username} size={120} mood={status === 'not_found' ? 'shocked' : 'neutral'} />
        <p className="chat-center-name">{status === 'not_found' ? 'nobody by that name' : status === 'self' ? "that's you" : username}</p>
        {status === 'loading' && <TypingDots />}
      </div>
    </div>
  )
}

function ChatView({ conv }: { conv: Conversation }) {
  const [, nav] = useLocation()
  const desktop = useIsDesktop()
  const mode = useThemeMode()
  const theme = getTheme(conv.theme, mode)
  const peer = conv.peer
  const status = usePeerStatus(peer.id)
  const now = useNow(30000)
  const [settings, setSettings] = useState(false)
  const [egg, setEgg] = useState(0)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const confetti = useRef<ConfettiHandle>(null)
  const taps = useRef<{ n: number; t: number; x: number; y: number }>({ n: 0, t: 0, x: 0, y: 0 })
  const onChatTap = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, .sheet, .panel, .r-picker')) return
    const k = taps.current
    const now = performance.now()
    if (now - k.t < 360 && Math.hypot(e.clientX - k.x, e.clientY - k.y) < 60) k.n++
    else k.n = 1
    k.t = now
    k.x = e.clientX
    k.y = e.clientY
    if (k.n >= 4) {
      k.n = 0
      confetti.current?.rain()
      sendConfetti(conv.id)
    }
  }
  useEffect(() => onPeerConfetti((id) => id === conv.id && confetti.current?.rain()), [conv.id])
  useEffect(() => setReplyTo(null), [conv.id])
  const chatRef = useRef<HTMLDivElement>(null)
  const [themeBump, setThemeBump] = useState(false)
  const me = useMe()
  const spicy = useStore((s) => s.me?.nsfw === true && peerNsfw(s, conv.peer))
  const [card, setCard] = useState(false)
  const peerAura = useFlairFor(conv.peer.username)?.aura
  const plate = !!peerAura && peerAura !== 'none'

  useEffect(() => {
    if (!egg) return
    const t = setTimeout(() => setEgg(0), 2600)
    return () => clearTimeout(t)
  }, [egg])

  useEffect(() => {
    setActiveConv(conv.id)
    return () => setActiveConv(null)
  }, [conv.id])

  let statusLine: React.ReactNode = null
  if (status.typing)
    statusLine = (
      <span className="st-typing">
        typing<TypingDots />
      </span>
    )
  else if (conv.peer.show_status === false || me?.show_status === false) statusLine = null
  else if (status.online) statusLine = status.away ? 'away' : 'online'
  else if (status.lastSeenAt) statusLine = activeAgo(status.lastSeenAt, now)

  return (
    <div ref={chatRef} onPointerDown={onChatTap} className={'chat scheme-' + theme.scheme + ' theme-' + theme.id + (themeBump ? ' theme-bump' : '')} style={themeVars(theme)}>
      <Confetti ref={confetti} themeId={theme.id} host={() => chatRef.current} spicy={spicy} />
      <ThemeBackground themeId={theme.id} host={chatRef} onPhase={setThemeBump} spicy={spicy} />

      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goHome(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
        <button type="button" className={'chat-peer' + (plate ? ' has-aura' : '')} onClick={() => setCard(true)} aria-label={peer.username + ' profile'}>
          {plate && <Aura id={peerAura} />}
          <GoofyFace name={peer.username} size={40} presence={conv.peer.show_status !== false && me?.show_status !== false && status.online ? (status.away ? 'away' : 'online') : null} />
          <div className="chat-peer-text">
            <span className="chat-peer-name ellipsis">{peer.username}</span>
            <AnimatePresence mode="wait" initial={false}>
              {statusLine && (
                <motion.span key={String(status.typing) + String(status.online)} className={'chat-peer-status' + (status.typing ? ' is-typing' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {statusLine}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </button>
        <ModeButton />
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="chat settings">
          <IconGear size={24} />
        </button>
      </header>

      <MessageList conv={conv} now={now} sinceOnline={status.since} online={status.online} onReply={setReplyTo} />
      <ChatFooter conv={conv} meId={me?.id ?? null} now={now} onEgg={() => setEgg((n) => n + 1)} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      <AnimatePresence>{egg > 0 && <EasterEgg key="egg" me={me?.username ?? ''} />}</AnimatePresence>

      <ProfileCard name={peer.username} open={card} onClose={() => setCard(false)} />
      <Sheet open={settings} onClose={() => setSettings(false)} label="chat settings">
        <SettingsBody conv={conv} onPicked={() => setSettings(false)} />
      </Sheet>
    </div>
  )
}

/** Sun / moon switch in the top bar. Personal: only changes this device. */
export function ModeButton() {
  const mode = useThemeMode()
  const dark = mode === 'dark'
  return (
    <button
      type="button"
      className="icon-btn mode-btn"
      aria-label={dark ? 'switch to light mode' : 'switch to dark mode'}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        navigator.vibrate?.(8)
        flipModeFrom(r.left + r.width / 2, r.top + r.height / 2, (fn) => flushSync(fn))
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          className="mode-ico"
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
        >
          {dark ? <IconMoon size={23} /> : <IconSun size={24} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

/* ------------------------------------------------------------------ messages */

function MessageList({ conv, now, sinceOnline, online, onReply }: { conv: Conversation; now: number; sinceOnline: string | null; online: boolean; onReply: (m: Message) => void }) {
  const me = useMe()
  const allMsgs = useMessages(conv.id)
  const msgs = useMemo(() => allMsgs.filter((x) => x.body !== '[[unsent]]'), [allMsgs])
  const typing = usePeerTyping(conv.id)
  const mine = useMyLastStatus(conv.id)
  const hasMore = useHasMore(conv.id)
  const loadingOlder = useLoadingOlder(conv.id)
  const scroller = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [jump, setJump] = useState(false)
  const firstId = msgs[0]?.id
  const lastId = msgs[msgs.length - 1]?.id
  const prevFirst = useRef(firstId)
  const prevLast = useRef(lastId)
  const prevHeight = useRef(0)
  const mounted = useRef(false)

  const toBottom = useCallback((smooth: boolean) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (!mounted.current) {
      mounted.current = true
      el.scrollTop = el.scrollHeight
    } else if (firstId !== prevFirst.current && lastId === prevLast.current) {
      // older page prepended: keep the visual position
      el.scrollTop += el.scrollHeight - prevHeight.current
    } else if (lastId !== prevLast.current) {
      const last = msgs[msgs.length - 1]
      if (atBottom.current || (last && last.sender_id === me?.id)) {
        toBottom(true)
        setJump(false)
      } else setJump(true)
    }
    prevFirst.current = firstId
    prevLast.current = lastId
    prevHeight.current = el.scrollHeight
  })

  useEffect(() => {
    if (typing && atBottom.current) toBottom(true)
  }, [typing, toBottom])

  useEffect(() => {
    const el = topSentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting && !loadingOlder) {
          prevHeight.current = scroller.current?.scrollHeight ?? 0
          void loadOlder(conv.id)
        }
      },
      { root: scroller.current, rootMargin: '300px 0px 0px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadingOlder, conv.id])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
    if (atBottom.current && jump) setJump(false)
  }

  const peer = conv.peer
  const items: React.ReactNode[] = []
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    const prev = msgs[i - 1]
    const next = msgs[i + 1]
    if (needsSeparator(prev, m)) items.push(<div key={'sep' + m.id} className="sep">{daySeparator(m.created_at, now)}</div>)
    if (m.kind === 'theme') {
      const who = m.sender_id === me?.id ? 'you' : peer.username
      items.push(
        <motion.div key={m.id} className="sys" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
          {who} changed the theme to {getTheme(m.body).name}
        </motion.div>,
      )
      continue
    }
    const isMine = m.sender_id === me?.id
    const joinPrev = sameGroup(prev, m) && !needsSeparator(prev, m)
    const joinNext = !!next && sameGroup(m, next) && !needsSeparator(m, next)
    items.push(
      <Fragment key={m.id}>
        <Bubble m={m} mine={isMine} joinPrev={joinPrev} joinNext={joinNext} peerName={peer.username} meId={me?.id ?? null} onReply={onReply} />
        {isMine && mine?.id === m.id && <MineStatus state={mine.state === 'seen' && me?.show_seen === false ? 'sent' : mine.state} id={m.id} />}
      </Fragment>,
    )
  }

  return (
    <div className="msgs-wrap">
      <div className="msgs scroll-y" ref={scroller} onScroll={onScroll}>
        <div ref={topSentinel} className="msgs-top">{loadingOlder && <TypingDots />}</div>
        {msgs.length === 0 ? (
          <EmptyChat conv={conv} now={now} sinceOnline={sinceOnline} online={online} />
        ) : (
          <div className="msgs-inner">{items}</div>
        )}
        <AnimatePresence>
          {typing && (
            <motion.div className="b-row theirs typing-row" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring}>
              <span className="b-face">
                <GoofyFace name={peer.username} size={28} blink={false} />
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
          <motion.button className="jump" onClick={() => toBottom(true)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            new message <IconArrowDown size={15} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function MineStatus({ state, id }: { state: 'sending' | 'failed' | 'sent' | 'seen'; id: string }) {
  if (state === 'sending') return <div className="mine-status">sending...</div>
  if (state === 'failed')
    return (
      <button className="mine-status is-failed" onClick={() => retry(id)}>
        <IconAlert size={14} /> tap to retry
      </button>
    )
  return (
    <motion.div key={state} className={'mine-status' + (state === 'seen' ? ' is-seen' : '')} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}>
      {state}
    </motion.div>
  )
}

/** Live nsfw flag for the other person: presence is freshest, the conversation snapshot can be stale. */
function peerNsfw(s: ReturnType<typeof useStore.getState>, peer: Conversation['peer'] | undefined): boolean {
  if (!peer) return false
  const live = s.online[peer.id]?.nsfw
  if (typeof live === 'boolean') return live
  const prof = s.profiles[peer.id]?.nsfw
  return (typeof prof === 'boolean' ? prof : peer.nsfw) === true
}

const REACTIONS = ['❤️', '😂', '💀', '😮', '😢', '👍']

function Bubble({ m, mine, joinPrev, joinNext, peerName, meId, onReply }: { m: Message; mine: boolean; joinPrev: boolean; joinNext: boolean; peerName: string; meId: string | null; onReply: (m: Message) => void }) {
  const [actions, setActions] = useState(false)
  const moved = useRef(false)
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dx = useMotionValue(0)
  const replyHint = useTransform(dx, [0, 60], [0, 1])
  const replyHintScale = useTransform(dx, [0, 60], [0.4, 1])
  useEffect(() => {
    if (!actions) return
    const t = setTimeout(() => setActions(false), 3500)
    return () => clearTimeout(t)
  }, [actions])
  const myName = useMe()?.username ?? ''
  const stk = stickerOf(m.body)
  const cpl = coupleOf(m.body)
  const voice = voiceOf(m.body)
  const img = imageOf(m.body)
  const spicy = useStore((s) => s.me?.nsfw === true && peerNsfw(s, s.conversations[m.conversation_id]?.peer))
  const [viewer, setViewer] = useState(false)
  const gone = m.body === GONE
  const once = !!img?.once
  // view once: 5s after opening it closes itself, and closing (any way) burns it for both
  useEffect(() => {
    if (!viewer || !once || mine) return
    const t = setTimeout(() => setViewer(false), 5000)
    return () => {
      clearTimeout(t)
      void openOnce(m)
    }
  }, [viewer])
  const emoji = stk || cpl || voice || img || gone ? 0 : emojiOnlyCount(m.body)
  const big = emoji > 0 && emoji <= 3
  const cls = ['b', mine ? 'mine' : 'theirs', joinPrev ? 'jp' : '', joinNext ? 'jn' : '', big ? 'b-emoji' : '', stk || cpl ? 'b-sticker' : '', voice ? 'b-voice' : '', img ? 'b-img' : ''].join(' ')
  const [picker, setPicker] = useState(false)
  const [burst, setBurst] = useState(0)
  const [more, setMore] = useState(false)
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const lastTap = useRef(0)
  const reactions = m.reactions ?? {}
  const mineR = meId ? reactions[meId] : undefined
  const counts = new Map<string, number>()
  for (const e of Object.values(reactions)) counts.set(e, (counts.get(e) ?? 0) + 1)
  const chips = [...counts.entries()]

  const open = () => {
    press.current = null
    navigator.vibrate?.(12)
    setPicker(true)
  }
  const onDown = (e: React.PointerEvent) => {
    moved.current = false
    press.current = { t: setTimeout(open, 380), x: e.clientX, y: e.clientY }
  }
  const cancel = () => {
    if (press.current) clearTimeout(press.current.t)
    press.current = null
  }
  const onMove = (e: React.PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      moved.current = true
      cancel()
    }
  }
  const onUp = () => {
    const wasPress = !press.current
    cancel()
    if (moved.current || wasPress || picker) return
    const now = Date.now()
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current)
      lastTap.current = 0
      if (mineR !== '❤️') setBurst((b) => b + 1)
      react(m.conversation_id, m.id, '❤️')
    } else {
      lastTap.current = now
      clearTimeout(tapTimer.current)
      tapTimer.current = setTimeout(() => (img && !(once && mine) ? setViewer(true) : setActions((a) => !a)), 290)
    }
  }
  const pick = (e: string) => {
    setPicker(false)
    if (e !== mineR) setBurst((b) => b + 1)
    react(m.conversation_id, m.id, e)
  }

  return (
    <motion.div
      data-mid={m.id}
      className={'b-row ' + (mine ? 'mine' : 'theirs') + (joinNext ? ' jn' : '') + (chips.length ? ' has-reacts' : '')}
      initial={{ opacity: 0, x: mine ? 14 : -14, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={spring}
    >
      {!mine && <span className="b-face">{!joinNext && <GoofyFace name={peerName} size={28} blink={false} />}</span>}
      <div className="b-wrap">
        <motion.span className="swipe-hint" style={{ opacity: replyHint, scale: replyHintScale }}>
          <IconReply size={18} />
        </motion.span>
        <motion.div
          className={cls}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.55 }}
          dragSnapToOrigin
          style={{ x: dx }}
          onDragStart={() => {
            moved.current = true
            cancel()
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 60) {
              navigator.vibrate?.(10)
              onReply(m)
            }
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={cancel}
          onPointerLeave={cancel}
          onContextMenu={(e) => {
            e.preventDefault()
            open()
          }}
          animate={picker ? { scale: 1.04 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {m.reply && (
            <button
              type="button"
              className="b-quote"
              onClick={(e) => {
                e.stopPropagation()
                const el = document.querySelector(`[data-mid="${m.reply!.id}"]`)
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                el?.classList.add('flash')
                setTimeout(() => el?.classList.remove('flash'), 1200)
              }}
            >
              <b>{m.reply.sender_id === meId ? 'you' : peerName}</b>
              <span>{displayBody(m.reply.body)}</span>
            </button>
          )}
          {img ? <ImageBubble img={img} open={viewer} blur={once} onClose={() => setViewer(false)} /> : gone ? <span className="once-gone"><IconImage size={16} /> opened</span> : voice ? <VoiceBubble note={voice} /> : cpl ? <CoupleSticker kind={cpl} a={mine ? myName : peerName} b={mine ? peerName : myName} size={180} /> : stk ? (NSFW_STICKERS.includes(stk) && !spicy ? <LockedSticker size={140} /> : <Sticker kind={stk} name={mine ? myName : peerName} size={140} />) : linkify(m.body).map((p, i) =>
            p.href ? (
              <a key={i} href={p.href} target="_blank" rel="noreferrer noopener">
                {p.text}
              </a>
            ) : (
              <Fragment key={i}>{p.text}</Fragment>
            ),
          )}
        </motion.div>
        <AnimatePresence>
          {actions && !picker && (
            <motion.div className="b-actions" initial={{ opacity: 0, scale: 0.6, x: mine ? 10 : -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}>
              <button type="button" aria-label="react" onClick={() => { setActions(false); setPicker(true) }}>
                <IconSmilePlus size={19} />
              </button>
              <button type="button" aria-label="reply" onClick={() => { setActions(false); onReply(m) }}>
                <IconReply size={19} />
              </button>
              {mine && (
                <button type="button" aria-label="unsend" onClick={() => { setActions(false); void unsend(m) }}>
                  <IconClose size={19} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              className="r-burst"
              initial={{ scale: 0.2, opacity: 0, y: 0 }}
              animate={{ scale: [0.2, 1.5, 1.2], opacity: [0, 1, 0], y: -34, rotate: [0, -12, 8] }}
              transition={{ duration: 0.75, ease: 'easeOut' }}
              onAnimationComplete={() => setBurst(0)}
            >
              {mineR ?? '❤️'}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {chips.length > 0 && (
            <motion.button
              type="button"
              className="b-reacts"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              onClick={() => setPicker(true)}
            >
              {chips.map(([e, n]) => (
                <motion.span key={e} layout initial={{ scale: 0 }} animate={{ scale: 1 }} className={e === mineR ? 'is-mine' : ''}>
                  {e}
                  {n > 1 && <small>{n}</small>}
                </motion.span>
              ))}
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {picker && (
            <motion.div
              className="r-picker"
              initial={{ opacity: 0, scale: 0.6, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 8, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            >
              {REACTIONS.map((e, i) => (
                <motion.button
                  key={e}
                  type="button"
                  className={'r-opt' + (e === mineR ? ' is-on' : '')}
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: 0.03 * i, type: 'spring', stiffness: 700, damping: 16 }}
                  whileTap={{ scale: 1.5 }}
                  onClick={() => pick(e)}
                >
                  {e}
                </motion.button>
              ))}
              <motion.button
                type="button"
                className="r-opt r-more"
                aria-label="more emojis"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 600, damping: 16 }}
                onClick={() => {
                  setPicker(false)
                  setMore(true)
                }}
              >
                <IconSmilePlus size={22} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {picker && createPortal(<div className="r-backdrop" onPointerDown={() => setPicker(false)} />, document.body)}
      <Sheet open={more} onClose={() => setMore(false)} label="pick an emoji">
        <div className="emoji-sheet">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.name}>
              <h3 className="settings-label">{g.name}</h3>
              <div className="emoji-grid">
                {g.list.map((e, i) => (
                  <button
                    key={e + i}
                    type="button"
                    className={'emoji-cell' + (e === mineR ? ' is-on' : '')}
                    onClick={() => {
                      setMore(false)
                      pick(e)
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </motion.div>
  )
}

function EmptyChat({ conv, now, sinceOnline, online }: { conv: Conversation; now: number; sinceOnline: string | null; online: boolean }) {
  const sub = online ? hereFor(sinceOnline, now) : activeAgo(conv.peer.last_seen_at, now)
  return (
    <motion.div className="chat-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <GoofyFace name={conv.peer.username} size={124} look={{ x: 0, y: 0.9 }} />
      <p className="chat-empty-name">{conv.peer.username}</p>
      {sub && <p className="chat-empty-sub">{sub}</p>}
      <motion.button className="say-hi" whileTap={{ scale: 0.94 }} onClick={() => sendMessage(conv.id, 'hi 👋')}>
        👋 say hi
      </motion.button>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ requests / blocks */

function ChatFooter({ conv, meId, now, onEgg, replyTo, onClearReply }: { conv: Conversation; meId: string | null; now: number; onEgg: () => void; replyTo: Message | null; onClearReply: () => void }) {
  const name = conv.peer.username
  let content: React.ReactNode = null
  if (conv.blocked === 'me')
    content = (
      <>
        <p>you blocked {name}</p>
        <div className="req-actions">
          <button type="button" className="req-yes" onClick={() => void setBlocked(conv.peer.id, false)}>
            unblock
          </button>
        </div>
      </>
    )
  else if (conv.blocked === 'them') content = <p>you can't reply to this chat</p>
  else if (conv.status === 'pending' && conv.requester === meId)
    content = (
      <p>
        waiting for <b>{name}</b> to accept
      </p>
    )
  else if (conv.status === 'pending' && conv.requester && conv.requester !== meId)
    content = (
      <>
        <p>
          <b>{name}</b> wants to chat
        </p>
        <div className="req-actions">
          <button type="button" className="req-no" onClick={() => void respondRequest(conv.id, false)}>
            decline
          </button>
          <button type="button" className="req-yes" onClick={() => void respondRequest(conv.id, true)}>
            accept
          </button>
        </div>
      </>
    )
  else if (conv.status === 'declined' && conv.requester === meId && conv.declined_at) {
    const left = new Date(conv.declined_at).getTime() + 86400000 - now
    if (left > 0) {
      const h = Math.floor(left / 3600000)
      const m = Math.max(1, Math.ceil((left % 3600000) / 60000))
      content = (
        <p>
          declined. try again in{' '}
          <b className="tnum">
            {h}h {m}m
          </b>
        </p>
      )
    }
  }
  if (!content) return <Composer conv={conv} onEgg={onEgg} replyTo={replyTo} onClearReply={onClearReply} meId={meId} />
  return (
    <motion.div className="req" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
      {content}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ composer */

const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

function Composer({ conv, onEgg, replyTo, onClearReply, meId }: { conv: Conversation; onEgg: () => void; replyTo: Message | null; onClearReply: () => void; meId: string | null }) {
  const [tray, setTray] = useState(false)
  const [trayTab, setTrayTab] = useState<'me' | 'us' | 'hate' | 'lust'>('me')
  const [recording, setRecording] = useState(false)
  const myName = useMe()?.username ?? ''
  const spicyTray = useStore((s) => s.me?.nsfw === true && peerNsfw(s, conv.peer))
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const lastSent = useRef<{ body: string; at: number } | null>(null)
  const has = text.trim().length > 0
  const voiceOk = !!conv.my_voice && !!conv.peer_voice
  const imagesOk = !!conv.my_images && !!conv.peer_images
  const [pmenu, setPmenu] = useState(false)
  const onceRef = useRef(false)
  const [upload, setUpload] = useState<{ preview: string; err?: boolean } | null>(null)
  // A fresh native input per tap, no accept filter: on some Android phones the gallery app never
  // returns the photo to Chrome, while the system document picker does. Some Androids only fire 'input'.
  const openPicker = () => {
    const el = document.createElement('input')
    el.type = 'file'
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0'
    let handled = false
    const take = () => {
      if (handled) return
      handled = true
      void pickImage(el.files?.[0])
      setTimeout(() => el.remove(), 1000)
    }
    el.addEventListener('change', take)
    el.addEventListener('input', take)
    el.addEventListener('cancel', () => el.remove())
    document.body.appendChild(el)
    el.click()
  }
  const pickImage = async (file: File | undefined) => {
    if (!file) return
    if (file.type && !file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name)) return
    const once = onceRef.current
    const preview = URL.createObjectURL(file)
    setUpload({ preview })
    const reply = replyTo
    onClearReply()
    try {
      const { blob, w, h } = await prepImage(file)
      const url = await uploadImage(blob, meId ?? 'anon')
      sendMessage(conv.id, imageBody(url, w, h, once), reply)
      setUpload(null)
      URL.revokeObjectURL(preview)
    } catch {
      setUpload({ preview, err: true })
      setTimeout(() => {
        setUpload(null)
        URL.revokeObjectURL(preview)
      }, 3500)
    }
  }

  const resize = () => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }
  useLayoutEffect(resize, [text])

  useEffect(() => {
    if (fine) ta.current?.focus()
    return () => setTyping(conv.id, false)
  }, [conv.id])

  const send = () => {
    const body = text.trim()
    if (!body) return
    // Rapid double taps send the same text twice. A user found it and asked us to keep it, so it's an easter egg now.
    const now = performance.now()
    const prev = lastSent.current
    if (prev && prev.body === body && now - prev.at < 400) {
      onEgg()
      navigator.vibrate?.([18, 40, 18])
    }
    lastSent.current = { body, at: now }
    sendMessage(conv.id, body, replyTo)
    onClearReply()
    setText('')
    setTyping(conv.id, false)
    ta.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && fine && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="composer-wrap">
      <AnimatePresence>
        {replyTo && (
          <motion.div className="reply-bar" initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 8, height: 0 }} transition={spring}>
            <div className="reply-bar-in">
              <IconReply size={18} />
              <div className="reply-bar-text">
                <b>replying to {replyTo.sender_id === meId ? 'yourself' : conv.peer.username}</b>
                <span>{displayBody(replyTo.body)}</span>
              </div>
              <button type="button" aria-label="cancel reply" onClick={onClearReply}>
                <IconClose size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tray && (
          <motion.div className="stk-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <div className="stk-tray-in">
              <div className="stk-tabs">
                <Segmented
                  layoutId="stk-tabs"
                  value={trayTab}
                  onChange={setTrayTab}
                  items={[
                    { id: 'me' as const, label: 'me' },
                    { id: 'us' as const, label: 'us two' },
                    { id: 'hate' as const, label: 'hate' },
                    ...(spicyTray ? [{ id: 'lust' as const, label: 'lust' }] : []),
                  ]}
                />
              </div>
              <div className={'stk-grid' + (trayTab === 'us' ? ' is-couple' : '')} key={trayTab}>
                {trayTab !== 'us'
                  ? STICKERS.filter((st) => st.pack === (trayTab === 'lust' && !spicyTray ? 'me' : trayTab)).map((st, i) => (
                      <motion.button
                        key={st.id}
                        type="button"
                        className="stk-pick"
                        aria-label={st.caption}
                        initial={{ scale: 0.4, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.025 * i, type: 'spring', stiffness: 520, damping: 22 }}
                        whileTap={{ scale: 0.82 }}
                        onClick={() => {
                          navigator.vibrate?.(8)
                          sendMessage(conv.id, stickerBody(st.id), replyTo)
                          onClearReply()
                        }}
                      >
                        <Sticker kind={st.id} name={myName} size={78} />
                      </motion.button>
                    ))
                  : COUPLES.map((st, i) => (
                      <motion.button
                        key={st.id}
                        type="button"
                        className="stk-pick"
                        aria-label={st.caption}
                        initial={{ scale: 0.4, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i, type: 'spring', stiffness: 520, damping: 22 }}
                        whileTap={{ scale: 0.82 }}
                        onClick={() => {
                          navigator.vibrate?.(8)
                          sendMessage(conv.id, stickerBody(st.id), replyTo)
                          onClearReply()
                        }}
                      >
                        <CoupleSticker kind={st.id} a={myName} b={conv.peer.username} size={104} />
                      </motion.button>
                    ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="popLayout" initial={false}>
        {recording && (
          <Recorder
            key="rec"
            userId={meId ?? 'anon'}
            onSend={(body) => {
              sendMessage(conv.id, body, replyTo)
              onClearReply()
            }}
            onClose={() => setRecording(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {upload && (
          <motion.div key="up" className={'img-up' + (upload.err ? ' is-err' : '')} initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.9 }}>
            <img src={upload.preview} alt="" />
            {upload.err ? 'failed' : <TypingDots />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="composer" style={recording ? { display: 'none' } : undefined}>
        <button
          type="button"
          className={'stk-toggle' + (tray ? ' is-on' : '')}
          aria-label="stickers"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!tray) ta.current?.blur()
            else ta.current?.focus()
            setTray((v) => !v)
          }}
        >
          <IconSticker size={24} />
        </button>
        {imagesOk && (
          <span className="pick-wrap">
            <button type="button" className="stk-toggle img-tg" aria-label="photo" disabled={!!upload} onPointerDown={(e) => e.preventDefault()} onClick={() => setPmenu((v) => !v)}>
              <IconImage size={24} />
            </button>
            {pmenu && (
              <span className="pick-menu">
                <button type="button" onClick={() => { onceRef.current = false; setPmenu(false); openPicker() }}>
                  <IconImage size={18} /> photo
                </button>
                <button type="button" onClick={() => { onceRef.current = true; setPmenu(false); openPicker() }}>
                  <i className="once-1">1</i> view once
                </button>
              </span>
            )}
          </span>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder="message..."
          aria-label="message"
          onChange={(e) => {
            setText(e.target.value)
            setTyping(conv.id, e.target.value.trim().length > 0)
          }}
          onFocus={() => setTray(false)}
          onBlur={() => setTyping(conv.id, false)}
          onKeyDown={onKey}
          enterKeyHint={fine ? 'send' : 'enter'}
          maxLength={2000}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {!has && voiceOk && (
            <motion.button
              key="mic"
              type="button"
              className="send mic"
              aria-label="record voice note"
              initial={{ scale: 0, rotate: 40 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -30 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              whileTap={{ scale: 0.86 }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setTray(false)
                ta.current?.blur()
                setRecording(true)
              }}
            >
              <IconMic size={21} />
            </motion.button>
          )}
          {(has || !voiceOk) && (
            <motion.button
              key="send"
              className="send"
              aria-label="send"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              whileTap={{ scale: 0.86 }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={send}
            >
              <IconSend size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ settings */

function NameHistory({ peerId }: { peerId: string }) {
  const [list, setList] = useState<{ username: string; changed_at: string }[]>([])
  useEffect(() => {
    let live = true
    nameHistory(peerId).then((l) => live && setList(l || [])).catch(() => {})
    return () => {
      live = false
    }
  }, [peerId])
  if (!list.length) return null
  return (
    <div className="aka">
      <span className="aka-label">previously</span>
      {list.map((h) => (
        <span key={h.username + h.changed_at} className="aka-name">
          {h.username} <small>{relTime(h.changed_at)}</small>
        </span>
      ))}
    </div>
  )
}

function AmbientControls({ themeId }: { themeId: string }) {
  const kind = getTheme(themeId).ambient
  const amount = useAmbientPrefs((p) => p.amount)
  const speed = useAmbientPrefs((p) => p.speed)
  if (!(PARTICLE_AMBIENTS as readonly string[]).includes(kind)) return null
  const label = AMBIENT_LABEL[kind]
  return (
    <div className="amb-ctl">
      <label className="amb-row">
        <span>{label}</span>
        <input type="range" min={0.25} max={4} step={0.05} value={amount} onChange={(e) => setAmbientPrefs({ amount: +e.target.value })} aria-label={label + ' amount'} />
        <b className="tnum">{amount < 0.6 ? 'few' : amount > 2.2 ? 'loads' : amount > 1.3 ? 'more' : 'some'}</b>
      </label>
      <label className="amb-row">
        <span>speed</span>
        <input type="range" min={0.3} max={3} step={0.05} value={speed} onChange={(e) => setAmbientPrefs({ speed: +e.target.value })} aria-label={label + ' speed'} />
        <b className="tnum">{speed < 0.7 ? 'chill' : speed > 1.8 ? 'zoom' : speed > 1.2 ? 'quick' : 'normal'}</b>
      </label>
    </div>
  )
}

function DeleteChat({ conv, onDone }: { conv: Conversation; onDone: () => void }) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const go = async (both: boolean) => {
    setBusy(true)
    navigator.vibrate?.([12, 30, 12])
    try {
      await clearChat(conv.id, both)
      onDone()
    } finally {
      setBusy(false)
      setAsk(false)
    }
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      {!ask ? (
        <motion.button key="del" type="button" className="block-btn del-btn" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onClick={() => setAsk(true)}>
          delete chat
        </motion.button>
      ) : (
        <motion.div key="ask" className="del-ask" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring}>
          <b>delete this chat?</b>
          <button type="button" className="del-opt" disabled={busy} onClick={() => void go(false)}>
            delete for me
          </button>
          <button type="button" className="del-opt is-both" disabled={busy} onClick={() => void go(true)}>
            delete for both
          </button>
          <button type="button" className="del-cancel" disabled={busy} onClick={() => setAsk(false)}>
            cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PinRow({ convId }: { convId: string }) {
  const pins = usePins((s) => s.ids)
  const on = pins.includes(convId)
  const full = !on && pins.length >= MAX_PINS
  return (
    <>
      <h3 className="settings-label">pin</h3>
      <div className="settings-row">
        <IconPin size={22} filled={on} />
        <span className="grow">pin chat</span>
        <Toggle label="pin chat" on={on} disabled={full} onChange={() => togglePin(convId)} />
      </div>
      {full && <p className="settings-hint">{MAX_PINS} pinned already</p>}
    </>
  )
}

function SettingsBody({ conv, onPicked }: { conv: Conversation; onPicked: () => void }) {
  const mode = useThemeMode()
  const [themeOpen, setThemeOpen] = useState(false)
  const push = usePushState(conv.id)
  const busy = usePushBusy()
  const hint = push === 'needs-install' ? 'add to home screen to turn on' : push === 'denied' ? 'blocked in browser settings' : push === 'unsupported' ? 'not supported in this browser' : null
  return (
    <div className="settings">
      <div className="settings-peer">
        <GoofyFace name={conv.peer.username} size={64} />
        <span className="settings-name">{conv.peer.username}</span>
        <NameHistory peerId={conv.peer.id} />
      </div>
      <h3 className="settings-label">theme</h3>
      <button type="button" className={'theme-row' + (themeOpen ? ' is-open' : '')} onClick={() => setThemeOpen((v) => !v)} aria-expanded={themeOpen}>
        <span className="theme-row-sw" style={{ ...themeVars(getTheme(conv.theme, mode)), background: getTheme(conv.theme, mode).bg }}>
          <span className="sw-b sw-recv" />
          <span className="sw-b sw-sent" />
        </span>
        <span className="theme-row-name">{getTheme(conv.theme).name}</span>
        <IconBack size={20} className="theme-row-chev" style={{ rotate: '180deg' }} />
      </button>
      <AnimatePresence initial={false}>
        {themeOpen && (
          <motion.div className="theme-drop" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
      <div className="swatches">
        {themeList(mode).map((t) => {
          const on = t.id === conv.theme
          return (
            <motion.button key={t.id} className={'swatch' + (on ? ' is-on' : '')} onClick={(e) => {
                if (t.id === conv.theme) return
                setThemeOrigin(e.clientX, e.clientY)
                onPicked()
                setTimeout(() => void setTheme(conv.id, t.id), 260)
              }} whileTap={{ scale: 0.94 }} aria-pressed={on}>
              <span className="swatch-prev" style={{ ...themeVars(t), background: t.bg }}>
                <span className="sw-b sw-recv" />
                <span className="sw-b sw-sent" />
                {on && (
                  <motion.span className="swatch-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
                    <IconCheck size={14} />
                  </motion.span>
                )}
              </span>
              <span className="swatch-name">{t.name}</span>
            </motion.button>
          )
        })}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AmbientControls themeId={conv.theme} />
      <PinRow convId={conv.id} />
      <h3 className="settings-label">notifications</h3>
      <div className="settings-row">
        <IconBell size={22} />
        <span className="grow">notifications</span>
        <Toggle label="notifications" on={push === 'on'} disabled={busy || push === 'needs-install' || push === 'unsupported' || push === 'denied'} onChange={() => void togglePush(conv.id)} />
      </div>
      {hint && <p className="settings-hint">{hint}</p>}
      <h3 className="settings-label">voice notes</h3>
      <div className="settings-row">
        <IconMic size={22} />
        <span className="grow">voice notes</span>
        <Toggle label="voice notes" on={!!conv.my_voice} onChange={(v) => void setVoice(conv.id, v)} />
      </div>
      <p className="settings-hint">
        {conv.peer_voice ? (conv.my_voice ? 'on for both of you' : `${conv.peer.username} has it on`) : conv.my_voice ? `waiting on ${conv.peer.username}` : `${conv.peer.username} has it off`}
      </p>
      <h3 className="settings-label">photos</h3>
      <div className="settings-row">
        <IconImage size={22} />
        <span className="grow">photos</span>
        <Toggle label="photos" on={!!conv.my_images} onChange={(v) => void setImages(conv.id, v)} />
      </div>
      <p className="settings-hint">
        {conv.peer_images ? (conv.my_images ? 'on for both of you' : `${conv.peer.username} has it on`) : conv.my_images ? `waiting on ${conv.peer.username}` : `${conv.peer.username} has it off`}
      </p>
      <DeleteChat conv={conv} onDone={onPicked} />
      <button type="button" className={'block-btn' + (conv.blocked === 'me' ? ' is-on' : '')} onClick={() => void setBlocked(conv.peer.id, conv.blocked !== 'me')}>
        {conv.blocked === 'me' ? 'unblock ' : 'block '}
        {conv.peer.username}
      </button>
    </div>
  )
}
