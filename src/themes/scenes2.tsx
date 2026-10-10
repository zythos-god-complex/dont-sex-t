// Night scenes from Ember's list, painted on canvas: meteor shower here, rain temple, sakura night and blue butterflies in ./night.
// Each scene paints its still parts once per resize and only animates the moving bits.
import type { CSSProperties } from 'react'
import { SceneCanvas, glow, hills, layer, rand, type Scene } from './SceneCanvas'
import { density, pace, type Opts } from './night/common'
export { TempleScene } from './night/rain'
export { SakuraNightScene } from './night/sakura'
export { ButterflyScene } from './night/butterflies'

const wrap = { position: 'absolute', inset: 0 } as CSSProperties

/* ================================================================== meteor shower */
type Meteor = { x: number; y: number; vx: number; vy: number; len: number; age: number; life: number; w: number }
type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number }

function makeMeteor({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let sky: HTMLCanvasElement | null = null
  let twinkles: { x: number; y: number; r: number; a: number; f: number; p: number; flare: boolean }[] = []
  let meteors: Meteor[] = []
  let sparks: Spark[] = []
  let big: (Meteor & { t: number }) | null = null
  let next = rand(0.8, 2)
  const dens = density(amount)
  const sp = pace(speed)
  // every meteor in a shower comes from one radiant: same direction, down and to the left
  const ang = (148 * Math.PI) / 180
  const dir = { x: Math.cos(ang), y: Math.sin(ang) }

  const spawn = (): Meteor => {
    const v = rand(650, 1100) * sp
    return { x: rand(w * 0.25, w * 1.15), y: rand(-h * 0.05, h * 0.42), vx: dir.x * v, vy: dir.y * v, len: rand(80, 190), age: 0, life: rand(0.45, 0.9), w: rand(1, 1.8) }
  }

  const drawStreak = (g: CanvasRenderingContext2D, m: Meteor, a: number, head: number, tint: string) => {
    const tx = m.x - dir.x * m.len
    const ty = m.y - dir.y * m.len
    const gr = g.createLinearGradient(tx, ty, m.x, m.y)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.7, `rgba(${tint},${0.35 * a})`)
    gr.addColorStop(1, `rgba(255,255,255,${a})`)
    g.strokeStyle = gr
    g.lineCap = 'round'
    g.lineWidth = m.w
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(m.x, m.y)
    g.stroke()
    glow(g, m.x, m.y, head, `rgba(${tint},${0.9 * a})`)
    glow(g, m.x, m.y, head * 0.35, `rgba(255,255,255,${a})`)
  }

  return {
    init(W, H) {
      w = W
      h = H
      const [c, g] = layer(w, h)
      const sk = g.createLinearGradient(0, 0, 0, h)
      sk.addColorStop(0, '#02040E')
      sk.addColorStop(0.45, '#061032')
      sk.addColorStop(0.8, '#141947')
      sk.addColorStop(1, '#231A4A')
      g.fillStyle = sk
      g.fillRect(0, 0, w, h)
      glow(g, w * 0.5, h * 1.02, w * 0.9, 'rgba(120,90,210,0.32)')
      glow(g, w * 0.1, h * 0.05, w * 0.6, 'rgba(60,90,200,0.18)')
      // milky way: soft band plus dense faint stars along it
      for (let i = 0; i < 9; i++) {
        const k = i / 8
        glow(g, w * (1.05 - k * 1.1), h * (0.02 + k * 0.62), w * 0.32, i % 2 ? 'rgba(150,160,255,0.07)' : 'rgba(255,190,230,0.05)')
      }
      const n = Math.round((w * h) / 900)
      for (let i = 0; i < n; i++) {
        const onBand = Math.random() < 0.45
        const k = Math.random()
        const x = onBand ? w * (1.05 - k * 1.1) + rand(-1, 1) * w * 0.16 * Math.random() : Math.random() * w
        const y = onBand ? h * (0.02 + k * 0.62) + rand(-1, 1) * h * 0.08 * Math.random() : Math.random() * h * 0.85
        const r = Math.random() < 0.92 ? rand(0.25, 0.75) : rand(0.8, 1.3)
        const tint = Math.random()
        g.fillStyle = tint < 0.15 ? 'rgba(190,210,255,1)' : tint < 0.25 ? 'rgba(255,225,200,1)' : 'rgba(255,255,255,1)'
        g.globalAlpha = rand(0.25, 0.85) * (y / h > 0.7 ? 0.5 : 1)
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      hills(g, w, h, h * 0.9, h * 0.07, '#0B1030', 2.1)
      hills(g, w, h, h * 0.95, h * 0.05, '#05071A', 4.4)
      sky = c
      twinkles = Array.from({ length: Math.round(28 * dens) }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.75, r: rand(0.8, 1.6), a: rand(0.5, 1), f: rand(0.6, 1.8), p: rand(0, 6.3), flare: Math.random() < 0.18 }))
    },
    frame(g, t, dt) {
      if (sky) g.drawImage(sky, 0, 0, w, h)
      for (const s of twinkles) {
        const a = s.a * (0.55 + 0.45 * Math.sin(t * s.f + s.p))
        glow(g, s.x, s.y, s.r * 4, `rgba(200,215,255,${0.35 * a})`)
        g.fillStyle = `rgba(255,255,255,${a})`
        g.beginPath()
        g.arc(s.x, s.y, s.r * 0.6, 0, Math.PI * 2)
        g.fill()
        if (s.flare) {
          g.strokeStyle = `rgba(220,230,255,${0.5 * a})`
          g.lineWidth = 0.6
          g.beginPath()
          g.moveTo(s.x - s.r * 5, s.y)
          g.lineTo(s.x + s.r * 5, s.y)
          g.moveTo(s.x, s.y - s.r * 5)
          g.lineTo(s.x, s.y + s.r * 5)
          g.stroke()
        }
      }
      next -= dt
      if (next <= 0) {
        meteors.push(spawn())
        if (Math.random() < 0.18) meteors.push(spawn()) // sometimes two at once, like a real shower
        next = rand(1.4, 4.2) / dens
      }
      meteors = meteors.filter((m) => {
        m.age += dt
        m.x += m.vx * dt
        m.y += m.vy * dt
        const k = m.age / m.life
        if (k >= 1) return false
        const a = k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1
        drawStreak(g, m, a, 7, '190,210,255')
        return true
      })
      if (big) {
        big.t += dt
        const k = big.t / big.life
        big.x += big.vx * dt
        big.y += big.vy * dt
        if (k >= 1) big = null
        else {
          const a = k < 0.1 ? k / 0.1 : k > 0.75 ? (1 - k) / 0.25 : 1
          g.globalAlpha = 0.25 * a
          g.lineWidth = 10
          g.lineCap = 'round'
          g.strokeStyle = 'rgba(255,220,150,1)'
          g.beginPath()
          g.moveTo(big.x - dir.x * big.len * 0.5, big.y - dir.y * big.len * 0.5)
          g.lineTo(big.x, big.y)
          g.stroke()
          g.globalAlpha = 1
          drawStreak(g, big, a, 34, '255,226,160')
          for (let i = 0; i < 3; i++) sparks.push({ x: big.x, y: big.y, vx: rand(-40, 40) - big.vx * 0.04, vy: rand(-30, 50) - big.vy * 0.04, age: 0, life: rand(0.6, 1.4), r: rand(0.8, 2) })
        }
      }
      sparks = sparks.filter((s) => {
        s.age += dt
        if (s.age >= s.life) return false
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vy += 30 * dt
        const a = 1 - s.age / s.life
        glow(g, s.x, s.y, s.r * 4, `rgba(255,220,150,${0.6 * a})`)
        return true
      })
    },
    fx(f) {
      if (f !== 'wish') return
      const v = Math.hypot(w, h) * 0.55
      big = { x: w * 1.05, y: -h * 0.04, vx: dir.x * v, vy: dir.y * v, len: Math.min(w, h) * 0.75, age: 0, life: 2.2, w: 3.2, t: 0 }
    },
  }
}

export function MeteorScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeMeteor(o)} />
    </div>
  )
}
