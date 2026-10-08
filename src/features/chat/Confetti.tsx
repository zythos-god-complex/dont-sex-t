import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { getTheme } from '../../themes/themes'
import { useAmbientPrefs } from '../../themes/ambientPrefs'

type Shape = 'petal' | 'leaf' | 'heart' | 'star' | 'bubble' | 'confetti' | 'bat' | 'ember'
type Part = {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; c: string; shape: Shape
  state: 'fly' | 'rest' | 'drop'; el?: Element; ox?: number; oy?: number; phase: number
}

const LOOK: Record<string, { shape: Shape; colors: string[] }> = {
  petals: { shape: 'petal', colors: ['#FFB3CB', '#FFC8D9', '#FF9EBB', '#FFD9E5'] },
  leaves: { shape: 'leaf', colors: ['#8CC56A', '#6FAF4C', '#A9D67E', '#5E9C3F'] },
  stars: { shape: 'star', colors: ['#FFFFFF', '#FFE58A', '#C9D6FF'] },
  sparkles: { shape: 'star', colors: ['#FFFFFF', '#FFE44D', '#FF9FE0', '#8ED6FF'] },
  hearts: { shape: 'heart', colors: ['#FF6FC4', '#8FD0FF', '#FF4F8B', '#FFB3DD'] },
  bubbles: { shape: 'bubble', colors: ['rgba(255,255,255,.85)'] },
  bats: { shape: 'bat', colors: ['#0B0C10', '#16181F', '#FFD000'] },
  lovebeat: { shape: 'heart', colors: ['#F0285A', '#FF6B91', '#C70F40', '#FFFFFF'] },
  party: { shape: 'confetti', colors: ['#8A6BFF', '#FF5CB8', '#FFC83D', '#3DD6B5', '#5BB5FF'] },
  embers: { shape: 'ember', colors: ['#FFC27A', '#FF6A8E', '#FF3D63'] },
}

export type ConfettiHandle = { burst: (x: number, y: number) => void; rain: () => void }

