// Night scene: blue butterflies, painted on canvas. Three small morphos wander the night, nothing else moves much.
import type { CSSProperties } from 'react'
import { SceneCanvas, glow, layer, rand, type Scene } from '../SceneCanvas'
import { pace, type Opts } from './common'

const wrap = { position: 'absolute', inset: 0 } as CSSProperties

/* ================================================================== blue butterflies */
type Fly = {
  x: number; y: number; vx: number; vy: number; tx: number; ty: number
  span: number; cruise: number; head: number; ph: number
  beat: number; flap: number; glide: number; open: number
}
type Speck = { x: number; y: number; vx: number; vy: number; ph: number; r: number }

/** one side, drawn as if seen from above; s = 1 is a 92px wingspan, flat says how foreshortened the wing is */
function wing(g: CanvasRenderingContext2D, s: number, side: number, flat: number) {
  g.save()
  g.scale(side * flat, 1)
  // forewing: long leading edge, pointed tip, gently concave outer edge
  const fg = g.createLinearGradient(0, 0, 42 * s, -18 * s)
  fg.addColorStop(0, '#0B2E8C')
  fg.addColorStop(0.35, '#2F86FF')
  fg.addColorStop(0.7, '#7AD8FF')
  fg.addColorStop(0.9, '#1A4FB8')
  fg.addColorStop(1, '#061433')
  g.fillStyle = fg
  g.beginPath()
  g.moveTo(1 * s, -4 * s)
  g.bezierCurveTo(10 * s, -20 * s, 28 * s, -30 * s, 44 * s, -27 * s)
  g.bezierCurveTo(46 * s, -20 * s, 41 * s, -12 * s, 38 * s, -4 * s)
  g.bezierCurveTo(28 * s, 0, 14 * s, 1 * s, 1 * s, 1 * s)
  g.closePath()
  g.fill()
  // hindwing: rounded with a soft scalloped margin
  const hg = g.createLinearGradient(0, 0, 30 * s, 24 * s)
  hg.addColorStop(0, '#0B2E8C')
  hg.addColorStop(0.4, '#2A78F4')
  hg.addColorStop(0.75, '#5EC2FF')
  hg.addColorStop(1, '#071838')
  g.fillStyle = hg
  g.beginPath()
  g.moveTo(1 * s, 1 * s)
  g.bezierCurveTo(14 * s, -1 * s, 31 * s, 3 * s, 33 * s, 13 * s)
  g.quadraticCurveTo(33 * s, 19 * s, 29 * s, 22 * s)
  g.quadraticCurveTo(25 * s, 28 * s, 18 * s, 28 * s)
  g.quadraticCurveTo(11 * s, 30 * s, 7 * s, 23 * s)
  g.bezierCurveTo(3 * s, 16 * s, 1 * s, 9 * s, 1 * s, 1 * s)
  g.closePath()
  g.fill()
  // dark veins near the body and a hint of the white margin spots
  g.strokeStyle = 'rgba(4,14,40,0.55)'
  g.lineWidth = 1.4 * s
  g.beginPath()
  g.moveTo(1 * s, 0)
  g.lineTo(38 * s, -4 * s)
  g.stroke()
  g.fillStyle = 'rgba(230,246,255,0.8)'
  for (const [x, y] of [[41, -22], [39, -15], [27, 22]] as const) {
    g.beginPath()
    g.arc(x * s, y * s, 1.6 * s, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function butterfly(g: CanvasRenderingContext2D, f: Fly, bob: number) {
  const s = f.span / 92
  g.save()
  g.translate(f.x, f.y + bob)
  g.rotate(f.head)
  glow(g, 0, 0, f.span * 0.95, 'rgba(70,160,255,0.16)')
  wing(g, s, -1, f.open)
  wing(g, s, 1, f.open)
  // body and antennae
  g.fillStyle = '#050B18'
  g.beginPath()
  g.ellipse(0, 3 * s, 2.4 * s, 12 * s, 0, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.arc(0, -9.5 * s, 2.6 * s, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#050B18'
  g.lineWidth = Math.max(0.6, 1.1 * s)
  for (const k of [-1, 1]) {
    g.beginPath()
    g.moveTo(k * 1 * s, -11 * s)
    g.quadraticCurveTo(k * 3 * s, -20 * s, k * 8 * s, -24 * s)
    g.stroke()
  }
  g.restore()
}

function makeButterflies({ speed }: Opts): Scene {
  let w = 0
  let h = 0
  let bg: HTMLCanvasElement | null = null
  let flies: Fly[] = []
  let specks: Speck[] = []
  const sp = pace(speed)
  const pick = (f: Fly) => {
    f.tx = rand(w * 0.06, w * 0.94)
    f.ty = rand(h * 0.08, h * 0.88)
  }
  return {
    init(W, H) {
      w = W
      h = H
      const [c, g] = layer(w, h)
      const sk = g.createLinearGradient(0, 0, 0, h)
      sk.addColorStop(0, '#030D18')
      sk.addColorStop(0.45, '#05202F')
      sk.addColorStop(1, '#020A12')
      g.fillStyle = sk
      g.fillRect(0, 0, w, h)
      // faint deep-blue depth, far out of focus
      for (let i = 0; i < 7; i++) glow(g, Math.random() * w, Math.random() * h, rand(60, 140), 'rgba(40,120,200,0.07)')
      // vignette
      const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.75)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,4,10,0.55)')
      g.fillStyle = vg
      g.fillRect(0, 0, w, h)
      bg = c
      flies = Array.from({ length: 3 }, (_, i) => {
        const f: Fly = {
          x: rand(w * 0.15, w * 0.85), y: h * (0.2 + i * 0.28), vx: 0, vy: 0, tx: 0, ty: 0,
          span: rand(22, 30), cruise: rand(34, 52) * sp, head: 0, ph: rand(0, 6.3),
          beat: rand(9, 12) * Math.min(1.6, sp), flap: rand(0, 6.3), glide: 0, open: 1,
        }
        pick(f)
        return f
      })
      specks = Array.from({ length: 10 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: rand(-3, 3), vy: rand(-7, -2), ph: rand(0, 6.3), r: rand(0.6, 1.2) }))
    },
    frame(g, t, dt) {
      if (bg) g.drawImage(bg, 0, 0, w, h)
      for (const p of specks) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.y < -6) Object.assign(p, { x: Math.random() * w, y: h + 6 })
        glow(g, p.x, p.y, p.r * 4, `rgba(160,215,255,${0.18 + 0.14 * Math.sin(t * 0.8 + p.ph)})`)
      }
      for (const f of flies) {
        // steer toward a wandering waypoint, pick a new one when close
        const dx = f.tx - f.x
        const dy = f.ty - f.y
        const d = Math.hypot(dx, dy)
        if (d < 30) pick(f)
        const gliding = f.glide > 0
        const want = f.cruise * (gliding ? 0.7 : 1)
        const wob = Math.sin(t * 1.3 + f.ph) * 0.9 + Math.sin(t * 3.1 + f.ph * 2) * 0.35
        const ang = Math.atan2(dy, dx) + wob * 0.5
        const k = Math.min(1, dt * 1.6)
        f.vx += (Math.cos(ang) * want - f.vx) * k
        f.vy += (Math.sin(ang) * want + (gliding ? 10 : 0) - f.vy) * k
        f.x += f.vx * dt
        f.y += f.vy * dt
        // body follows the heading, softly
        const target = Math.atan2(f.vy, f.vx) + Math.PI / 2
        let dh = target - f.head
        dh = Math.atan2(Math.sin(dh), Math.cos(dh))
        f.head += dh * Math.min(1, dt * 3)
        // flapping in bursts with short glides between
        if (gliding) {
          f.glide -= dt
          f.open += (0.92 - f.open) * Math.min(1, dt * 8)
        } else {
          f.flap += dt * f.beat
          f.open = 0.14 + 0.86 * Math.abs(Math.cos(f.flap))
          if (Math.random() < dt * 0.35) f.glide = rand(0.5, 1.3)
        }
        butterfly(g, f, gliding ? 0 : Math.sin(f.flap) * 1.4)
      }
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
