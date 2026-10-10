// Matrix code rain, A to Z only. One canvas, ~18fps, pauses when the tab is hidden, one still frame for reduced motion.
import { useEffect, useRef } from 'react'

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function MatrixRain({ size = 15, fps = 18 }: { size?: number; fps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return
    const lite = document.documentElement.dataset.lite === '1'
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let drops: number[] = []
    const fit = () => {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = Math.max(1, Math.round(w * dpr))
      cv.height = Math.max(1, Math.round(h * dpr))
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#000'
      g.fillRect(0, 0, w, h)
      drops = Array.from({ length: Math.ceil(w / size) }, () => Math.floor((Math.random() * -h) / size))
    }
    const step = () => {
      g.fillStyle = 'rgba(0,0,0,0.09)'
      g.fillRect(0, 0, w, h)
      g.font = `700 ${size}px ui-monospace, Menlo, monospace`
      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * size
        if (y >= 0) {
          g.fillStyle = '#00FF41'
          g.fillText(ABC[(Math.random() * 26) | 0], i * size, y - size)
          g.fillStyle = '#D8FFD8'
          g.fillText(ABC[(Math.random() * 26) | 0], i * size, y)
        }
        drops[i] = y > h && Math.random() > 0.975 ? 0 : drops[i] + 1
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    if (still) {
      for (let k = 0; k < 60; k++) step()
      return () => ro.disconnect()
    }
    const every = 1000 / (lite ? Math.min(fps, 10) : fps)
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.visibilityState !== 'visible' || t - last < every) return
      last = t
      step()
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [size, fps])
  return <canvas ref={ref} className="mx-rain" aria-hidden="true" />
}