/** Theme particle burst that lands on message bubbles and gets shaken off. */
export const Confetti = forwardRef<ConfettiHandle, { themeId: string; host: () => HTMLElement | null }>(function Confetti({ themeId, host }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const parts = useRef<Part[]>([])
  const raf = useRef(0)
  const phase = useRef<{ start: number; released: boolean } | null>(null)
  const themeRef = useRef(themeId)
  themeRef.current = themeId

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const draw = (ctx: CanvasRenderingContext2D, p: Part) => {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.c
    ctx.strokeStyle = 'rgba(23,19,31,.55)'
    ctx.lineWidth = 1.2
    const s = p.s
    ctx.beginPath()
    switch (p.shape) {
      case 'petal':
        ctx.moveTo(0, -s)
        ctx.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.7, 0, s)
        ctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.6, 0, -s)
        ctx.fill()
        break
      case 'leaf':
        ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(-s, 0)
        ctx.lineTo(s, 0)
        ctx.stroke()
        break
      case 'heart':
        ctx.moveTo(0, s * 0.9)
        ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.5, -s * 1.2, 0, -s * 0.35)
        ctx.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.9)
        ctx.fill()
        ctx.stroke()
        break
      case 'star':
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? s * 0.38 : s
          const a = (i * Math.PI) / 4
          if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          else ctx.moveTo(r, 0)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      case 'bubble':
        ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,.25)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,.95)'
        ctx.lineWidth = 1.6
        ctx.stroke()
        break
      case 'bat': {
        const f = Math.sin(performance.now() / 70 + p.phase) * 0.5 + 0.5
        const w = s * 1.3
        const lift = s * (0.15 + f * 0.6)
        ctx.moveTo(0, -s * 0.35)
        ctx.quadraticCurveTo(-w * 0.45, -lift - s * 0.2, -w, -lift)
        ctx.quadraticCurveTo(-w * 0.75, s * 0.05, -w * 0.55, s * 0.25)
        ctx.quadraticCurveTo(-w * 0.35, s * 0.05, -s * 0.2, s * 0.35)
        ctx.lineTo(0, s * 0.6)
        ctx.lineTo(s * 0.2, s * 0.35)
        ctx.quadraticCurveTo(w * 0.35, s * 0.05, w * 0.55, s * 0.25)
        ctx.quadraticCurveTo(w * 0.75, s * 0.05, w, -lift)
        ctx.quadraticCurveTo(w * 0.45, -lift - s * 0.2, 0, -s * 0.35)
        ctx.fill()
        if (p.c !== '#FFD000') {
          ctx.strokeStyle = 'rgba(255,214,0,.55)'
          ctx.stroke()
        }
        break
      }
      case 'ember':
        ctx.shadowColor = p.c
        ctx.shadowBlur = s * 1.6
        ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2)
        ctx.fill()
        break
      default:
        ctx.fillRect(-s * 0.5, -s * 0.3, s, s * 0.6)
    }
    ctx.restore()
  }

  const loop = () => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = window.innerWidth
    const H = window.innerHeight
    if (cv.width !== W * dpr || cv.height !== H * dpr) {
      cv.width = W * dpr
      cv.height = H * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const root = host()
    const els = root ? Array.from(root.querySelectorAll('.msgs .b')) : []
    const rects = els.map((el) => ({ el, r: el.getBoundingClientRect() }))
    const now = performance.now()
    const ph = phase.current!
    const t = (now - ph.start) / 1000
    let flying = 0
    for (const p of parts.current) {
      if (p.state === 'rest' && p.el) {
        const r = p.el.getBoundingClientRect()
        p.x = r.left + p.ox!
        p.y = r.top + p.oy!
        continue
      }
      const py = p.y
      p.vy += p.shape === 'bubble' ? 0.05 : 0.16
      p.vy = Math.min(p.vy, p.shape === 'petal' || p.shape === 'leaf' ? 2.6 : 4.2)
      p.vx *= 0.985
      if (p.shape === 'petal' || p.shape === 'leaf') p.vx += Math.sin(now / 300 + p.phase) * 0.06
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      if (p.state === 'fly') {
        flying++
        if (p.vy > 0)
          for (const { el, r } of rects) {
            if (p.x > r.left + 4 && p.x < r.right - 4 && py <= r.top && p.y >= r.top) {
              p.state = 'rest'
              p.el = el
              p.ox = p.x - r.left
              p.oy = -p.s * 0.45
              p.vr = 0
              break
            }
          }
      }
    }
    parts.current = parts.current.filter((p) => p.state === 'rest' || p.y < H + 40)
    for (const p of parts.current) draw(ctx, p)
    // once the shower is over, hold a beat, then the bubbles shake everything off
    if (!ph.released && (flying === 0 || t > 3.4) && t > 1.4) {
      ph.released = true
      setTimeout(() => {
        const shaken = new Set<Element>()
        for (const p of parts.current)
          if (p.state === 'rest') {
            shaken.add(p.el!)
            p.state = 'drop'
            p.vy = -1.5 - Math.random() * 2.5
            p.vx = (Math.random() - 0.5) * 4
            p.vr = (Math.random() - 0.5) * 0.3
          }
        shaken.forEach((el) => {
          el.classList.remove('b-shake')
          void (el as HTMLElement).offsetWidth
          el.classList.add('b-shake')
          setTimeout(() => el.classList.remove('b-shake'), 650)
        })
        navigator.vibrate?.(14)
      }, 1000)
    }
    if (parts.current.length || !ph.released) raf.current = requestAnimationFrame(loop)
    else {
      ctx.clearRect(0, 0, W, H)
      phase.current = null
    }
  }

  const look = () => {
    const th = getTheme(themeRef.current)
    return LOOK[th.ambient] ?? { shape: 'confetti' as Shape, colors: [th.sent[0], th.sent[1], th.sent[2], th.accent] }
  }
  const count = () => Math.round(110 * Math.min(2.5, Math.max(0.5, useAmbientPrefs.getState().amount)))
  const add = (lk: { shape: Shape; colors: string[] }, i: number, x: number, y: number, vx: number, vy: number) =>
    parts.current.push({
      x, y, vx, vy,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      s: lk.shape === 'confetti' ? 7 + Math.random() * 5 : 6 + Math.random() * 6,
      c: lk.colors[i % lk.colors.length],
      shape: lk.shape,
      state: 'fly',
      phase: Math.random() * 10,
    })
  const kick = () => {
    navigator.vibrate?.([10, 30, 10])
    const running = !!phase.current
    phase.current = { start: performance.now(), released: false }
    if (!running) raf.current = requestAnimationFrame(loop)
  }

  useImperativeHandle(ref, () => ({
    burst(x, y) {
      const lk = look()
      const n = count()
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 3 + Math.random() * 9
        add(lk, i, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 6 - Math.random() * 4)
      }
      kick()
    },
    // shower from the top edge, same on every screen size
    rain() {
      const lk = look()
      const n = count()
      const W = window.innerWidth
      for (let i = 0; i < n; i++) add(lk, i, Math.random() * W, -20 - Math.random() * 260, (Math.random() - 0.5) * 3, 1 + Math.random() * 2.5)
      kick()
    },
  }))

  return <canvas ref={canvas} className="confetti-cv" aria-hidden="true" />
})
