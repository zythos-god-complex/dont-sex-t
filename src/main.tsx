import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './themes/mode'
import { boot } from './lib/engine'
import { registerSW } from './lib/push'
import App from './App.tsx'

// Budget phones (few cores / little RAM / data saver) get lite mode: no live blur, lighter effects.
{
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  // deviceMemory only exists on Chromium (Android); iPhones never trip this and keep the full effects
  const lite = (n.deviceMemory !== undefined && (n.deviceMemory <= 2 || (n.hardwareConcurrency || 8) <= 4)) || n.connection?.saveData === true
  if (lite) document.documentElement.dataset.lite = '1'
}

// Hydrate from cache + open the socket before the first paint.
boot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker registration off the critical path.
const idle = (cb: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 300)
if (document.readyState === 'complete') idle(() => void registerSW())
else window.addEventListener('load', () => idle(() => void registerSW()), { once: true })
