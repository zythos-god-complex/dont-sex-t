// Night scenes from Ember's list, painted on canvas: meteor shower, rain temple, sakura night, blue butterflies.
// Each scene paints its still parts once per resize and only animates the moving bits.
import type { CSSProperties } from 'react'
import { SceneCanvas, glow, hills, layer, rand, type Scene } from './SceneCanvas'

type Opts = { amount: number; speed: number }
const density = (a: number) => 0.6 + a * 1.6 // slider 0.25 -> 1x
const pace = (s: number) => 0.7 + s // slider 0.3 -> 1x

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

/* ================================================================== sakura night */
type Petal = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; flip: number; vf: number; s: number; c: string }
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

function makeSakura({ amount, speed }: Opts): Scene {
  let w = 0
  let h = 0
  let bg: HTMLCanvasElement | null = null
  let petals: Petal[] = []
  let lamps: { x: number; y: number; r: number; p: number }[] = []
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
      // a lantern lit lane fading to the horizon
      lamps = Array.from({ length: 7 }, (_, i) => {
        const k = i / 6
        return { x: w * (0.5 + (i % 2 ? 1 : -1) * (0.08 + k * 0.4)), y: h * (0.78 + k * 0.17), r: 10 + k * 38, p: rand(0, 6) }
      })
      // two blossom trees framing the top corners, grown branch by branch
      for (const [x, y, ang, len, wid] of [[-w * 0.03, h * 0.44, -1.22, Math.min(h * 0.14, w * 0.3), 12], [w * 1.03, h * 0.34, -1.92, Math.min(h * 0.12, w * 0.26), 10]] as const) {
        const tips: [number, number][] = []
        tree(g, x, y, ang, len, wid, 0, tips)
        for (const [tx, ty] of tips) glow(g, tx, ty, rand(26, 44), 'rgba(235,120,175,0.22)')
        for (const [tx, ty] of tips) {
          const n = 7 + ((Math.random() * 7) | 0)
          for (let i = 0; i < n; i++) {
            const a = rand(0, 6.3)
            const d = Math.random() * 20
            const lit = ty < h * 0.25 ? 1 : 0
            flower(g, tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.8, rand(3.4, 6.4), PINKS[(Math.random() * (PINKS.length - lit)) | 0], rand(0, 6.3))
          }
        }
      }
      bg = c
      petals = Array.from({ length: Math.round(30 * dens) }, () => make(false))
    },
    frame(g, t, dt) {
      if (bg) g.drawImage(bg, 0, 0, w, h)
      for (const l of lamps) {
        const f = 0.85 + 0.15 * Math.sin(t * 3 + l.p) * Math.sin(t * 1.7 + l.p * 2)
        glow(g, l.x, l.y, l.r * 2.4, 'rgba(255,170,90,0.28)', f)
        glow(g, l.x, l.y, l.r * 0.5, 'rgba(255,225,170,0.95)', f)
      }
      for (const p of petals) {
        p.x += (p.vx + Math.sin(t * 0.8 + p.flip) * 14) * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt
        p.flip += p.vf * dt
        if (p.y > h + 12 || p.x < -20) Object.assign(p, make(true))
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
    },
  }
}

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

/* ================================================================== mounts */
const wrap = { position: 'absolute', inset: 0 } as CSSProperties

export function MeteorScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeMeteor(o)} />
    </div>
  )
}

export function SakuraNightScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeSakura(o)} />
    </div>
  )
}

export function ButterflyScene(o: Opts) {
  return (
    <div className="amb sc-night" style={wrap} aria-hidden="true">
      <SceneCanvas key={`${o.amount}:${o.speed}`} make={() => makeButterflies(o)} />
    </div>
  )
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
