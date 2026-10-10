import './styles/index.css'
import { startPulse } from './lib/pulse'
import { Analytics } from '@vercel/analytics/react'
import UpdateBanner from './features/update/UpdateBanner'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Route, Switch, useLocation, useRoute } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useConnection, useMe, useStatus, useUnreadTotal } from './lib/hooks'
import Lobby from './features/lobby/Lobby'
import Inbox from './features/inbox/Inbox'
import ChatScreen from './features/chat/ChatScreen'
import { useRoomsUnread } from './features/rooms/rooms'
import Toasts from './features/toasts/Toasts'
import { Badge, Wordmark, useIsDesktop } from './ui/kit'
import { IconClose, IconLive, IconMegaphone, IconRooms } from './ui/icons'
import { bindEdgeBack, bindVisualViewport, goBack, goHome, trackNav } from './features/shell/nav'
import { MeButton } from './features/shell/MeSheet'
import { refreshBlocks } from './lib/engine'
import { useBan } from './lib/ban'
import { api } from './lib/api'
import { GoofyFace } from './ui/GoofyFace'
import { PeekHost } from './features/profile/ProfileCard'

// screens most visits never open load on demand, then get warmed up when the phone is idle
const loadOnboarding = () => import('./features/onboarding/Onboarding')
const loadRooms = () => import('./features/rooms/RoomsScreen')
const loadRoomChat = () => import('./features/rooms/RoomChat')
const loadAdmin = () => import('./features/admin/Admin')
// a lazy file can vanish (deploy while a tab is open) or drop on bad signal: retry once, then one hard reload
function lazyRetry<T>(load: () => Promise<{ default: T }>) {
  const ok = (m: { default: T }) => {
    try { sessionStorage.removeItem('gat.chunk-reload') } catch { /* blocked */ }
    return m
  }
  return () =>
    load().then(ok, () =>
      new Promise<{ default: T }>((res, rej) =>
        setTimeout(() => load().then((m) => res(ok(m)), (e) => {
          try {
            if (!sessionStorage.getItem('gat.chunk-reload')) {
              sessionStorage.setItem('gat.chunk-reload', '1')
              location.reload()
            }
          } catch { /* blocked */ }
          rej(e)
        }), 700),
      ),
    )
}
const Onboarding = lazy(lazyRetry(loadOnboarding))
const RoomsScreen = lazy(lazyRetry(loadRooms))
const RoomChat = lazy(lazyRetry(loadRoomChat))
const Admin = lazy(lazyRetry(loadAdmin))
if (typeof window !== 'undefined') {
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500))
  window.addEventListener('load', () => idle(() => void loadRooms().then(loadRoomChat).catch(() => {})), { once: true })
}

function depthOf(path: string): number {
  if (path.startsWith('/dm/') || path.startsWith('/rooms/')) return 2
  if (path === '/dm' || path === '/rooms') return 1
  return 0
}

