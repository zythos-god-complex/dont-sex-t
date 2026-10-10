// Night scene: sakura night, painted on canvas. Still parts are painted once per resize, only the moving bits animate.
import type { CSSProperties } from 'react'
import { SceneCanvas, glow, hills, layer, rand, type Scene } from '../SceneCanvas'
import { density, pace, type Opts } from './common'

const wrap = { position: 'absolute', inset: 0 } as CSSProperties

/* ================================================================== sakura night */
type Petal = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; flip: number; vf: number; s: number; c: string; once?: { bx: number; vy: number } }
const PINKS = ['#FFD3E4', '#F8BCD6', '#F2A3C5', '#FBE4EE', '#E98DB6']

function petalPath(g: CanvasRenderingContext2D, s: number) {
  g.beginPath()
  g.moveTo(0, -s)
  g.bezierCurveTo(s * 0.55, -s * 1.05, s * 0.95, -s * 0.2, s * 0.1, s)
  g.lineTo(0, s * 0.82)
  g.lineTo(-s * 0.1, s)
  g.bezierCurveTo(-s * 0.95, -s * 0.2, -s * 0.55, -s * 1.05, 0, -s)
  g.closePath()
}

function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, rot: number) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.fillStyle = c
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5)
    g.save()
    g.translate(0, -r * 0.55)
    petalPath(g, r * 0.5)
    g.fill()
    g.restore()
  }
  g.fillStyle = 'rgba(255,240,200,0.85)'
  g.beginPath()
  g.arc(0, 0, r * 0.14, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function tree(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, depth: number, tips: [number, number][]) {
  const ex = x + Math.cos(ang) * len
  const ey = y + Math.sin(ang) * len
  const bend = rand(-0.35, 0.35)
  const mx = x + Math.cos(ang + bend) * len * 0.5
  const my = y + Math.sin(ang + bend) * len * 0.5
  g.strokeStyle = '#120916'
  g.lineCap = 'round'
  g.lineWidth = wid
  g.beginPath()
  g.moveTo(x, y)
  g.quadraticCurveTo(mx, my, ex, ey)
  g.stroke()
  if (depth >= 5 || wid < 1.2) {
    tips.push([ex, ey])
    return
  }
  const kids = depth < 2 ? 2 : Math.random() < 0.7 ? 2 : 3
  for (let i = 0; i < kids; i++) tree(g, ex, ey, ang + rand(-0.75, 0.75), len * rand(0.62, 0.82), wid * 0.66, depth + 1, tips)
  if (depth >= 2) tips.push([ex, ey])
}

type Tree = { c: HTMLCanvasElement; x0: number; y0: number; bw: number; bh: number; px: number; py: number; side: number; ph: number }

function makeSakura({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let bg: HTMLCanvasElement | null = null
  let trees: Tree[] = []
  let petals: Petal[] = []
  let lamps: { x: number; y: number; r: number; p: number }[] = []
  // blossom spots on both trees (x, y, which way the tree leans in) for the four-tap petal shower
  let canopy: [number, number, number][] = []
  let queue = 0
  let shook = -1
  let now = 0
  const dens = density(amount)
  const sp = pace(speed)
  const make = (top: boolean): Petal => ({
    x: rand(-w * 0.1, w * 1.2),
    y: top ? rand(-h * 0.15, -10) : rand(0, h),
    vx: rand(-38, -12) * sp,
    vy: rand(22, 48) * sp,
    rot: rand(0, 6.3),
    vr: rand(-1.4, 1.4),
    flip: rand(0, 6.3),
    vf: rand(1.5, 3.5),
    s: rand(3.4, 6.2),
    c: PINKS[(Math.random() * PINKS.length) | 0],
  })
  return {
    init(W, H) {
      w = W
      h = H
      const [c, g] = layer(w, h)
      const sk = g.createLinearGradient(0, 0, 0, h)
      sk.addColorStop(0, '#050A22')
      sk.addColorStop(0.4, '#101C4E')
      sk.addColorStop(0.75, '#2A2766')
      sk.addColorStop(1, '#1C1640')
      g.fillStyle = sk
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < (w * h) / 2600; i++) {
        g.fillStyle = `rgba(255,255,255,${rand(0.2, 0.75)})`
        g.beginPath()
        g.arc(Math.random() * w, Math.random() * h * 0.55, rand(0.3, 0.9), 0, Math.PI * 2)
        g.fill()
      }
      // moon with halo and faint maria
      const mx = w * 0.56
      const my = h * 0.13
      const mr = Math.min(w, h) * 0.085
      glow(g, mx, my, mr * 7, 'rgba(170,190,255,0.22)')
      glow(g, mx, my, mr * 2.6, 'rgba(220,230,255,0.35)')
      const md = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr)
      md.addColorStop(0, '#FFFFFF')
      md.addColorStop(0.7, '#EEF2FF')
      md.addColorStop(1, '#C9D3F2')
      g.fillStyle = md
      g.beginPath()
      g.arc(mx, my, mr, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(160,172,210,0.22)'
      for (const [dx, dy, r] of [[-0.3, -0.1, 0.22], [0.25, 0.2, 0.16], [0.05, 0.42, 0.12], [-0.12, 0.3, 0.09]]) {
        g.beginPath()
        g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2)
        g.fill()
      }
      // moonlit clouds
      for (let i = 0; i < 7; i++) glow(g, mx + rand(-1, 1) * w * 0.35, my + rand(0.4, 1.6) * mr * 2, rand(40, 90), 'rgba(120,140,230,0.10)')
      hills(g, w, h, h * 0.8, h * 0.08, '#18204E', 1.3)
      hills(g, w, h, h * 0.88, h * 0.06, '#0F1536', 3.1)
      bg = c
      // a lantern lit lane fading to the horizon
      lamps = Array.from({ length: 7 }, (_, i) => {
        const k = i / 6
        return { x: w * (0.5 + (i % 2 ? 1 : -1) * (0.08 + k * 0.4)), y: h * (0.78 + k * 0.17), r: 10 + k * 38, p: rand(0, 6) }
      })
      // two blossom trees framing the top corners, each on its own layer so it can sway from the trunk
      canopy = []
      trees = []
      for (const [x, y, ang, len, wid] of [[-w * 0.03, h * 0.44, -1.22, Math.min(h * 0.14, w * 0.3), 12], [w * 1.03, h * 0.34, -1.92, Math.min(h * 0.12, w * 0.26), 10]] as const) {
        // grow once on a scratch canvas to learn the shape, then paint it for real on a cropped layer
        const tips: [number, number][] = []
        const scratch = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
        const state = Math.random
        const seed = (Math.random() * 233280) | 0
        let s0 = seed
        const replay = () => (s0 = (s0 * 9301 + 49297) % 233280) / 233280
        Math.random = replay
        tree(scratch, x, y, ang, len, wid, 0, tips)
        Math.random = state
        const m = 70
        const xs = [x, ...tips.map((p) => p[0])]
        const ys = [y, ...tips.map((p) => p[1])]
        const x0 = Math.floor(Math.min(...xs) - m)
        const y0 = Math.floor(Math.min(...ys) - m)
        const bw = Math.ceil(Math.max(...xs) + m) - x0
        const bh = Math.ceil(Math.max(...ys) + m) - y0
        const [tc, tg] = layer(bw, bh)
        tg.translate(-x0, -y0)
        tips.length = 0
        s0 = seed
        Math.random = replay
        tree(tg, x, y, ang, len, wid, 0, tips)
        Math.random = state
        for (const [tx, ty] of tips) glow(tg, tx, ty, rand(26, 44), 'rgba(235,120,175,0.22)')
        for (const [tx, ty] of tips) {
          const n = 7 + ((Math.random() * 7) | 0)
          for (let i = 0; i < n; i++) {
            const a = rand(0, 6.3)
            const d = Math.random() * 20
            const lit = ty < h * 0.25 ? 1 : 0
            flower(tg, tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.8, rand(3.4, 6.4), PINKS[(Math.random() * (PINKS.length - lit)) | 0], rand(0, 6.3))
          }
        }
        const side = x < w / 2 ? 1 : -1
        for (const [tx, ty] of tips) canopy.push([tx, ty, side])
        trees.push({ c: tc, x0, y0, bw, bh, px: x, py: y, side, ph: rand(0, 6.3) })
      }
      petals = Array.from({ length: Math.round(30 * dens) }, () => make(false))
    },
    points() {
      return canopy.map(([x, y]) => [x, y] as [number, number])
    },
    frame(g, t, dt) {
      now = t
      if (bg) g.drawImage(bg, 0, 0, w, h)
      for (const l of lamps) {
        const f = 0.85 + 0.15 * Math.sin(t * 3 + l.p) * Math.sin(t * 1.7 + l.p * 2)
        glow(g, l.x, l.y, l.r * 2.4, 'rgba(255,170,90,0.28)', f)
        glow(g, l.x, l.y, l.r * 0.5, 'rgba(255,225,170,0.95)', f)
      }
      // trees breathe in the night air; after four taps a gust rocks them and slowly settles
      const since = shook < 0 ? 99 : t - shook
      const gust = since < 6 ? (1 - Math.exp(-since * 9)) * Math.exp(-since * 0.9) : 0
      for (const tr of trees) {
        const a = tr.side * (0.006 * Math.sin(t * 0.7 + tr.ph) + gust * (0.05 * Math.sin(since * 6.2 + tr.ph) + 0.025))
        g.save()
        g.translate(tr.px, tr.py)
        g.rotate(a)
        g.translate(-tr.px, -tr.py)
        g.drawImage(tr.c, tr.x0, tr.y0, tr.bw, tr.bh)
        g.restore()
      }
      // a handful of petals let go behind the bubbles too, the rest fall on the chat from the overlay
      if (queue > 0 && canopy.length) {
        const n = Math.min(queue, Math.ceil(dt * 50))
        queue -= n
        for (let i = 0; i < n; i++) {
          const [cx, cy, side] = canopy[(Math.random() * canopy.length) | 0]
          const a = rand(0, 6.3)
          const d = Math.random() * 22
          petals.push({ ...make(false), x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, vx: side * rand(25, 80), vy: rand(-6, 14), vr: rand(-3, 3), vf: rand(2.5, 5), once: { bx: rand(-30, -10) * sp, vy: rand(34, 70) * sp } })
        }
      }
      let gone = false
      for (const p of petals) {
        if (p.once) {
          // ease from the gust into the same lazy fall as the rest
          const k = Math.min(1, dt * 0.9)
          p.vx += (p.once.bx - p.vx) * k
          p.vy += (p.once.vy - p.vy) * k
        }
        p.x += (p.vx + Math.sin(t * 0.8 + p.flip) * 14 - gust * 40) * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt
        p.flip += p.vf * dt
        if (p.y > h + 12 || p.x < -20 || p.x > w + 40) {
          if (p.once) {
            p.s = 0
            gone = true
            continue
          }
          Object.assign(p, make(true))
        }
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.scale(Math.cos(p.flip), 1)
        g.fillStyle = p.c
        g.globalAlpha = 0.9
        petalPath(g, p.s)
        g.fill()
        g.restore()
      }
      g.globalAlpha = 1
      if (gone) petals = petals.filter((p) => p.s > 0)
    },
    fx(f) {
      if (f !== 'bloom') return
      shook = now
      const extra = petals.filter((p) => p.once).length
      queue = Math.max(0, Math.min(document.documentElement.dataset.lite === '1' ? 25 : 50, 70 - extra))
    },
  }
}

export function SakuraNightScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeSakura(o)} />
    </div>
  )
}
