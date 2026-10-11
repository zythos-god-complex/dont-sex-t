// Tracks in-app navigation so "back" uses history only when there is an in-app page to return to.
type Nav = (to: string, opts?: { replace?: boolean }) => void

// opened straight onto a tab or a chat (a push, a shared link): slip home in underneath so back lands there, not outside the app
function seedHome(): string[] {
  if (typeof location === 'undefined') return ['/']
  const p = location.pathname
  if (!p.startsWith('/dm') && !p.startsWith('/rooms')) return [p]
  try {
    const kind = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
    if (kind && kind !== 'navigate') return [p] // reload or back/forward: history already has what it needs
    const here = p + location.search + location.hash
    history.replaceState(history.state, '', '/')
    history.pushState(history.state, '', here)
    return ['/', p]
  } catch {
    return [p]
  }
}
const stack: string[] = seedHome()

export function trackNav(path: string): void {
  if (stack[stack.length - 1] === path) return
  if (stack.length > 1 && stack[stack.length - 2] === path) stack.pop()
  else stack.push(path)
}

/** Swap the current entry without growing history. */
function swap(nav: Nav, to: string): void {
  stack[stack.length - 1] = to
  nav(to, { replace: true })
}

/** Step back when there is an in-app page behind this one, otherwise swap this entry for home. */
export function goBack(nav: Nav): void {
  if (stack.length > 1) history.back()
  else swap(nav, '/')
}

/** Leaving a chat: same as back (the tab it came from), home when the chat was the first page. */
export const goHome = goBack

/** Bottom tabs: home stays under chats and rooms, so back from a tab lands home and back from home leaves the app. */
export function goTab(nav: Nav, to: string): void {
  const cur = stack[stack.length - 1]
  if (cur === to) return
  if (to === '/') {
    if (stack.length > 1 && stack[stack.length - 2] === '/') history.back()
    else swap(nav, '/')
  } else if (cur === '/') nav(to)
  else swap(nav, to)
}

/** Pin the app to the visual viewport so the composer rides on top of the mobile keyboard. */
export function bindVisualViewport(): () => void {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const root = document.documentElement
  let raf = 0
  const apply = () => {
    raf = 0
    root.style.setProperty('--vvh', `${vv.height}px`)
    root.style.setProperty('--vvo', `${vv.offsetTop}px`)
    // how much of the layout viewport the keyboard covers (iOS); 0 where the page itself resizes (Android)
    root.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`)
  }
  const on = () => {
    if (!raf) raf = requestAnimationFrame(apply)
  }
  apply()
  vv.addEventListener('resize', on)
  vv.addEventListener('scroll', on)
  return () => {
    vv.removeEventListener('resize', on)
    vv.removeEventListener('scroll', on)
    cancelAnimationFrame(raf)
  }
}

/** iOS home-screen apps get no browser back swipe, so give every screen one from the left edge. */
export function bindEdgeBack(back: () => void): () => void {
  if ((navigator as Navigator & { standalone?: boolean }).standalone !== true) return () => {}
  let x0 = -1
  let y0 = 0
  const start = (e: TouchEvent) => {
    const t = e.touches[0]
    x0 = e.touches.length === 1 && t.clientX < 22 ? t.clientX : -1
    y0 = t.clientY
  }
  const move = (e: TouchEvent) => {
    if (x0 < 0) return
    const t = e.touches[0]
    if (Math.abs(t.clientY - y0) > 40) x0 = -1
    else if (t.clientX - x0 > 70) {
      x0 = -1
      back()
    }
  }
  window.addEventListener('touchstart', start, { passive: true })
  window.addEventListener('touchmove', move, { passive: true })
  return () => {
    window.removeEventListener('touchstart', start)
    window.removeEventListener('touchmove', move)
  }
}

// 'roll another' from a chat: home rolls once as soon as it shows up
let rollQueued = false
export function queueRoll(): void {
  rollQueued = true
}
export function takeRoll(): boolean {
  const v = rollQueued
  rollQueued = false
  return v
}
