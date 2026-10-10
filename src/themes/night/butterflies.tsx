// Night scene: blue butterflies, painted on canvas. Still parts are painted once per resize, only the moving bits animate.
import type { CSSProperties } from 'react'
import { SceneCanvas, glow, layer, rand, type Scene } from '../SceneCanvas'
import { density, pace, type Opts } from './common'

const wrap = { position: 'absolute', inset: 0 } as CSSProperties

/* ================================================================== blue butterflies */
type Fly = { cx: number; cy: number; vx: number; ph: number[]; size: number; flap: number; trail: number }
type Mote = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number }

function wing(g: CanvasRenderingContext2D, s: number, side: number, open: number) {
  g.save()
  g.scale(side * open, 1)
  // forewing
  const fg = g.createRadialGradient(4 * s, -8 * s, 1, 18 * s, -14 * s, 32 * s)
  fg.addColorStop(0, '#0A2A86')
  fg.addColorStop(0.45, '#2F7BFF')
  fg.addColorStop(0.8, '#7FD6FF')
  fg.addColorStop(1, '#0B1B3A')
  g.fillStyle = fg
  g.beginPath()
  g.moveTo(0, -2 * s)
  g.bezierCurveTo(6 * s, -16 * s, 22 * s, -28 * s, 36 * s, -25 * s)
  g.bezierCurveTo(44 * s, -23 * s, 46 * s, -14 * s, 40 * s, -8 * s)
  g.bezierCurveTo(32 * s, 0, 14 * s, 2 * s, 0, 2 * s)
  g.closePath()
  g.fill()
  g.strokeStyle = 'rgba(2,10,28,0.85)'
  g.lineWidth = 1.6 * s
  g.stroke()
  // hindwing
  const hg = g.createRadialGradient(4 * s, 6 * s, 1, 16 * s, 16 * s, 26 * s)
  hg.addColorStop(0, '#0A2A86')
  hg.addColorStop(0.5, '#2A6CF0')
  hg.addColorStop(0.85, '#68C4FF')
  hg.addColorStop(1, '#0B1B3A')
  g.fillStyle = hg
  g.beginPath()
  g.moveTo(0, 2 * s)
  g.bezierCurveTo(12 * s, 2 * s, 30 * s, 6 * s, 31 * s, 18 * s)
  g.bezierCurveTo(32 * s, 28 * s, 21 * s, 32 * s, 13 * s, 28 * s)
  g.bezierCurveTo(6 * s, 24 * s, 2 * s, 14 * s, 0, 6 * s)
  g.closePath()
  g.fill()
  g.stroke()
  // white dots along the forewing edge
  g.fillStyle = 'rgba(235,248,255,0.85)'
  for (const [x, y] of [[36, -20], [40, -14], [31, -22]]) {
    g.beginPath()
    g.arc(x * s, y * s, 1.2 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function butterfly(g: CanvasRenderingContext2D, x: number, y: number, size: number, open: number, tilt: number) {
  const s = size / 46
  g.save()
  g.translate(x, y)
  g.rotate(tilt)
  glow(g, 0, 0, size * 1.3, 'rgba(70,150,255,0.22)')
  wing(g, s, -1, open)
  wing(g, s, 1, open)
  g.fillStyle = '#061226'
  g.beginPath()
  g.ellipse(0, 2 * s, 1.8 * s, 9 * s, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#061226'
  g.lineWidth = 0.9 * s
  for (const k of [-1, 1]) {
    g.beginPath()
    g.moveTo(0, -6 * s)
    g.quadraticCurveTo(k * 3 * s, -14 * s, k * 6 * s, -17 * s)
    g.stroke()
    g.beginPath()
    g.arc(k * 6 * s, -17 * s, 1 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function makeButterflies({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let bg: HTMLCanvasElement | null = null
  let flies: Fly[] = []
  let motes: Mote[] = []
  let dust: Mote[] = []
  const dens = density(amount)
  const sp = pace(speed)
  return {
    init(W, H) {
      w = W
      h = H
      const [c, g] = layer(w, h)
      const sk = g.createLinearGradient(0, 0, 0, h)
      sk.addColorStop(0, '#04121F')
      sk.addColorStop(0.5, '#062538')
      sk.addColorStop(1, '#030E18')
      g.fillStyle = sk
      g.fillRect(0, 0, w, h)
      // lamp light from the top left with soft rays
      glow(g, w * 0.12, h * 0.08, w * 0.75, 'rgba(255,236,200,0.22)')
      g.save()
      g.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 5; i++) {
        const a0 = 0.35 + i * 0.16
        const rg = g.createLinearGradient(w * 0.12, h * 0.08, w * 0.12 + Math.cos(a0) * h, h * 0.08 + Math.sin(a0) * h)
        rg.addColorStop(0, 'rgba(255,240,210,0.07)')
        rg.addColorStop(1, 'rgba(255,240,210,0)')
        g.fillStyle = rg
        g.beginPath()
        g.moveTo(w * 0.12, h * 0.08)
        g.lineTo(w * 0.12 + Math.cos(a0 - 0.05) * h * 1.2, h * 0.08 + Math.sin(a0 - 0.05) * h * 1.2)
        g.lineTo(w * 0.12 + Math.cos(a0 + 0.05) * h * 1.2, h * 0.08 + Math.sin(a0 + 0.05) * h * 1.2)
        g.closePath()
        g.fill()
      }
      g.restore()
      // out of focus bokeh in teal and blue
      for (let i = 0; i < 16; i++) {
        const r = rand(14, 46)
        glow(g, Math.random() * w, Math.random() * h, r, Math.random() < 0.5 ? 'rgba(90,200,255,0.16)' : 'rgba(120,255,220,0.10)')
      }
      // dark foliage glow along the bottom
      glow(g, w * 0.15, h * 1.05, w * 0.6, 'rgba(0,30,25,0.8)')
      glow(g, w * 0.9, h * 1.02, w * 0.55, 'rgba(0,26,30,0.8)')
      bg = c
      const n = Math.max(2, Math.round(3 * dens))
      flies = Array.from({ length: n }, (_, i) => ({ cx: rand(0, w), cy: h * (0.18 + (i / n) * 0.6), vx: rand(10, 22) * (Math.random() < 0.5 ? -1 : 1) * sp, ph: [rand(0, 6), rand(0, 6), rand(0, 6), rand(0, 6)], size: rand(30, 46), flap: rand(7, 10), trail: 0 }))
      dust = Array.from({ length: Math.round(34 * dens) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: rand(-4, 4), vy: rand(-12, -4), age: rand(0, 6), life: rand(5, 9), r: rand(0.6, 1.6) }))
    },
    frame(g, t, dt) {
      if (bg) g.drawImage(bg, 0, 0, w, h)
      for (const d of dust) {
        d.age += dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        if (d.age > d.life || d.y < -10) Object.assign(d, { x: Math.random() * w, y: h + 5, age: 0 })
        const a = Math.sin((d.age / d.life) * Math.PI)
        glow(g, d.x, d.y, d.r * 5, `rgba(170,225,255,${0.45 * a})`)
      }
      for (const f of flies) {
        f.cx += f.vx * dt
        if (f.cx < -80) f.cx = w + 60
        if (f.cx > w + 80) f.cx = -60
        const x = f.cx + Math.sin(t * 0.7 + f.ph[0]) * 40 + Math.sin(t * 1.9 + f.ph[1]) * 12
        const y = f.cy + Math.sin(t * 0.9 + f.ph[2]) * 46 + Math.sin(t * 2.3 + f.ph[3]) * 10
        const open = 0.22 + 0.78 * Math.abs(Math.cos(t * f.flap + f.ph[0]))
        const tilt = Math.sin(t * 0.9 + f.ph[1]) * 0.35 + (f.vx > 0 ? 0.25 : -0.25)
        f.trail -= dt
        if (f.trail <= 0) {
          f.trail = 0.06
          motes.push({ x, y: y + 6, vx: rand(-8, 8), vy: rand(4, 16), age: 0, life: rand(0.9, 1.6), r: rand(0.6, 1.4) })
        }
        butterfly(g, x, y, f.size, open, tilt)
      }
      motes = motes.filter((m) => {
        m.age += dt
        if (m.age >= m.life) return false
        m.x += m.vx * dt
        m.y += m.vy * dt
        const a = 1 - m.age / m.life
        glow(g, m.x, m.y, m.r * 4, `rgba(150,215,255,${0.7 * a})`)
        return true
      })
    },
  }
}

export function ButterflyScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeButterflies(o)} />
    </div>
  )
}
