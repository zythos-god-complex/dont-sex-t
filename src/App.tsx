import './styles/index.css'
import { Analytics } from '@vercel/analytics/react'
import { useEffect, useRef } from 'react'
import { Route, Switch, useLocation, useRoute } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useConnection, useMe, useStatus, useUnreadTotal } from './lib/hooks'
import Onboarding from './features/onboarding/Onboarding'
import Lobby from './features/lobby/Lobby'
import Inbox from './features/inbox/Inbox'
import ChatScreen from './features/chat/ChatScreen'
import Toasts from './features/toasts/Toasts'
import { Badge, Wordmark, useIsDesktop } from './ui/kit'
import { IconLive } from './ui/icons'
import { bindVisualViewport, trackNav } from './features/shell/nav'
import { MeButton } from './features/shell/MeSheet'
import { refreshBlocks } from './lib/engine'

function depthOf(path: string): number {
  if (path.startsWith('/dm/')) return 2
  if (path === '/dm') return 1
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
          key={loc.startsWith('/dm/') ? 'chat:' + loc : loc}
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
  const [, nav] = useLocation()
  const unread = useUnreadTotal()
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
          <button className={'d-live' + (!inChat ? ' is-on' : '')} onClick={() => nav('/')}>
            <IconLive size={20} />
            <span>live</span>
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
              key={inChat ? 'chat:' + params!.username : 'lobby'}
              className="d-pane"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {inChat ? <ChatScreen username={decodeURIComponent(params!.username)} /> : <Lobby />}
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
        <Onboarding />
        <Analytics />
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
