import './styles/index.css'
import { Analytics } from '@vercel/analytics/react'
import UpdateBanner from './features/update/UpdateBanner'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Route, Switch, useLocation, useRoute } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useConnection, useMe, useStatus, useUnreadTotal } from './lib/hooks'
import Lobby from './features/lobby/Lobby'
import Inbox from './features/inbox/Inbox'
import ChatScreen from './features/chat/ChatScreen'
import { useRoomsUnread } from './features/rooms/rooms'
import Toasts from './features/toasts/Toasts'
import { Badge, Wordmark, useIsDesktop } from './ui/kit'
import { IconLive, IconRooms } from './ui/icons'
import { bindVisualViewport, trackNav } from './features/shell/nav'
import { MeButton } from './features/shell/MeSheet'
import { refreshBlocks } from './lib/engine'

// screens most visits never open load on demand, then get warmed up when the phone is idle
const loadOnboarding = () => import('./features/onboarding/Onboarding')
const loadRooms = () => import('./features/rooms/RoomsScreen')
const loadRoomChat = () => import('./features/rooms/RoomChat')
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

export default function App() {
  const status = useStatus()
  const desktop = useIsDesktop()
  const unread = useUnreadTotal()
  const [loc] = useLocation()
  useEffect(() => trackNav(loc), [loc])
  useEffect(() => bindVisualViewport(), [])
  useEffect(() => {
    if (status !== 'ready') return
    void refreshBlocks()
    const t = setInterval(() => void refreshBlocks(), 30000)
    return () => clearInterval(t)
  }, [status])
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) GoofyAhhTalk` : 'GoofyAhhTalk'
  }, [unread])
  if (status === 'booting') return <div className="boot" />
  if (status === 'onboarding')
    return (
      <>
        <Suspense fallback={null}><Onboarding /></Suspense>
        <UpdateBanner />
        <Analytics />
      <UpdateBanner />
      </>
    )
  return (
    <>
      <Analytics />
      <ConnectionBanner />
      {desktop ? <DesktopApp /> : <MobileApp />}
      <Toasts />
    </>
  )
}
