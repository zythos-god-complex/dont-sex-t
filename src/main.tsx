import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { boot } from './lib/engine'
import { registerSW } from './lib/push'
import App from './App.tsx'

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
