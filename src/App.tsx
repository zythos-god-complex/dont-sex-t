import './styles/index.css'
import { startPulse } from './lib/pulse'
import { Analytics } from '@vercel/analytics/react'
import UpdateBanner from './features/update/UpdateBanner'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Route, Switch, useLocation, useRoute } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useConnection, useMe, useStatus, useUnreadTotal } from './lib/hooks'
import Lobby from './features/lobby/Lobby'
import Onboarding from './features/onboarding/Onboarding'
import Inbox from './features/inbox/Inbox'
import ChatScreen from './features/chat/ChatScreen'
import { useRoomsUnread } from './features/rooms/rooms'
import Toasts from './features/toasts/Toasts'
import { Badge, Wordmark, useIsDesktop } from './ui/kit'
import { IconLive, IconRooms } from './ui/icons'
import { bindEdgeBack, bindVisualViewport, goBack, goTab, trackNav } from './features/shell/nav'
import TabBar, { tabOf } from './features/shell/TabBar'
import { MeButton, MeSheetHost } from './features/shell/MeSheet'
import { refreshBlocks } from './lib/engine'
import { useBan } from './lib/ban'
import { api } from './lib/api'
import { GoofyFace } from './ui/GoofyFace'
import { PeekHost } from './features/profile/ProfileCard'
import { DailyReward } from './features/rewards/Reward'
import { TourHost } from './features/guide/Tour'
import { CallHost } from './features/call/CallUI'

// screens most visits never open load on demand, then get warmed up when the phone is idle.
// onboarding is tiny and is the first thing new people see, so it ships in the main bundle.
const loadRooms = () => import('./features/rooms/RoomsScreen')
const loadRoomChat = () => import('./features/rooms/RoomChat')
const loadAdmin = () => import('./features/admin/Admin')
const loadLegal = () => import('./features/legal/Legal')
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
const RoomsScreen = lazy(lazyRetry(loadRooms))
const RoomChat = lazy(lazyRetry(loadRoomChat))
const Admin = lazy(lazyRetry(loadAdmin))
const Legal = lazy(lazyRetry(loadLegal))
if (typeof window !== 'undefined') {
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500))
  window.addEventListener('load', () => idle(() => void loadRooms().then(loadRoomChat).catch(() => {})), { once: true })
}

// tabs sit side by side (crossfade), chats and rooms push over them (slide)
const depthOf = (path: string): number => (tabOf(path) ? 0 : 1)
const slide = { type: 'spring' as const, stiffness: 420, damping: 42 }
const fade = { duration: 0.12 }

// chat and room headers show their own state, so this only floats over the tabs, under the header; short blips never show
function ConnectionBanner() {
  const c = useConnection()
  const status = useStatus()
  const [loc] = useLocation()
  const [late, setLate] = useState(false)
  const off = c === 'offline' && status === 'ready'
  useEffect(() => {
    if (!off) return setLate(false)
    const t = setTimeout(() => setLate(true), 1500)
    return () => clearTimeout(t)
  }, [off])
  return (
    <AnimatePresence>
      {off && late && !!tabOf(loc) && (
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
  // 0: tab to tab, 1: push, -1: pop
  const dir = depth > prev.current ? 1 : depth < prev.current ? -1 : depth === 0 ? 0 : 1
  useEffect(() => {
    prev.current = depth
  }, [depth])
  return (
    <div className="m-stack">
      <TabBar path={loc} />
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={loc.startsWith('/dm/') ? 'chat:' + loc : loc.startsWith('/rooms/') ? 'room:' + loc : loc}
          className={'m-screen' + (depth === 0 ? ' is-tab' : '')}
          custom={dir}
          variants={{
            enter: (d: number) => (d === 0 ? { x: 0, opacity: 0 } : { x: d > 0 ? '100%' : '-28%', opacity: d > 0 ? 1 : 0.7 }),
            center: (d: number) => ({ x: 0, opacity: 1, transition: d === 0 ? fade : slide }),
            exit: (d: number) => (d === 0 ? { opacity: 0, transition: fade } : { x: d > 0 ? '-28%' : '100%', opacity: d > 0 ? 0.7 : 1, transition: slide }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
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
          <button className={'d-live is-home' + (!inChat && !inRoom && !inRooms ? ' is-on' : '')} onClick={() => nav('/')}>
            <IconLive size={20} />
            <span>home</span>
          </button>
          <button className={'d-live' + (inRoom || inRooms ? ' is-on' : '')} onClick={() => nav('/rooms')}>
            <IconRooms size={20} />
            <span>rooms</span>
            <Badge n={roomsUnread} />
          </button>
          <div className="d-rail-head">
            <span>chats</span>
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

// returning without a cache: the wordmark and a blinking face instead of a blank screen
function Boot() {
  return (
    <div className="boot">
      <GoofyFace name="goofy.boot" size={88} />
      <Wordmark size={26} />
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
        if (p === '/dm' || p === '/rooms') goTab(nav, '/')
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
    document.title = unread > 0 ? `(${unread}) strangers cafe` : 'strangers cafe'
  }, [unread])
  // the policies open for everyone: signed out, in jail, mid sign up
  if (loc === '/privacy' || loc === '/terms')
    return (
      <Suspense fallback={<Boot />}>
        <Legal page={loc === '/privacy' ? 'privacy' : 'terms'} />
      </Suspense>
    )
  if (ban) return <Jail until={ban} />
  if (status === 'booting') return <Boot />
  if (status === 'onboarding')
    return (
      <>
        <Onboarding />
        <UpdateBanner />
        <Analytics />
      </>
    )
  if (loc === '/admin' && me?.admin)
    return (
      <Suspense fallback={<Boot />}>
        <Admin />
      </Suspense>
    )
  return (
    <>
      <Analytics />
      <ConnectionBanner />
      <DailyReward />
      {desktop ? <DesktopApp /> : <MobileApp />}
      <PeekHost />
      <MeSheetHost />
      <TourHost />
      <CallHost />
      <UpdateBanner />
      <Toasts />
    </>
  )
}
