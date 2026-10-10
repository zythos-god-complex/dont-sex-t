// Tracks in-app navigation so "back" uses history only when there is an in-app page to return to.
const stack: string[] = [typeof location !== 'undefined' ? location.pathname : '/']

export function trackNav(path: string): void {
  if (stack[stack.length - 1] === path) return
  if (stack.length > 1 && stack[stack.length - 2] === path) stack.pop()
  else stack.push(path)
}

export function goBack(nav: (to: string) => void): void {
  if (stack.length > 1) history.back()
  else nav('/')
}

/** Straight to the lobby: step back if the lobby is the previous page, otherwise swap this entry for it. */
export function goHome(nav: (to: string, opts?: { replace?: boolean }) => void): void {
  if (stack.length > 1 && stack[stack.length - 2] === '/') return history.back()
  stack[stack.length - 1] = '/'
  nav('/', { replace: true })
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
