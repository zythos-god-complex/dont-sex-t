// Night scene: rain temple, painted on canvas. A far pagoda in the fog, lantern light on wet ground, calm rain in front.
import { SceneCanvas, glow, hills, layer, rand, type Scene } from '../SceneCanvas'
import { density, type Opts } from './common'

/* ================================================================== rain temple */
type Drop = { x: number; y: number; v: number; z: number; land: number }
type Ripple = { x: number; y: number; age: number; r: number }
type Lamp = { x: number; y: number; r: number; p: number }

/** one pagoda roof: flat underside, upswept eave tips, concave slope up to the next floor */
function roof(g: CanvasRenderingContext2D, cx: number, y: number, rw: number, rh: number) {
  const lift = rh * 0.55
  g.beginPath()
  g.moveTo(cx - rw, y - lift)
  g.quadraticCurveTo(cx - rw * 0.86, y + rh * 0.05, cx - rw * 0.62, y)
  g.lineTo(cx + rw * 0.62, y)
  g.quadraticCurveTo(cx + rw * 0.86, y + rh * 0.05, cx + rw, y - lift)
  g.quadraticCurveTo(cx + rw * 0.62, y - rh * 0.55, cx + rw * 0.36, y - rh)
  g.lineTo(cx - rw * 0.36, y - rh)
  g.quadraticCurveTo(cx - rw * 0.62, y - rh * 0.55, cx - rw, y - lift)
  g.closePath()
  g.fill()
}

function pagoda(g: CanvasRenderingContext2D, cx: number, base: number, H: number, color: string) {
  g.fillStyle = color
  const floors = 5
  const fh = (H * 0.78) / floors
  let y = base
  let rw = H * 0.34
  g.fillRect(cx - rw * 0.62, base - fh * 0.2, rw * 1.24, fh * 0.2 + 2) // stone base
  for (let i = 0; i < floors; i++) {
    const bw = rw * 0.42
    g.fillRect(cx - bw, y - fh * 0.62, bw * 2, fh * 0.62)
    y -= fh * 0.62
    roof(g, cx, y, rw, fh * 0.42)
    y -= fh * 0.38
    rw *= 0.84
  }
  // spire with rings
  g.fillRect(cx - 1, y - H * 0.2, 2, H * 0.2)
  for (let i = 0; i < 6; i++) g.fillRect(cx - 3.2 + i * 0.25, y - H * 0.04 - i * H * 0.022, 6.4 - i * 0.5, 1.6)
}

/** a soft treeline: overlapping crowns along a base line */
function trees(g: CanvasRenderingContext2D, w: number, base: number, size: number, color: string) {
  g.fillStyle = color
  g.fillRect(0, base, w, size * 3)
  for (let x = -size; x < w + size; x += size * rand(0.45, 0.8)) {
    const r = size * rand(0.5, 1.05)
    g.beginPath()
    g.ellipse(x, base - r * 0.35, r * 0.8, r, 0, 0, Math.PI * 2)
    g.fill()
  }
}

