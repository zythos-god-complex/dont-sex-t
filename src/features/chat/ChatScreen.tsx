import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
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
import { loadOlder, nameHistory, respondRequest, retry, sendMessage, setActiveConv, setBlocked, setTheme, setTyping } from '../../lib/engine'
import { togglePush } from '../../lib/push'
import { activeAgo, relTime, daySeparator, emojiOnlyCount, hereFor, linkify, needsSeparator, sameGroup } from '../../lib/format'
import type { Conversation, Message } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { Sheet, Toggle, TypingDots, spring, useIsDesktop } from '../../ui/kit'
import { IconAlert, IconArrowDown, IconBack, IconBell, IconCheck, IconGear, IconSend } from '../../ui/icons'
import { THEMES, getTheme, themeVars } from '../../themes/themes'
import { goBack } from '../shell/nav'
import { EasterEgg } from './EasterEgg'
import { ThemeBackground, setThemeOrigin } from './ThemeReveal'

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
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
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
  const theme = getTheme(conv.theme)
  const peer = conv.peer
  const status = usePeerStatus(peer.id)
  const now = useNow(30000)
  const [settings, setSettings] = useState(false)
  const [egg, setEgg] = useState(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const [themeBump, setThemeBump] = useState(false)
  const firstTheme = useRef(true)
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false
      return
    }
    setThemeBump(true)
    const t = setTimeout(() => setThemeBump(false), 900)
    return () => clearTimeout(t)
  }, [theme.id])
  const me = useMe()

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
    <div ref={chatRef} className={'chat scheme-' + theme.scheme + (themeBump ? ' theme-bump' : '')} style={themeVars(theme)}>
      <ThemeBackground themeId={theme.id} host={chatRef} />

      <header className="chat-head">
        {!desktop && (
          <button className="icon-btn" onClick={() => goBack(nav)} aria-label="back">
            <IconBack size={26} />
          </button>
        )}
        <div className="chat-peer">
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
        </div>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="chat settings">
          <IconGear size={24} />
        </button>
      </header>

      <MessageList conv={conv} now={now} sinceOnline={status.since} online={status.online} />
      <ChatFooter conv={conv} meId={me?.id ?? null} now={now} onEgg={() => setEgg((n) => n + 1)} />
      <AnimatePresence>{egg > 0 && <EasterEgg key="egg" me={me?.username ?? ''} />}</AnimatePresence>

      <Sheet open={settings} onClose={() => setSettings(false)} label="chat settings">
        <SettingsBody conv={conv} onPicked={() => setSettings(false)} />
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------ messages */

function MessageList({ conv, now, sinceOnline, online }: { conv: Conversation; now: number; sinceOnline: string | null; online: boolean }) {
  const me = useMe()
  const msgs = useMessages(conv.id)
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
        <Bubble m={m} mine={isMine} joinPrev={joinPrev} joinNext={joinNext} peerName={peer.username} />
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

function Bubble({ m, mine, joinPrev, joinNext, peerName }: { m: Message; mine: boolean; joinPrev: boolean; joinNext: boolean; peerName: string }) {
  const emoji = emojiOnlyCount(m.body)
  const big = emoji > 0 && emoji <= 3
  const cls = ['b', mine ? 'mine' : 'theirs', joinPrev ? 'jp' : '', joinNext ? 'jn' : '', big ? 'b-emoji' : ''].join(' ')
  return (
    <motion.div
      className={'b-row ' + (mine ? 'mine' : 'theirs') + (joinNext ? ' jn' : '')}
      initial={{ opacity: 0, x: mine ? 14 : -14, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={spring}
    >
      {!mine && <span className="b-face">{!joinNext && <GoofyFace name={peerName} size={28} blink={false} />}</span>}
      <div className={cls}>
        {linkify(m.body).map((p, i) =>
          p.href ? (
            <a key={i} href={p.href} target="_blank" rel="noreferrer noopener">
              {p.text}
            </a>
          ) : (
            <Fragment key={i}>{p.text}</Fragment>
          ),
        )}
      </div>
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

function ChatFooter({ conv, meId, now, onEgg }: { conv: Conversation; meId: string | null; now: number; onEgg: () => void }) {
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
  if (!content) return <Composer conv={conv} onEgg={onEgg} />
  return (
    <motion.div className="req" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
      {content}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ composer */

const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

function Composer({ conv, onEgg }: { conv: Conversation; onEgg: () => void }) {
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const lastSent = useRef<{ body: string; at: number } | null>(null)
  const has = text.trim().length > 0

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
    sendMessage(conv.id, body)
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
      <div className="composer">
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
          onBlur={() => setTyping(conv.id, false)}
          onKeyDown={onKey}
          enterKeyHint={fine ? 'send' : 'enter'}
          maxLength={2000}
        />
        <AnimatePresence>
          {has && (
            <motion.button
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

function SettingsBody({ conv, onPicked }: { conv: Conversation; onPicked: () => void }) {
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
        <span className="theme-row-sw" style={{ ...themeVars(getTheme(conv.theme)), background: getTheme(conv.theme).bg }}>
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
        {THEMES.map((t) => {
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
      <h3 className="settings-label">notifications</h3>
      <div className="settings-row">
        <IconBell size={22} />
        <span className="grow">notifications</span>
        <Toggle label="notifications" on={push === 'on'} disabled={busy || push === 'needs-install' || push === 'unsupported' || push === 'denied'} onChange={() => void togglePush(conv.id)} />
      </div>
      {hint && <p className="settings-hint">{hint}</p>}
      <button type="button" className={'block-btn' + (conv.blocked === 'me' ? ' is-on' : '')} onClick={() => void setBlocked(conv.peer.id, conv.blocked !== 'me')}>
        {conv.blocked === 'me' ? 'unblock ' : 'block '}
        {conv.peer.username}
      </button>
    </div>
  )
}
