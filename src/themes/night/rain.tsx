// Night scene: rain temple, painted on canvas. Still parts are painted once per resize, only the moving bits animate.
import type { CSSProperties } from 'react'
import { SceneCanvas, rand, type Scene } from '../SceneCanvas'
import { density, pace, type Opts } from './common'

const wrap = { position: 'absolute', inset: 0 } as CSSProperties

/* ================================================================== rain temple */
type Drop = { x: number; y: number; v: number; len: number; z: number }
type Splash = { x: number; y: number; age: number; r: number }

function makeRain({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let drops: Drop[] = []
  let splashes: Splash[] = []
  let bolt: { pts: [number, number][][]; age: number } | null = null
  const dens = density(amount)
  const sp = pace(speed)
  const wind = 0.12
  const make = (top: boolean): Drop => {
    const z = Math.random()
    return { x: rand(-w * 0.1, w * 1.05), y: top ? rand(-h * 0.2, 0) : rand(0, h), v: (700 + z * 600) * sp, len: 10 + z * 18, z }
  }
  const branch = (x: number, y: number, ang: number, len: number, depth: number, out: [number, number][][]) => {
    const pts: [number, number][] = [[x, y]]
    let cx = x
    let cy = y
    const steps = 9
    for (let i = 0; i < steps; i++) {
      cx += Math.cos(ang) * (len / steps) + rand(-14, 14)
      cy += Math.sin(ang) * (len / steps)
      pts.push([cx, cy])
      if (depth < 2 && Math.random() < 0.22) branch(cx, cy, ang + rand(-0.9, 0.9), len * rand(0.25, 0.45), depth + 1, out)
    }
    out.push(pts)
  }
  return {
    init(W, H) {
      w = W
      h = H
      drops = Array.from({ length: Math.round(150 * dens) }, () => make(false))
    },
    frame(g, _t, dt) {
      g.clearRect(0, 0, w, h)
      g.lineCap = 'round'
      for (const d of drops) {
        d.y += d.v * dt
        d.x += d.v * wind * dt
        if (d.y > h * (0.78 + d.z * 0.2)) {
          if (d.z > 0.45 && splashes.length < 60) splashes.push({ x: d.x, y: d.y, age: 0, r: 2 + d.z * 5 })
          Object.assign(d, make(true))
        }
        g.strokeStyle = `rgba(205,235,232,${0.12 + d.z * 0.35})`
        g.lineWidth = 0.6 + d.z * 0.9
        g.beginPath()
        g.moveTo(d.x, d.y)
        g.lineTo(d.x - d.len * wind, d.y - d.len)
        g.stroke()
      }
      splashes = splashes.filter((s) => {
        s.age += dt
        const k = s.age / 0.45
        if (k >= 1) return false
        g.strokeStyle = `rgba(200,235,230,${0.4 * (1 - k)})`
        g.lineWidth = 0.8
        g.beginPath()
        g.ellipse(s.x, s.y, s.r * (0.4 + k * 1.6), s.r * (0.12 + k * 0.4), 0, 0, Math.PI * 2)
        g.stroke()
        return true
      })
      if (bolt) {
        bolt.age += dt
        const k = bolt.age / 0.8
        if (k >= 1) bolt = null
        else {
          const a = k < 0.1 ? 1 : k < 0.2 ? 0.25 : k < 0.32 ? 0.9 : (1 - k) / 0.68
          bolt.pts.forEach((pts, i) => {
            for (const [lw, al] of [[9, 0.12], [4, 0.3], [1.6, 1]] as const) {
              g.strokeStyle = `rgba(225,240,255,${al * a * (i ? 0.7 : 1)})`
              g.lineWidth = lw * (i ? 0.6 : 1)
              g.beginPath()
              pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)))
              g.stroke()
            }
          })
        }
      }
    },
    fx(f) {
      if (f !== 'thunder') return
      const out: [number, number][][] = []
      branch(rand(w * 0.2, w * 0.8), -10, Math.PI / 2 + rand(-0.2, 0.2), h * rand(0.45, 0.65), 0, out)
      bolt = { pts: out.reverse(), age: 0 }
    },
  }
}

/** rain temple: the temple and mist stay as svg, rain, splashes and lightning are canvas on top */
export function TempleScene(o: Opts) {
  return (
    <div className="amb sc-temple" aria-hidden="true">
      <svg className="tp-land" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
        <path className="tp-far" d="M0 170 C30 150 50 118 80 128 C110 138 120 96 160 104 C200 112 210 140 250 120 C290 100 310 92 350 112 C375 124 390 116 400 110 V300 H0 Z" />
        <g className="tp-near">
          <path d="M226 172 Q290 160 354 172 Q330 170 322 178 H258 Q250 170 226 172 Z M240 146 Q290 136 340 146 Q322 145 314 152 H266 Q258 145 240 146 Z M254 122 Q290 114 326 122 Q312 121 306 127 H274 Q268 121 254 122 Z" />
          <rect x="258" y="178" width="64" height="34" />
          <rect x="266" y="152" width="48" height="20" />
          <rect x="274" y="127" width="32" height="19" />
          <rect x="288" y="98" width="4" height="26" />
          <circle cx="290" cy="97" r="3.5" />
          <path d="M30 140 Q90 128 150 140 L146 148 Q90 138 34 148 Z" />
          <rect x="46" y="156" width="88" height="6" />
          <rect x="56" y="146" width="8" height="66" />
          <rect x="116" y="146" width="8" height="66" />
          <path d="M184 212 v-10 h12 v10 Z M180 202 h20 l-4 -6 h-12 Z M186 196 h8 v-6 h-8 Z M182 190 h16 l-8 -6 Z" />
          <path d="M0 212 H400 V300 H0 Z" />
        </g>
        <ellipse className="tp-lamp" cx="190" cy="200" rx="30" ry="14" />
      </svg>
      <span className="tp-mist" />
      <div style={wrap}>
        <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeRain(o)} fps={36} />
      </div>
    </div>
  )
}