function makeRain({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let bg: HTMLCanvasElement | null = null
  let drops: Drop[] = []
  let ripples: Ripple[] = []
  let lamps: Lamp[] = []
  let bolt: { pts: [number, number][][]; age: number } | null = null
  const lite = document.documentElement.dataset.lite === '1'
  // calm by default; the speed slider tops out a bit over twice as fast, never a downpour blur
  const rp = 0.85 + speed * 0.45
  const count = Math.min(lite ? 160 : 320, Math.round(120 * density(amount)))
  const wind = 0.1
  const ground = () => h * 0.8
  const make = (top: boolean): Drop => {
    const z = Math.random()
    return { x: rand(-w * 0.1, w * 1.05), y: top ? rand(-h * 0.25, -5) : rand(0, h), v: (240 + z * 300) * rp, z, land: z > 0.55 ? rand(ground(), h) : h * 1.1 }
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
      const [c, g] = layer(w, h)
      const gy = ground()
      // sky: deep teal at the top, a fog glow sitting on the horizon
      const sk = g.createLinearGradient(0, 0, 0, h)
      sk.addColorStop(0, '#04110F')
      sk.addColorStop(0.45, '#0A2427')
      sk.addColorStop(0.7, '#17393A')
      sk.addColorStop(0.8, '#0C2224')
      sk.addColorStop(1, '#030A0A')
      g.fillStyle = sk
      g.fillRect(0, 0, w, h)
      glow(g, w * 0.5, h * 0.68, w * 0.9, 'rgba(120,170,165,0.10)')
      // far ridges fading into the fog
      hills(g, w, h, h * 0.62, h * 0.07, '#163435', 2.2)
      hills(g, w, h, h * 0.67, h * 0.05, '#122C2D', 4.6)
      // the pagoda on its hill, then a fog band across its base
      const px = w * 0.7
      const pb = h * 0.705
      const ph = Math.min(h * 0.24, w * 0.55)
      hills(g, w, h, pb + 4, h * 0.03, '#0F2526', 0.4)
      pagoda(g, px, pb + 2, ph, '#0D2224')
      // one warm light at the temple door
      glow(g, px, pb - ph * 0.08, ph * 0.12, 'rgba(255,180,110,0.22)')
      const fog = g.createLinearGradient(0, pb - ph * 0.35, 0, pb + h * 0.04)
      fog.addColorStop(0, 'rgba(140,185,180,0)')
      fog.addColorStop(0.7, 'rgba(140,185,180,0.16)')
      fog.addColorStop(1, 'rgba(140,185,180,0)')
      g.fillStyle = fog
      g.fillRect(0, pb - ph * 0.35, w, ph * 0.35 + h * 0.04)
      // near treeline and the wet ground
      trees(g, w, gy - h * 0.025, h * 0.03, '#081A1B')
      const wet = g.createLinearGradient(0, gy, 0, h)
      wet.addColorStop(0, '#0A1C1D')
      wet.addColorStop(1, '#030909')
      g.fillStyle = wet
      g.fillRect(0, gy, w, h - gy)
      // lanterns along a path: warm light, its pool on the ground and a long reflection
      lamps = [
        [0.16, 0.835, 1],
        [0.36, 0.815, 0.62],
        [0.82, 0.86, 1.15],
        [0.58, 0.808, 0.5],
      ].map(([x, y, k]) => ({ x: w * x, y: h * y, r: 7 * k * Math.max(1, w / 390), p: rand(0, 6.3) }))
      for (const l of lamps) {
        glow(g, l.x, l.y + l.r * 3.2, l.r * 9, 'rgba(255,170,90,0.10)')
        g.save()
        g.translate(l.x, l.y)
        g.scale(0.32, 1)
        glow(g, 0, l.r * 6, l.r * 7, 'rgba(255,170,95,0.18)')
        g.restore()
      }
      // a thin mist over everything near the ground
      const mist = g.createLinearGradient(0, gy - h * 0.06, 0, h)
      mist.addColorStop(0, 'rgba(150,190,185,0.06)')
      mist.addColorStop(0.4, 'rgba(150,190,185,0.03)')
      mist.addColorStop(1, 'rgba(150,190,185,0)')
      g.fillStyle = mist
      g.fillRect(0, gy - h * 0.06, w, h)
      bg = c
      drops = Array.from({ length: count }, () => make(false))
      ripples = []
    },
    frame(g, t, dt) {
      if (bg) g.drawImage(bg, 0, 0, w, h)
      // lantern cores breathe a little
      for (const l of lamps) {
        const f = 0.9 + 0.1 * Math.sin(t * 2.3 + l.p) * Math.sin(t * 1.1 + l.p * 2)
        glow(g, l.x, l.y, l.r * 4.2, 'rgba(255,165,85,0.32)', f)
        glow(g, l.x, l.y, l.r * 1.1, 'rgba(255,232,190,0.95)', f)
      }
      g.lineCap = 'round'
      for (const d of drops) {
        d.y += d.v * dt
        d.x += d.v * wind * dt
        if (d.y > d.land) {
          if (d.land < h && ripples.length < (lite ? 24 : 48)) ripples.push({ x: d.x, y: d.y, age: 0, r: 2 + d.z * 5 })
          Object.assign(d, make(true))
        }
        const len = d.v * 0.028
        g.strokeStyle = `rgba(200,228,225,${0.08 + d.z * 0.3})`
        g.lineWidth = 0.5 + d.z * 0.9
        g.beginPath()
        g.moveTo(d.x, d.y)
        g.lineTo(d.x - len * wind, d.y - len)
        g.stroke()
      }
      ripples = ripples.filter((s) => {
        s.age += dt
        const k = s.age / 0.7
        if (k >= 1) return false
        g.strokeStyle = `rgba(190,225,220,${0.32 * (1 - k)})`
        g.lineWidth = 0.7
        g.beginPath()
        g.ellipse(s.x, s.y, s.r * (0.4 + k * 1.8), s.r * (0.1 + k * 0.42), 0, 0, Math.PI * 2)
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
      branch(rand(w * 0.2, w * 0.8), -10, Math.PI / 2 + rand(-0.2, 0.2), h * rand(0.4, 0.6), 0, out)
      bolt = { pts: out.reverse(), age: 0 }
    },
  }
}

/** rain temple: everything is canvas, the css background is only a fallback before the first frame */
export function TempleScene(o: Opts) {
  return (
    <div className="amb sc-temple" aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeRain(o)} />
    </div>
  )
}
