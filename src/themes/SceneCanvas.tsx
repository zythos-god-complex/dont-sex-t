// One canvas per signature scene: a static layer painted on resize, a light per-frame layer on top.
// Pauses when the tab is hidden, caps fps and pixel ratio, draws one frame for reduced motion.
import { useEffect, useRef } from 'react'
import { onFx, setFxSource, type Fx } from './fx'

export type Scene = {
  /** (re)build anything that only depends on size */
  init(w: number, h: number): void
  /** draw one frame; t in seconds, dt seconds since the last frame */
  frame(g: CanvasRenderingContext2D, t: number, dt: number): void
  fx?(f: Fx): void
  /** canvas spots a theme moment starts from (the sakura canopies), handed to the overlay in screen coords */
  points?(): [number, number][]
}

/** tiny seeded generator: init runs on it so a scene grows the same trees and stars every time it mounts or resizes */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function SceneCanvas({ make, fps = 30 }: { make: () => Scene; fps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return
    const scene = make()
    const lite = document.documentElement.dataset.lite === '1'
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(lite ? 1 : 2, window.devicePixelRatio || 1)
    const fit = () => {
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (!w || !h) return
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const real = Math.random
      Math.random = seeded(7)
      try {
        scene.init(w, h)
      } finally {
        Math.random = real
      }
      if (still) scene.frame(g, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    const offFx = onFx((f) => scene.fx?.(f))
    const offSrc = scene.points
      ? setFxSource(() => {
          const r = cv.getBoundingClientRect()
          return scene.points!().map(([x, y]) => [x + r.left, y + r.top] as [number, number])
        })
      : () => {}
    const off = () => (offFx(), offSrc())
    if (still) return () => (ro.disconnect(), off())
    const every = 1000 / (lite ? Math.min(fps, 24) : fps)
    let raf = 0
    let last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.visibilityState !== 'visible' || now - last < every - 1) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / fps
      last = now
      scene.frame(g, now / 1000, dt)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      off()
    }
    // a scene is built once per mount; the parent remounts it when density or speed change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <canvas ref={ref} className="scene-cv" aria-hidden="true" />
}

/** an offscreen layer at the canvas pixel ratio, drawn back with drawImage */
export function layer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const dpr = Math.min(document.documentElement.dataset.lite === '1' ? 1 : 2, window.devicePixelRatio || 1)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * dpr))
  c.height = Math.max(1, Math.round(h * dpr))
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  return [c, g]
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** soft radial glow */
export function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, color)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.globalAlpha = alpha
  g.fillStyle = gr
  g.fillRect(x - r, y - r, r * 2, r * 2)
  g.globalAlpha = 1
}

/** smooth layered hills along the bottom */
export function hills(g: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, color: string, seed: number) {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(0, h)
  const n = 6
  let px = 0
  let py = base - amp * (0.5 + 0.5 * Math.sin(seed))
  g.lineTo(0, py)
  for (let i = 1; i <= n; i++) {
    const x = (w / n) * i
    const y = base - amp * (0.5 + 0.5 * Math.sin(seed + i * 1.7) * Math.cos(seed * 0.7 + i))
    g.quadraticCurveTo(px + (x - px) / 2, Math.min(py, y) - amp * 0.25, x, y)
    px = x
    py = y
  }
  g.lineTo(w, h)
  g.closePath()
  g.fill()
}