function ConnectionBanner() {
  const c = useConnection()
  const status = useStatus()
  return (
    <AnimatePresence>
      {c === 'offline' && status === 'ready' && (
        <motion.div className="conn-banner" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
          reconnecting...
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MobileApp() {
  const [loc] = useLocation()
  const depth = depthOf(loc)
  const prev = useRef(depth)
  const dir = depth >= prev.current ? 1 : -1
  useEffect(() => {
    prev.current = depth
  }, [depth])
  return (
    <div className="m-stack">
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={loc.startsWith('/dm/') ? 'chat:' + loc : loc.startsWith('/rooms/') ? 'room:' + loc : loc}
          className="m-screen"
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-28%', opacity: d > 0 ? 1 : 0.7 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? '-28%' : '100%', opacity: d > 0 ? 0.7 : 1 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 420, damping: 42 }}
        >
          <Switch location={loc}>
            <Route path="/dm/:username">{(p) => <ChatScreen username={decodeURIComponent(p.username)} />}</Route>
            <Route path="/dm">
              <Inbox variant="screen" />
            </Route>
            <Route path="/rooms/:id">{(p) => <Suspense fallback={null}><RoomChat id={p.id} /></Suspense>}</Route>
            <Route path="/rooms">
              <Suspense fallback={null}><RoomsScreen /></Suspense>
            </Route>
            <Route>
              <Lobby />
            </Route>
          </Switch>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function DesktopApp() {
  const me = useMe()
  const [inChat, params] = useRoute('/dm/:username')
  const [inRoom, roomParams] = useRoute('/rooms/:id')
  const [inRooms] = useRoute('/rooms')
  const [, nav] = useLocation()
  const unread = useUnreadTotal()
  const roomsUnread = useRoomsUnread()
  return (
    <div className="d-backdrop">
      <div className="d-frame">
        <aside className="d-rail">
          <div className="d-rail-top">
            <button className="d-brand" onClick={() => nav('/')} aria-label="home">
              <Wordmark size={24} />
            </button>
            {me && (
              <div className="d-me">
                <MeButton size={34} />
              </div>
            )}
          </div>
          <button className={'d-live' + (!inChat && !inRoom && !inRooms ? ' is-on' : '')} onClick={() => nav('/')}>
            <IconLive size={20} />
            <span>live</span>
          </button>
          <button className={'d-live' + (inRoom || inRooms ? ' is-on' : '')} onClick={() => nav('/rooms')}>
            <IconRooms size={20} />
            <span>rooms</span>
            <Badge n={roomsUnread} />
          </button>
          <div className="d-rail-head">
            <span>dms</span>
            <Badge n={unread} />
          </div>
          <Inbox variant="rail" />
        </aside>
        <main className="d-main">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={inChat ? 'chat:' + params!.username : inRoom ? 'room:' + roomParams!.id : inRooms ? 'rooms' : 'lobby'}
              className="d-pane"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {inChat ? <ChatScreen username={decodeURIComponent(params!.username)} /> : inRoom ? <Suspense fallback={null}><RoomChat id={roomParams!.id} /></Suspense> : inRooms ? <Suspense fallback={null}><RoomsScreen /></Suspense> : <Lobby />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

function Appeal() {
  const { token, appealed } = useBan()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  if (appealed) return <p className="ban-sub">appeal sent</p>
  if (!open)
    return (
      <button className="ban-retry" onClick={() => setOpen(true)}>
        appeal
      </button>
    )
  const send = () => {
    if (!token) return
    setBusy(true)
    api.appeal(token, text.trim()).then(() => useBan.setState({ appealed: true }), () => setBusy(false))
  }
  return (
    <div className="ban-appeal">
      <textarea className="fl-bio" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="what happened" autoFocus />
      <button className="ban-retry is-ink" disabled={busy || text.trim().length < 3} onClick={send}>
        send appeal
      </button>
    </div>
  )
}

// goofy jail: your face behind ink bars, a live countdown, one appeal
function Jail({ until }: { until: string }) {
  const me = useMe()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Date.parse(until)
  const left = Number.isFinite(ms) ? Math.max(0, ms - now) : null
  useEffect(() => {
    if (left === 0) location.reload()
  }, [left])
  let clock = until === 'soon' ? '' : 'for good'
  if (left !== null) {
    const s = Math.floor(left / 1000)
    const d = Math.floor(s / 86400)
    clock = `${d ? d + 'd ' : ''}${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
  }
  return (
    <div className="ban">
      <div className="jail">
        <GoofyFace name={me?.username ?? 'jail'} avatar={me?.avatar ?? undefined} size={128} mood="sleepy" hat={null} blink={false} />
        <span className="jail-bars" aria-hidden="true" />
      </div>
      <h1 className="ban-title">goofy jail</h1>
      {clock && <p className="ban-clock tnum">{clock}</p>}
      {until !== 'soon' && <Appeal />}
    </div>
  )
}

// one line from the admin for everyone, tap to hide until the next one
function Notice() {
  const [n, setN] = useState<{ text: string; at: string } | null>(null)
  useEffect(() => {
    let seen = ''
    try { seen = localStorage.getItem('gat.notice') ?? '' } catch { /* blocked */ }
    void api.notice().then((v) => { if (v?.text && v.at !== seen) setN(v) }, () => {})
  }, [])
  if (!n) return null
  const hide = () => {
    try { localStorage.setItem('gat.notice', n.at) } catch { /* blocked */ }
    setN(null)
  }
  return (
    <motion.button className="notice" onClick={hide} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} aria-label="hide notice">
      <IconMegaphone className="notice-ico" size={20} />
      <span className="notice-text">{n.text}</span>
      <IconClose className="notice-x" size={16} />
    </motion.button>
  )
}

export default function App() {
  const status = useStatus()
  const desktop = useIsDesktop()
  const unread = useUnreadTotal()
  const [loc, nav] = useLocation()
  const me = useMe()
  const ban = useBan((s) => s.until)
  useEffect(() => trackNav(loc), [loc])
  useEffect(() => bindVisualViewport(), [])
  useEffect(() => startPulse(), [])
  useEffect(
    () =>
      bindEdgeBack(() => {
        const p = location.pathname
        if (p === '/' || document.querySelector('.sheet')) return
        if (p.startsWith('/dm/') || p === '/admin') goHome(nav)
        else goBack(nav)
      }),
    [nav],
  )
  useEffect(() => {
    if (status !== 'ready') return
    void refreshBlocks()
    const t = setInterval(() => void refreshBlocks(), 30000)
    return () => clearInterval(t)
  }, [status])
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) GoofyAhhTalk` : 'GoofyAhhTalk'
  }, [unread])
  if (ban) return <Jail until={ban} />
  if (status === 'booting') return <div className="boot" />
  if (status === 'onboarding')
    return (
      <>
        <Suspense fallback={null}><Onboarding /></Suspense>
        <UpdateBanner />
        <Analytics />
      </>
    )
  if (loc === '/admin' && me?.admin)
    return (
      <Suspense fallback={<div className="boot" />}>
        <Admin />
      </Suspense>
    )
  return (
    <>
      <Analytics />
      <ConnectionBanner />
      <Notice />
      {desktop ? <DesktopApp /> : <MobileApp />}
      <PeekHost />
      <UpdateBanner />
      <Toasts />
    </>
  )
}
