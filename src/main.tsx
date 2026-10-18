import { StrictMode } from 'react'
import { MotionConfig } from 'motion/react'
import { createRoot } from 'react-dom/client'
import './themes/mode'
import { boot } from './lib/engine'
import { registerSW } from './lib/push'
import { isTempToken, readSession } from './lib/session'
import App from './App.tsx'

// Budget phones (few cores / little RAM / data saver) get lite mode: no live blur, lighter effects.
{
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  // deviceMemory only exists on Chromium (Android); iPhones never trip this and keep the full effects
  const lite = (n.deviceMemory !== undefined && (n.deviceMemory <= 2 || (n.hardwareConcurrency || 8) <= 4)) || n.connection?.saveData === true
  if (lite) document.documentElement.dataset.lite = '1'
}

// Moved to strangers.cafe. Logins are saved per address, so the old one hands the login over in the link
// (the new address adopts it and strips it from the URL). It only moves once the new address answers,
// so nobody gets sent to a dead page while DNS is still setting up.
const OLD_HOST = 'goofyahhtalk.vercel.app'
const NEW_HOST = 'strangers.cafe'
// paused while GoDaddy's two parked A records still answer next to Vercel's: half the connections to
// the new address land on a parking server. Flip back on once DNS only has Vercel's records.
const MOVE = false
if (MOVE && location.hostname === OLD_HOST) {
  // a parking page or half set up DNS fails this check (it must be our own version file), so nobody lands on it
  void fetch(`https://${NEW_HOST}/version.json`, { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<{ id?: string }>) : null))
    .then((v) => {
      if (!v?.id) return
      const u = new URL(location.pathname + location.search + location.hash, `https://${NEW_HOST}`)
      const s = readSession()
      if (s?.token && !isTempToken(s.token)) u.searchParams.set('t', s.token)
      location.replace(u.toString())
    })
    .catch(() => {})
}

// Hydrate from cache + open the socket before the first paint.
boot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* people who ask their phone for less motion get fades instead of slides, springs and bounces */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)

// Service worker registration off the critical path.
const idle = (cb: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300)
if (document.readyState === 'complete') idle(() => void registerSW())
else window.addEventListener('load', () => idle(() => void registerSW()), { once: true })
