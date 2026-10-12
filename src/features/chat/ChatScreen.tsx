import { MessageMenu, type MenuAction } from './MessageMenu'
import { ChatInfo } from './ChatInfo'
import { FacesTray, PlayTray, StickerTray, TrayTabs, lastTrayTab, type Media, type TrayTab } from './Tray'
import { WishCard, WishSheet, isWishReply, wishOf } from '../toys/Wish'
import { TotCard, isTotReply, sendTot, totOf } from '../toys/Tot'
import { DoodleSheet } from '../toys/Doodle'
import { FX_BY_THEME, fireFx, fxSource } from '../../themes/fx'
import { GameBubble, ToyBubble, gameOf, toyOf } from '../toys/Toys'
import { shareSticker } from '../stickers/share'
import { Flame, Melt } from '../../ui/Flame'
import { Ink } from '../../ui/Ink'
import { getDraft, icebreaker, setDraft, takeIce } from '../../lib/drafts'
import { sendToy, startGame, useGames, useGhost } from '../../lib/engine'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'wouter'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useConnection, useHasMore, useLoadingOlder, useMe, useMessages, useMyLastStatus, useNow, usePeerStatus, usePeerTyping, useResolveChat } from '../../lib/hooks'
import { setFriend, loadOlder, react, respondRequest, retry, sendMessage, setActiveConv, setTyping, setBlocked, setVoice, setImages, sendConfetti, onPeerConfetti, openOnce, unsend } from '../../lib/engine'
import { activeAgo, daySeparator, emojiOnlyCount, hereFor, linkify, needsSeparator, sameGroup } from '../../lib/format'
import type { Conversation, Message } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Badge, Sheet, TypingDots, spring, useIsDesktop } from '../../ui/kit'
import { GenderIcon, IconImage, IconMic, IconClose, IconReply, IconAlert, IconArrowDown, IconBack, IconGear, IconSend, IconGhost, IconHi, IconAddFriend, IconFriend, IconLock, IconClock, IconPlus, IconShare, IconCopy, IconTrash, IconBan, IconDice, IconEightBall, IconTicTacToe, IconScissors, IconPhone } from '../../ui/icons'
import { getTheme, themeVars } from '../../themes/themes'
import { useThemeMode } from '../../themes/mode'
import { goBack, queueRoll } from '../shell/nav'
import { EasterEgg } from './EasterEgg'
import { Recorder } from '../voice/Recorder'
import { VoiceBubble } from '../voice/VoiceBubble'
import { audioType, readAudioFile, uploadVoice, voiceBody, voiceOf } from '../voice/voice'
import { GONE, imageOf, imageBody, prepImage, uploadImage } from '../image/image'
import { useChill } from '../../lib/chill'
import { ImageBubble } from '../image/ImageBubble'
import { Confetti, type ConfettiHandle } from './Confetti'
import { LockedSticker, Sticker } from '../stickers/Sticker'
import { useStore } from '../../lib/store'
import { NSFW_STICKERS, STICKERS, coupleOf, displayBody, stickerOf } from '../stickers/stickers'
import { CoupleSticker } from '../stickers/CoupleSticker'
import { EMOJI_GROUPS } from './emojis'
import { Aura } from '../../ui/Aura'
import { useFlairFor } from '../../ui/flair'
import { ThemeBackground } from './ThemeReveal'
import { landingFor } from '../../themes/ambientPrefs'
import { maybeTour } from '../guide/Tour'
import { isCallPair, startCall, useCall } from '../call/call'

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
  const dead = status === 'not_found' || status === 'self'
  // the real chat chrome right away, so nothing jumps when the chat arrives
  return (
    <div className="chat" style={themeVars(t)}>
      <div className="chat-bg" style={{ background: t.bg }} />
      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
        {!dead && (
          <span className="chat-peer">
            <GoofyFace name={username} size={40} />
            <span className="chat-peer-text">
              <span className="chat-peer-name">
                <span className="ellipsis">{username}</span>
              </span>
            </span>
          </span>
        )}
      </header>
      <div className="chat-center">
        <GoofyFace name={dead ? 'nobody.here' : username} size={120} mood={dead ? 'shocked' : 'neutral'} />
        {dead ? (
          <>
            <p className="chat-center-name">{status === 'self' ? "that's you" : 'nobody by that name'}</p>
            <button type="button" className="empty-act is-ink" onClick={() => goBack(nav)}>
              {status === 'self' ? 'go home' : 'find someone'}
            </button>
          </>
        ) : (
          <TypingDots />
        )}
      </div>
      {!dead && (
        <div className="composer-wrap">
          <div className="composer is-skeleton" aria-hidden="true">
            <span className="stk-toggle"><IconPlus size={24} /></span>
            <span className="composer-ghost" />
          </div>
        </div>
      )}
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
  const conn = useConnection()
  const now = useNow(30000)
  const [info, setInfo] = useState(false)
  const [egg, setEgg] = useState(0)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [wishOpen, setWishOpen] = useState(false)
  // a line picked on the way in (roll, say hi): the first chip on an empty chat, otherwise prefilled
  const [ice] = useState(() => takeIce(peer.username))
  const confetti = useRef<ConfettiHandle>(null)
  const taps = useRef<{ n: number; t: number; x: number; y: number }>({ n: 0, t: 0, x: 0, y: 0 })
  const themeId = useRef(conv.theme)
  themeId.current = conv.theme
  // 4 quick taps, or the confetti tile: the theme's own effect when it has one, confetti otherwise
  const pop = (x: number, y: number) => {
    const landing = landingFor(conv.id)
    const fx = FX_BY_THEME[conv.theme ?? '']
    if (fx) {
      fireFx(fx)
      if (fx === 'thunder') navigator.vibrate?.([30, 50, 80])
      if (fx === 'wish') setTimeout(() => setWishOpen(true), 1500)
      if (fx === 'bloom') confetti.current?.shower(fxSource(), landing)
    } else confetti.current?.burst(x, y, landing)
    sendConfetti(conv.id, { x: Math.min(1, Math.max(0, x / window.innerWidth)), y: Math.min(1, Math.max(0, y / window.innerHeight)) }, landing)
  }
  const onChatTap = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, .sheet, .panel, .mm')) return
    const k = taps.current
    const now = performance.now()
    if (now - k.t < 360 && Math.hypot(e.clientX - k.x, e.clientY - k.y) < 60) k.n++
    else k.n = 1
    k.t = now
    k.x = e.clientX
    k.y = e.clientY
    if (k.n >= 4) {
      k.n = 0
      pop(k.x, k.y)
    }
  }
  useEffect(
    () =>
      onPeerConfetti((id, pos, landing) => {
        if (id !== conv.id) return
        const fx = FX_BY_THEME[themeId.current ?? '']
        if (fx) {
          fireFx(fx)
          if (fx === 'bloom') confetti.current?.shower(fxSource(), landing)
          return
        }
        if (pos) confetti.current?.burst(pos.x * window.innerWidth, pos.y * window.innerHeight, landing)
        else confetti.current?.rain(landing)
      }),
    [conv.id],
  )
  useEffect(() => setReplyTo(null), [conv.id])
  const chatRef = useRef<HTMLDivElement>(null)
  const [themeBump, setThemeBump] = useState(false)
  const me = useMe()
  const spicy = useStore((s) => s.me?.nsfw === true && peerNsfw(s, conv.peer))
  const calling = useCall((c) => c.state !== 'idle' && c.state !== 'ended')
  const peerFl = useFlairFor(conv.peer.username)
  const peerAura = peerFl?.aura
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
  useEffect(() => maybeTour('chat', 900), [])

  const offline = conn === 'offline'
  let statusLine: React.ReactNode = null
  if (offline)
    statusLine = (
      <span className="st-typing">
        connecting<TypingDots />
      </span>
    )
  else if (status.typing)
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
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
        <button type="button" className={'chat-peer' + (plate ? ' has-aura' : '')} onClick={() => setInfo(true)} aria-label={peer.username + ', chat info'}>
          {plate && <Aura id={peerAura} />}
          <GoofyFace name={peer.username} size={40} presence={!offline && conv.peer.show_status !== false && me?.show_status !== false && status.online ? (status.away ? 'away' : 'online') : null} />
          <div className="chat-peer-text">
            <span className="chat-peer-name">
              <span className="ellipsis">{peer.username}</span>
              {peerFl && <i className="vchk" aria-label="verified" />}
              <Flame convId={conv.id} />
              <Melt convId={conv.id} />
            </span>
            <AnimatePresence mode="wait" initial={false}>
              {statusLine && (
                <motion.span key={String(offline) + String(status.typing) + String(status.online)} className={'chat-peer-status' + (status.typing || offline ? ' is-typing' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                  {statusLine}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </button>
        {isCallPair(me, peer, conv) && !conv.blocked && (
          <button className="icon-btn call-start" onClick={() => void startCall(conv)} aria-label={'call ' + peer.username} disabled={calling}>
            <IconPhone size={23} />
          </button>
        )}
        <button className="icon-btn" onClick={() => setInfo(true)} aria-label="chat info">
          <IconGear size={24} />
        </button>
      </header>

      <MessageList conv={conv} now={now} sinceOnline={status.since} online={status.online} onReply={setReplyTo} ice={ice && !ice.auto && !conv.last_message ? ice.text : null} />
      <ChatFooter
        conv={conv}
        meId={me?.id ?? null}
        now={now}
        onEgg={() => setEgg((n) => n + 1)}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        ice={ice && (ice.auto || conv.last_message) ? ice : null}
        onWish={() => setWishOpen(true)}
        onConfetti={() => pop(window.innerWidth / 2, window.innerHeight / 2)}
      />
      <AnimatePresence>{egg > 0 && <EasterEgg key="egg" me={me?.username ?? ''} />}</AnimatePresence>

      <WishSheet convId={conv.id} open={wishOpen} onClose={() => setWishOpen(false)} />
      <Sheet open={info} onClose={() => setInfo(false)} label="chat info">
        <ChatInfo conv={conv} onClose={() => setInfo(false)} />
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ messages */

/** Remembers where unread starts when a chat opens, and keeps the newest messages in view while things around the list resize. */
export function useChatScroll(scroller: React.RefObject<HTMLDivElement | null>, inner: React.RefObject<HTMLDivElement | null>, atBottom: React.RefObject<boolean>) {
  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // the tray, the reply bar, the recorder, the keyboard and late loading cards all change sizes; stick to the bottom if we were there
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [scroller, inner, atBottom])
}

function MessageList({ conv, now, sinceOnline, online, onReply, ice }: { conv: Conversation; now: number; sinceOnline: string | null; online: boolean; onReply: (m: Message) => void; ice: string | null }) {
  const me = useMe()
  const allMsgs = useMessages(conv.id)
  // only messages that arrive while the chat is open animate in; opening a chat paints instantly
  const openedAt = useRef(Date.now())
  // the very first message anyone gets from a stranger shows the double-tap heart once, no words
  const [hintId] = useState<string | null>(() => {
    try {
      if (localStorage.getItem('gat.hint.dbl')) return null
      const last = [...allMsgs].reverse().find((x) => x.sender_id !== me?.id && x.kind === 'text' && !x.body.startsWith('[['))
      if (last) localStorage.setItem('gat.hint.dbl', '1')
      return last?.id ?? null
    } catch {
      return null
    }
  })
  const msgs = useMemo(() => allMsgs.filter((x) => x.body !== '[[unsent]]' && !isWishReply(x.body) && !isTotReply(x.body)), [allMsgs])
  // where 'new' starts, fixed at open so it doesn't jump around while you read
  const [newFrom] = useState<string | null>(() => {
    if (!conv.unread) return null
    const at = Date.parse(conv.my_last_read_at || '') || 0
    return msgs.find((x) => x.sender_id !== me?.id && Date.parse(x.created_at) > at)?.id ?? null
  })
  const typing = usePeerTyping(conv.id)
  const mine = useMyLastStatus(conv.id)
  const hasMore = useHasMore(conv.id)
  const loadingOlder = useLoadingOlder(conv.id)
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [far, setFar] = useState(false)
  const [missed, setMissed] = useState(0)
  const firstId = msgs[0]?.id
  const lastId = msgs[msgs.length - 1]?.id
  const prevFirst = useRef(firstId)
  const prevLast = useRef(lastId)
  const prevHeight = useRef(0)
  const mounted = useRef(false)
  useChatScroll(scroller, inner, atBottom)

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
      const sep = newFrom ? el.querySelector<HTMLElement>('.sep.is-new') : null
      // lots unread: start at the 'new' line; a few: just the bottom
      if (sep && el.scrollHeight - sep.offsetTop > el.clientHeight) {
        el.scrollTop = Math.max(0, sep.offsetTop - 70)
        atBottom.current = false
      } else el.scrollTop = el.scrollHeight
    } else if (firstId !== prevFirst.current && lastId === prevLast.current) {
      // older page prepended: keep the visual position
      el.scrollTop += el.scrollHeight - prevHeight.current
    } else if (lastId !== prevLast.current) {
      const last = msgs[msgs.length - 1]
      if (atBottom.current || (last && last.sender_id === me?.id)) toBottom(true)
      else if (last) setMissed((n) => n + 1)
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
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottom.current = gap < 90
    if (atBottom.current && missed) setMissed(0)
    const f = gap > el.clientHeight * 0.8
    if (f !== far) setFar(f)
  }

  const peer = conv.peer
  const items: React.ReactNode[] = []
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    const prev = msgs[i - 1]
    const next = msgs[i + 1]
    if (needsSeparator(prev, m)) items.push(<div key={'sep' + m.id} className="sep">{daySeparator(m.created_at, now)}</div>)
    if (m.id === newFrom) items.push(<div key="new" className="sep is-new">new</div>)
    if (m.body === '[[friends]]') {
      items.push(
        <motion.div key={m.id} className="sys is-friends" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
          <IconFriend size={14} /> you're friends now
        </motion.div>,
      )
      continue
    }
    if (m.body === '[[call]]') {
      items.push(
        <div key={m.id} className="sys is-call">
          <IconPhone size={13} /> {m.sender_id === me?.id ? 'you called' : peer.username + ' called'}
        </div>,
      )
      continue
    }
    if (m.kind === 'theme') {
      // trying a few themes in a row leaves one line, the last pick
      if (next?.kind === 'theme') continue
      const who = m.sender_id === me?.id ? 'you' : peer.username
      const t = getTheme(m.body)
      items.push(
        <motion.div key={m.id} className="sys is-theme" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
          <i className="sys-dot" style={{ background: t.bg }} />
          <b className="ellipsis">{who}</b>&nbsp;picked {t.name}
        </motion.div>,
      )
      continue
    }
    const isMine = m.sender_id === me?.id
    const joinPrev = sameGroup(prev, m) && !needsSeparator(prev, m) && m.id !== newFrom
    const joinNext = !!next && sameGroup(m, next) && !needsSeparator(m, next) && next.id !== newFrom
    items.push(
      <Fragment key={m.id}>
        <Bubble m={m} mine={isMine} joinPrev={joinPrev} joinNext={joinNext} peerName={peer.username} meId={me?.id ?? null} onReply={onReply} fresh={Date.parse(m.created_at) > openedAt.current - 5000} hint={m.id === hintId} />
        {isMine && mine?.id === m.id && <MineStatus state={mine.state === 'seen' && me?.show_seen === false ? 'sent' : mine.state} id={m.id} />}
      </Fragment>,
    )
  }

  return (
    <div className="msgs-wrap">
      <div className="msgs scroll-y" ref={scroller} onScroll={onScroll}>
        <div ref={topSentinel} className="msgs-top">{loadingOlder && <TypingDots />}</div>
        {msgs.length === 0 ? (
          <EmptyChat conv={conv} now={now} sinceOnline={sinceOnline} online={online} ice={ice} />
        ) : (
          <div className="msgs-inner" ref={inner}>{items}</div>
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
        {(far || missed > 0) && (
          <motion.button
            className="jump"
            aria-label="latest messages"
            onClick={() => {
              toBottom(true)
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

function MineStatus({ state, id }: { state: 'sending' | 'failed' | 'sent' | 'seen'; id: string }) {
  if (state === 'sending') return <div className="mine-status" aria-label="sending"><IconClock size={12} /></div>
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

function Bubble({ m, mine, joinPrev, joinNext, peerName, meId, onReply, fresh, hint }: { m: Message; mine: boolean; joinPrev: boolean; joinNext: boolean; peerName: string; meId: string | null; onReply: (m: Message) => void; fresh?: boolean; hint?: boolean }) {
  const moved = useRef(false)
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const bubble = useRef<HTMLDivElement>(null)
  const dx = useMotionValue(0)
  const replyHint = useTransform(dx, [0, 60], [0, 1])
  const replyHintScale = useTransform(dx, [0, 60], [0.4, 1])
  const myName = useMe()?.username ?? ''
  const stk = stickerOf(m.body)
  const cpl = coupleOf(m.body)
  const voice = voiceOf(m.body)
  const toy = toyOf(m.body)
  const wish = wishOf(m.body)
  const tot = totOf(m.body)
  const game = gameOf(m.body)
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
  const card = !!(toy || game || wish || tot !== null)
  const plain = !stk && !cpl && !voice && !img && !gone && !card
  const cls = ['b', mine ? 'mine' : 'theirs', joinPrev ? 'jp' : '', joinNext ? 'jn' : '', big ? 'b-emoji' : '', stk || cpl ? 'b-sticker' : '', card ? 'b-toy' : '', voice ? 'b-voice' : '', img ? 'b-img' : ''].join(' ')
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [burst, setBurst] = useState(0)
  const [more, setMore] = useState(false)
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const lastTap = useRef(0)
  const reactions = m.reactions ?? {}
  const mineR = meId ? reactions[meId] : undefined
  const counts = new Map<string, number>()
  for (const e of Object.values(reactions)) counts.set(e, (counts.get(e) ?? 0) + 1)
  const chips = [...counts.entries()]

  const openMenu = () => {
    press.current = null
    const r = bubble.current?.getBoundingClientRect()
    if (!r) return
    navigator.vibrate?.(10)
    setMenu(r)
  }
  const closeMenu = useCallback(() => setMenu(null), [])
  const onDown = (e: React.PointerEvent) => {
    moved.current = false
    if ((e.target as HTMLElement).closest('a, button, input')) return
    press.current = { t: setTimeout(openMenu, 380), x: e.clientX, y: e.clientY }
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
  const onUp = (e: React.PointerEvent) => {
    const wasPress = !press.current
    cancel()
    if (moved.current || wasPress || menu || (e.target as HTMLElement).closest('a, button, input')) return
    const now = Date.now()
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current)
      lastTap.current = 0
      if (mineR !== '❤️') setBurst((b) => b + 1)
      react(m.conversation_id, m.id, '❤️')
    } else {
      lastTap.current = now
      clearTimeout(tapTimer.current)
      tapTimer.current = setTimeout(() => (img && !(once && mine) ? setViewer(true) : openMenu()), 290)
    }
  }
  const pick = (e: string) => {
    setMenu(null)
    if (e !== mineR) setBurst((b) => b + 1)
    react(m.conversation_id, m.id, e)
  }
  const actions: MenuAction[] = [
    { id: 'reply', label: 'reply', ico: <IconReply size={19} />, go: () => (setMenu(null), onReply(m)) },
    ...(plain ? [{ id: 'copy', label: 'copy', ico: <IconCopy size={19} />, go: () => (setMenu(null), void navigator.clipboard?.writeText(m.body).catch(() => {})) }] : []),
    ...(stk ? [{ id: 'share', label: 'share sticker', ico: <IconShare size={19} />, go: () => (setMenu(null), void shareSticker(document.querySelector(`[data-mid="${m.id}"] .stk`), STICKERS.find((x) => x.id === stk)?.caption ?? 'sticker')) }] : []),
    ...(mine ? [{ id: 'unsend', label: 'unsend', ico: <IconTrash size={19} />, danger: true, go: () => (setMenu(null), void unsend(m)) }] : []),
  ]

  return (
    <motion.div
      data-mid={m.id}
      className={'b-row ' + (mine ? 'mine' : 'theirs') + (joinNext ? ' jn' : '') + (chips.length ? ' has-reacts' : '') + (hint ? ' b-hint' : '') + (menu ? ' is-menu' : '')}
      initial={fresh ? { opacity: 0, x: mine ? 14 : -14, y: 8, scale: 0.94 } : false}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={spring}
    >
      {!mine && <span className="b-face">{!joinNext && <GoofyFace name={peerName} size={28} blink={false} />}</span>}
      <div className="b-wrap">
        <motion.span className="swipe-hint" style={{ opacity: replyHint, scale: replyHintScale }}>
          <IconReply size={18} />
        </motion.span>
        <motion.div
          ref={bubble}
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
          data-mid={m.id}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={cancel}
          onPointerLeave={cancel}
          onContextMenu={(e) => {
            e.preventDefault()
            openMenu()
          }}
          animate={menu ? { scale: 1.03 } : { scale: 1 }}
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
          {img ? <ImageBubble img={img} open={viewer} blur={once} onClose={() => setViewer(false)} /> : gone ? <span className="once-gone"><IconImage size={16} /> opened</span> : voice ? <VoiceBubble note={voice} /> : cpl ? <CoupleSticker kind={cpl} a={mine ? myName : peerName} b={mine ? peerName : myName} size={180} /> : stk ? (NSFW_STICKERS.includes(stk) && !spicy ? <LockedSticker size={140} /> : <Sticker kind={stk} name={mine ? myName : peerName} size={140} />) : tot !== null ? <TotCard m={m} meId={meId} peerName={peerName} /> : wish !== null ? <WishCard m={m} mine={mine} peerName={peerName} /> : toy ? <ToyBubble toy={toy} fresh={fresh} forName={mine ? peerName : 'you'} /> : game ? <GameBubble id={game} meId={meId} peerName={peerName} /> : linkify(m.body).map((p, i) =>
            p.href ? (
              <a key={i} href={p.href} target="_blank" rel="noreferrer noopener">
                {p.text}
              </a>
            ) : (
              <Ink key={i} text={p.text} />
            ),
          )}
        </motion.div>
        {img && (
          <button type="button" className="b-more" aria-label="message options" onClick={openMenu}>
            <i />
            <i />
            <i />
          </button>
        )}
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
              onClick={openMenu}
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
      </div>
      <AnimatePresence>
        {menu && (
          <MessageMenu
            anchor={menu}
            mine={mine}
            current={mineR}
            onReact={pick}
            onMore={() => {
              setMenu(null)
              setMore(true)
            }}
            actions={actions}
            onClose={closeMenu}
          />
        )}
      </AnimatePresence>
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

function EmptyChat({ conv, now, sinceOnline, online, ice }: { conv: Conversation; now: number; sinceOnline: string | null; online: boolean; ice: string | null }) {
  const p = conv.peer
  const sub = online ? hereFor(sinceOnline, now) : activeAgo(p.last_seen_at, now)
  const about = [p.show_age && p.age ? String(p.age) : '', p.place ?? ''].filter(Boolean).join(' · ')
  const [pair, setPair] = useState(() => twoIce())
  const ghost = useGhost((g) => g.on)
  const open = !conv.blocked && conv.status !== 'declined' && !(ghost && !conv.status)
  const chips = [...(ice ? [ice] : []), 'hi', ...pair]
  return (
    <motion.div className="chat-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <GoofyFace name={p.username} size={124} look={{ x: 0, y: 0.9 }} />
      <p className="chat-empty-name">{p.username}</p>
      {sub && <p className="chat-empty-sub">{sub}</p>}
      {(about || p.bio) && (
        <div className="chat-empty-about">
          {about && (
            <span className="chat-empty-meta">
              <GenderIcon g={p.gender} size={14} className={'g-ico g-' + p.gender} />
              {about}
            </span>
          )}
          {p.bio && <p className="chat-empty-bio">{p.bio}</p>}
        </div>
      )}
      {open && (
        <div className="ice-chips">
          {chips.map((c, i) => (
            <motion.button key={c + i} type="button" className={'ice-chip' + (i === 0 ? ' is-main' : '')} whileTap={{ scale: 0.95 }} onClick={() => sendMessage(conv.id, c)}>
              {c === 'hi' ? (
                <>
                  <IconHi size={18} /> say hi
                </>
              ) : (
                c
              )}
            </motion.button>
          ))}
          <button type="button" className="ice-shuffle" aria-label="other lines" onClick={() => setPair(twoIce())}>
            <IconDice size={18} />
          </button>
        </div>
      )}
    </motion.div>
  )
}

function twoIce(): string[] {
  const a = icebreaker()
  let b = icebreaker()
  for (let i = 0; i < 6 && b === a; i++) b = icebreaker()
  return [a, b]
}

/** Strangers become friends when both add each other. Shows once you've actually been talking, or when they added you. */
function FriendBar({ conv, meId }: { conv: Conversation; meId: string | null }) {
  const mine = !!conv.my_friend
  const theirs = !!conv.peer_friend
  const msgs = useMessages(conv.id)
  const key = 'gat.fbar.' + conv.id
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(key)
    } catch {
      return false
    }
  })
  const [sent, setSent] = useState(false)
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(false), 2000)
    return () => clearTimeout(t)
  }, [sent])
  if (conv.status === 'pending' || conv.status === 'declined' || conv.blocked || (mine && theirs)) return null
  const name = conv.peer.username
  let body: React.ReactNode = null
  if (sent) body = <span className="fbar-text is-quiet"><IconFriend size={18} /> requested</span>
  else if (theirs && !mine)
    body = (
      <>
        <GoofyFace name={name} size={28} blink={false} />
        <span className="fbar-text"><b className="ellipsis">{name}</b>&nbsp;added you</span>
        <button type="button" className="fbar-go" onClick={() => void setFriend(conv.id, true)}>
          add back
        </button>
      </>
    )
  else if (!mine && !hidden) {
    let a = 0
    let b = 0
    for (const x of msgs) {
      if (x.kind !== 'text') continue
      if (x.sender_id === meId) a++
      else b++
    }
    if (a >= 3 && b >= 3)
      body = (
        <>
          <IconAddFriend size={20} />
          <span className="fbar-text">add&nbsp;<b className="ellipsis">{name}</b></span>
          <button
            type="button"
            className="fbar-go"
            onClick={() => {
              void setFriend(conv.id, true)
              setSent(true)
            }}
          >
            add
          </button>
          <button
            type="button"
            className="fbar-x"
            aria-label="hide"
            onClick={() => {
              try {
                localStorage.setItem(key, '1')
              } catch {
                /* blocked */
              }
              setHidden(true)
            }}
          >
            <IconClose size={16} />
          </button>
        </>
      )
  }
  return (
    <AnimatePresence initial={false}>
      {body && (
        <motion.div key="fbar" className="fbar" initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 6, height: 0 }} transition={spring}>
          <div className="fbar-in">{body}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** One-tap block on a request, with the same 'block?' confirm used everywhere. */
function ArmBlock({ id, onDone }: { id: string; onDone: () => void }) {
  const [arm, setArm] = useState(false)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 3000)
    return () => clearTimeout(t)
  }, [arm])
  return (
    <button
      type="button"
      className={'req-block' + (arm ? ' is-armed' : '')}
      onClick={() => {
        if (!arm) return setArm(true)
        void setBlocked(id, true)
        onDone()
      }}
    >
      <IconBan size={16} />
      {arm ? 'block?' : 'block'}
    </button>
  )
}

/* ------------------------------------------------------------------ requests / blocks */

type FooterProps = { conv: Conversation; meId: string | null; now: number; onEgg: () => void; replyTo: Message | null; onClearReply: () => void; ice: { text: string; auto: boolean } | null; onWish: () => void; onConfetti: () => void }

function ChatFooter(props: FooterProps) {
  const { conv, meId, now } = props
  const [, nav] = useLocation()
  const ghost = useGhost((g) => g.on)
  const name = conv.peer.username
  const another = (
    <button type="button" className="req-no" onClick={() => (queueRoll(), goBack(nav))}>
      <IconDice size={16} /> roll another
    </button>
  )
  let content: React.ReactNode = null
  let incoming = false
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
  else if (ghost && !conv.status) content = <p className="ghost-only"><IconGhost size={16} /> ghosts can only reply</p>
  else if (conv.status === 'pending' && conv.requester === meId)
    content = (
      <>
        <p>
          waiting for <b>{name}</b>
        </p>
        <div className="req-actions">{another}</div>
      </>
    )
  else if (conv.status === 'pending' && conv.requester && conv.requester !== meId) {
    incoming = true
    content = (
      <>
        <div className="req-who">
          <GoofyFace name={name} size={40} />
          <span>
            <b>{name}</b> wants to chat
            {conv.peer.bio && <small className="ellipsis">{conv.peer.bio}</small>}
          </span>
        </div>
        <div className="req-actions">
          <ArmBlock id={conv.peer.id} onDone={() => goBack(nav)} />
          <button type="button" className="req-no" onClick={() => void respondRequest(conv.id, false).then(() => goBack(nav), () => {})}>
            decline
          </button>
          <button type="button" className="req-yes" onClick={() => void respondRequest(conv.id, true)}>
            accept
          </button>
        </div>
      </>
    )
  } else if (conv.status === 'declined' && conv.requester !== meId)
    content = (
      <>
        <p>
          you passed on <b>{name}</b>
        </p>
        <div className="req-actions">{another}</div>
      </>
    )
  else if (conv.status === 'declined' && conv.requester === meId && conv.declined_at) {
    const left = new Date(conv.declined_at).getTime() + 86400000 - now
    if (left > 0) {
      const h = Math.floor(left / 3600000)
      const m = Math.max(1, Math.ceil((left % 3600000) / 60000))
      content = (
        <>
          <p>
            not now. try again in{' '}
            <b className="tnum">
              {h}h {m}m
            </b>
          </p>
          <div className="req-actions">{another}</div>
        </>
      )
    }
  }
  const composer = <Composer {...props} acceptFirst={incoming} />
  if (!content)
    return (
      <>
        <FriendBar conv={conv} meId={meId} />
        {composer}
      </>
    )
  return (
    <>
      <motion.div className="req" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
        {content}
      </motion.div>
      {/* replying to a request accepts it */}
      {incoming && composer}
    </>
  )
}

/* ------------------------------------------------------------------ composer */

const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

/** The newest running game in this chat where it's your move, so it never gets lost up in the history. */
function useMyMove(convId: string, meId: string | null): { mid: string; kind: 'rps' | 'ttt' } | null {
  const msgs = useMessages(convId)
  const ids = useMemo(() => {
    const out: [string, string][] = []
    for (const m of msgs) {
      const g = gameOf(m.body)
      if (g) out.push([g, m.id])
    }
    return out.slice(-6)
  }, [msgs])
  const key = useGames((s) => {
    for (let i = ids.length - 1; i >= 0; i--) {
      const g = s[ids[i][0]]
      if (!g || g.done) continue
      const side = g.a === meId ? 'a' : 'b'
      const st = g.state as { turn?: string; moved?: Record<string, boolean> }
      const my = g.kind === 'ttt' ? st.turn === side : !st.moved?.[side]
      return my ? ids[i][1] + '|' + g.kind : ''
    }
    return ''
  })
  if (!key) return null
  const [mid, kind] = key.split('|')
  return { mid, kind: kind as 'rps' | 'ttt' }
}

function Composer({ conv, onEgg, replyTo, onClearReply, meId, ice, onWish, onConfetti, acceptFirst }: FooterProps & { acceptFirst: boolean }) {
  const [tray, setTray] = useState(false)
  const [trayTab, setTrayTab] = useState<TrayTab>(lastTrayTab)
  const [recording, setRecording] = useState(false)
  const myName = useMe()?.username ?? ''
  const spicyTray = useStore((s) => s.me?.nsfw === true && peerNsfw(s, conv.peer))
  const [text, setText] = useState(() => getDraft(conv.id) || (ice && !ice.auto ? ice.text : ''))
  useEffect(() => {
    if (ice?.auto) sendMessage(conv.id, ice.text, null)
  }, [ice, conv.id])
  useEffect(() => setDraft(conv.id, text), [conv.id, text])
  const ta = useRef<HTMLTextAreaElement>(null)
  const lastSent = useRef<{ body: string; at: number } | null>(null)
  const has = text.trim().length > 0
  const media = (mine?: boolean, theirs?: boolean): Media => (mine && theirs ? 'ok' : mine ? 'asked' : 'off')
  const images = media(conv.my_images, conv.peer_images)
  const voice = media(conv.my_voice, conv.peer_voice)
  const [ask8, setAsk8] = useState(false)
  const [nudgeOff, setNudgeOff] = useState(false)
  const chill = useChill((c) => c.until > 0)
  const onceRef = useRef(false)
  const [upload, setUpload] = useState<{ preview: string; file: File; once: boolean; reply: Message | null; err?: boolean } | null>(null)
  const [doodle, setDoodle] = useState(false)
  const move = useMyMove(conv.id, meId)
  // A fresh native input per tap, no accept filter: on some Android phones the gallery app never
  // returns the photo to Chrome, while the system document picker does. Some Androids only fire 'input'.
  const [aud, setAud] = useState<'sending' | 'big' | 'error' | 'failed' | 'asked' | null>(null)
  const openPicker = (kind: 'image' | 'audio' = 'image') => {
    const el = document.createElement('input')
    el.type = 'file'
    if (kind === 'audio') el.accept = 'audio/*'
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0'
    let handled = false
    const take = () => {
      if (handled) return
      handled = true
      void (kind === 'audio' ? pickAudio(el.files?.[0]) : pickImage(el.files?.[0]))
      setTimeout(() => el.remove(), 1000)
    }
    el.addEventListener('change', take)
    el.addEventListener('input', take)
    el.addEventListener('cancel', () => el.remove())
    document.body.appendChild(el)
    el.click()
  }
  // an audio file from the phone goes out as a voice note (same player, real waveform); never video
  const pickAudio = async (file: File | undefined) => {
    if (!file) return
    if (!audioType(file, file.name)) return flash('error')
    if (file.size > 5 * 1024 * 1024) return flash('big')
    setAud('sending')
    const reply = replyTo
    onClearReply()
    try {
      const { dur, peaks } = await readAudioFile(file)
      const url = await uploadVoice(file, meId ?? 'anon', file.name)
      sendMessage(conv.id, voiceBody(url, Math.max(1, dur), peaks), reply)
      setAud(null)
    } catch {
      flash('error')
    }
  }
  const flash = (s: 'big' | 'error' | 'failed' | 'asked') => {
    setAud(s)
    setTimeout(() => setAud(null), 3000)
  }
  const sendImage = async (file: File, once: boolean, reply: Message | null, preview: string) => {
    setUpload({ preview, file, once, reply })
    try {
      const { blob, w, h } = await prepImage(file)
      const url = await uploadImage(blob, meId ?? 'anon')
      sendMessage(conv.id, imageBody(url, w, h, once), reply)
      setUpload(null)
      URL.revokeObjectURL(preview)
    } catch {
      // stays up with retry and discard, never silently gone
      setUpload({ preview, file, once, reply, err: true })
    }
  }
  const pickImage = async (file: File | undefined) => {
    if (!file) return
    if (file.type && !file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name)) return
    const reply = replyTo
    onClearReply()
    await sendImage(file, onceRef.current, reply, URL.createObjectURL(file))
  }
  const discardUpload = () => {
    if (upload) URL.revokeObjectURL(upload.preview)
    setUpload(null)
  }
  // turning a media type on for this chat: live right away if they have it on, otherwise it waits on them
  const askImages = () => {
    void setImages(conv.id, true)
    if (!conv.peer_images) flash('asked')
  }
  const askVoice = () => {
    void setVoice(conv.id, true)
    if (!conv.peer_voice) flash('asked')
  }
  const toyFail = (p: Promise<unknown>) => void p.catch(() => flash('failed'))

  const resize = () => {
    const el = ta.current
    if (!el) return
    // setting height to auto resets the scroll, so long text jumped back to the top and hid what you were typing
    const max = Math.max(132, Math.round(window.innerHeight * 0.28))
    const atEnd = el.selectionStart >= el.value.length - 1
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
    if (atEnd && el.scrollHeight > max) el.scrollTop = el.scrollHeight
  }
  useLayoutEffect(resize, [text])

  useEffect(() => {
    if (fine) ta.current?.focus()
    return () => setTyping(conv.id, false)
  }, [conv.id])

  const closeTray = () => setTray(false)
  const send = async () => {
    const body = text.trim()
    if (!body) return
    if (acceptFirst) await respondRequest(conv.id, true).catch(() => {})
    if (ask8) {
      setAsk8(false)
      setText('')
      toyFail(sendToy(conv.id, '8ball', body))
      return
    }
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
      void send()
    }
  }
  const sendSticker = (body: string) => {
    if (acceptFirst) void respondRequest(conv.id, true).catch(() => {})
    sendMessage(conv.id, body, replyTo)
    onClearReply()
  }
  // they turned photos or voice on and you haven't: one tap to match
  const nudge = nudgeOff ? null : conv.peer_images && !conv.my_images ? 'photos' : conv.peer_voice && !conv.my_voice ? 'voice notes' : null

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
        {!replyTo && move && (
          <motion.button
            key="move"
            type="button"
            className="move-chip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={() => {
              const el = document.querySelector(`[data-mid="${move.mid}"]`)
              el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              el?.classList.add('flash')
              setTimeout(() => el?.classList.remove('flash'), 1200)
            }}
          >
            {move.kind === 'ttt' ? <IconTicTacToe size={18} /> : <IconScissors size={18} />}
            your move
          </motion.button>
        )}
        {!replyTo && !move && nudge && (
          <motion.div key="nudge" className="media-nudge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
            <GoofyFace name={conv.peer.username} size={24} blink={false} />
            <span>
              {nudge === 'photos' ? <IconImage size={16} /> : <IconMic size={16} />} {nudge}
            </span>
            <button type="button" className="fbar-go" onClick={() => (nudge === 'photos' ? void setImages(conv.id, true) : void setVoice(conv.id, true))}>
              turn on
            </button>
            <button type="button" className="fbar-x" aria-label="hide" onClick={() => setNudgeOff(true)}>
              <IconClose size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tray && (
          <motion.div className="stk-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <div className="stk-tray-in">
              <TrayTabs value={trayTab} onChange={setTrayTab} />
              {trayTab === 'play' ? (
                <PlayTray
                  images={images}
                  voice={voice}
                  onAskImages={askImages}
                  onAskVoice={askVoice}
                  onPhoto={(once) => {
                    closeTray()
                    onceRef.current = once
                    openPicker()
                  }}
                  onRecord={() => {
                    closeTray()
                    setRecording(true)
                  }}
                  onAudio={() => {
                    closeTray()
                    openPicker('audio')
                  }}
                  onDoodle={() => {
                    closeTray()
                    setDoodle(true)
                  }}
                  onTot={() => {
                    closeTray()
                    toyFail(Promise.resolve(sendTot(conv.id)))
                  }}
                  onGame={(k) => {
                    closeTray()
                    toyFail(startGame(conv.id, k))
                  }}
                  onToy={(k) => {
                    closeTray()
                    toyFail(sendToy(conv.id, k))
                  }}
                  on8ball={() => {
                    closeTray()
                    if (has) {
                      toyFail(sendToy(conv.id, '8ball', text))
                      setText('')
                    } else {
                      setAsk8(true)
                      ta.current?.focus()
                    }
                  }}
                  onWish={() => {
                    closeTray()
                    onWish()
                  }}
                  onConfetti={() => {
                    closeTray()
                    onConfetti()
                  }}
                />
              ) : trayTab === 'stickers' ? (
                <StickerTray name={myName} peerName={conv.peer.username} spicy={spicyTray} couples onSend={sendSticker} />
              ) : (
                <FacesTray onPick={(k) => setText((t) => (t && !/\s$/.test(t) ? t + ' ' : t) + k + ' ')} />
              )}
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
        <DoodleSheet open={doodle} onClose={() => setDoodle(false)} onSend={(f) => (setDoodle(false), void pickImage(f))} />
        {upload && (
          <motion.div key="up" className={'img-up' + (upload.err ? ' is-err' : '')} initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.9 }}>
            <img src={upload.preview} alt="" />
            {upload.err ? (
              <>
                <span>didn't send</span>
                <button type="button" className="img-up-btn" aria-label="retry" onClick={() => void sendImage(upload.file, upload.once, upload.reply, upload.preview)}>
                  <IconSend size={16} />
                </button>
                <button type="button" className="img-up-btn" aria-label="discard" onClick={discardUpload}>
                  <IconClose size={16} />
                </button>
              </>
            ) : (
              <TypingDots />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {aud && (
        <span className={'aud-pill' + (aud === 'sending' || aud === 'asked' ? '' : ' is-err')}>
          {aud === 'sending' ? 'sending audio...' : aud === 'big' ? 'too big, 5mb max' : aud === 'asked' ? `asked ${conv.peer.username}` : "couldn't send that"}
        </span>
      )}
      <div className="composer" style={recording ? { display: 'none' } : undefined}>
        <button
          type="button"
          className={'stk-toggle' + (tray ? ' is-on' : '')}
          aria-label={tray ? 'close' : 'more'}
          aria-expanded={tray}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!tray) ta.current?.blur()
            else ta.current?.focus()
            setTray((v) => !v)
          }}
        >
          <IconPlus size={24} />
        </button>
        {ask8 && (
          <button type="button" className="ask8" aria-label="stop asking the 8 ball" onClick={() => setAsk8(false)}>
            <IconEightBall size={16} />
            <IconClose size={12} />
          </button>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder={ask8 ? 'ask the 8 ball...' : 'message...'}
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
          {!has && !ask8 ? (
            <motion.button
              key="mic"
              type="button"
              className={'send mic' + (voice === 'ok' ? '' : ' is-locked')}
              aria-label={voice === 'ok' ? 'record voice note' : 'turn on voice notes'}
              initial={{ scale: 0, rotate: 40 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -30 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              whileTap={{ scale: 0.86 }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                if (voice === 'off') return askVoice()
                if (voice === 'asked') return flash('asked')
                setTray(false)
                ta.current?.blur()
                setRecording(true)
              }}
            >
              <IconMic size={21} />
              {voice !== 'ok' && (
                <i className="mic-badge">{voice === 'asked' ? <IconClock size={10} /> : <IconLock size={10} />}</i>
              )}
            </motion.button>
          ) : (
            <motion.button
              key="send"
              className="send"
              aria-label="send"
              disabled={!has}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 30 }}
              transition={{ type: 'spring', stiffness: 600, damping: 24 }}
              whileTap={{ scale: 0.86 }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => void send()}
            >
              {chill ? <GoofyFace name={myName} mood="shocked" size={26} blink={false} /> : <IconSend size={20} />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
