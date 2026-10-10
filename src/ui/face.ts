// Deterministic goofy-face generator (pure, no React). Same lowercase
// username -> same traits everywhere. Geometry lives on a 100x100 viewBox.

export const FACE_PALETTE = [
  '#FFC83D', // butter
  '#FF8A3D', // tangerine
  '#FF5C7A', // watermelon
  '#FF9ECF', // bubblegum
  '#B6E35A', // lime
  '#4FD1A5', // mint
  '#5BC0FF', // sky
  '#8FA8FF', // periwinkle
  '#C69CFF', // lilac
  '#FFB4A2', // peach
  '#9EE6E0', // aqua
  '#F2E8CF', // oat
] as const

export const FACE_INK = '#17131F'
export const TONGUE = '#FF6F91'

export type BlobKind = 'squircle' | 'bean' | 'egg' | 'cloud' | 'wobble' | 'tall' | 'wide' | 'star' | 'circle' | 'soft'
export type EyeKind = 'pair' | 'mismatch' | 'squint' | 'three' | 'sleepy' | 'wide' | 'beady' | 'calm' | 'soft' | 'almond' | 'shine' | 'lashes'
export type MouthKind = 'grin' | 'o' | 'wavy' | 'tongue' | 'teeth' | 'smirk' | 'bigD' | 'flat'
export type BrowKind = 'raised' | 'worried' | 'grumpy' | 'uneven'

export type FaceTraits = {
  seed: number
  color: string
  shade: string // darker outline tone of the blob color
  deep: string // much darker tone (readable accent text on light surfaces)
  blob: BlobKind
  blobRot: number
  eyes: EyeKind
  mouth: MouthKind
  brows: BrowKind | null
  blush: boolean
  freckles: boolean
  tooth: boolean
  antenna: boolean
  sprout: boolean
  spots: boolean
  mirror: boolean // flips asymmetric features (mismatch, squint, smirk)
  derp: boolean // pupils wander in different directions at rest
  featureRot: number
  dx: number // eye half-spacing
  er: number // eye radius
  ox: number // features offset
  oy: number
  accent: string // antenna ball / sprout tint
  blinkMs: number
  blinkDelayMs: number
}

/* ---------------- hashing ---------------- */

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // final avalanche so similar names diverge
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T extends string>(r: number, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((s, [, w]) => s + w, 0)
  let x = r * total
  for (const [k, w] of table) {
    if ((x -= w) < 0) return k
  }
  return table[table.length - 1][0]
}

/* ---------------- color helpers ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
}
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}

/* ---------------- blob geometry ---------------- */

type Pt = [number, number]
const r1 = (n: number) => Math.round(n * 10) / 10

/** Closed Catmull-Rom spline through points, as cubic beziers. */
function smoothClosed(pts: Pt[], tension = 1): string {
  const n = pts.length
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension]
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension]
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return d + 'Z'
}

function polar(n: number, cx: number, cy: number, fn: (t: number) => [number, number]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2 // start at the top
    const [rx, ry] = fn(t)
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return out
}

function superellipse(cx: number, cy: number, a: number, b: number, p: number, n = 40): Pt[] {
  return polar(n, cx, cy, (t) => {
    const c = Math.cos(t)
    const s = Math.sin(t)
    const r = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), -1 / p)
    return [a * r, b * r]
  })
}

export type BlobGeo = {
  d: string
  cx: number // feature center
  cy: number
  s: number // feature scale
  top: Pt // where antenna / sprout attach
}

function makeBlobs(): Record<BlobKind, BlobGeo> {
  const squircle = superellipse(50, 55, 40, 38, 3.4)

  const egg = polar(40, 50, 55, (t) => {
    const s = Math.sin(t) // +1 at bottom
    return [37.5 * (1 + 0.11 * s), 42 - 1.5 * s]
  })

  // bean: tilted ellipse with a soft dent on the upper-left
  const bean = polar(48, 50, 55, (t) => {
    const dent = 4.6 * Math.exp(-Math.pow(angDiff(t, -2.35) / 0.42, 2))
    const bulge = 2.2 * Math.exp(-Math.pow(angDiff(t, 0.75) / 0.7, 2))
    const base = ellipseR(t + 0.32, 42, 35.5)
    return [base - dent + bulge, base - dent + bulge]
  })

  const cloud = polar(84, 50, 56, (t) => {
    const bump = Math.pow(Math.abs(Math.cos(3.5 * (t + Math.PI / 2))), 0.7)
    const r = 34.5 + 6.5 * bump
    return [r * 1.07, r * 0.94]
  })

  const wobble = polar(48, 50, 55, (t) => {
    const r = 39.5 + 2.4 * Math.sin(5 * t + 0.6) + 1.3 * Math.sin(3 * t + 1.9)
    return [r, r * 0.985]
  })

  const star = polar(80, 50, 56, (t) => {
    const r = 36 + 6.2 * Math.cos(5 * (t + Math.PI / 2))
    return [r, r * 0.97]
  })

  const tall = superellipse(50, 53, 30, 43, 2.6, 44)
  const wide = superellipse(50, 56, 44, 31, 2.7, 44)

  return {
    squircle: { d: smoothClosed(squircle), cx: 50, cy: 55, s: 1, top: [50, 17] },
    circle: { d: 'M50 17 A39 39 0 1 1 49.99 17 Z', cx: 50, cy: 57, s: 1, top: [50, 17] },
    soft: { d: 'M50 19 C74 19 89 32 89 56 C89 80 74 93 50 93 C26 93 11 80 11 56 C11 32 26 19 50 19 Z', cx: 50, cy: 57, s: 1, top: [50, 19] },
    bean: { d: smoothClosed(bean), cx: 52, cy: 56, s: 0.97, top: [56, 19.5] },
    egg: { d: smoothClosed(egg), cx: 50, cy: 58, s: 0.97, top: [50, 14.5] },
    cloud: { d: smoothClosed(cloud), cx: 50, cy: 58, s: 0.98, top: [50, 18] },
    wobble: { d: smoothClosed(wobble), cx: 50, cy: 56, s: 0.99, top: [50, 16] },
    tall: { d: smoothClosed(tall), cx: 50, cy: 52, s: 0.86, top: [50, 10.5] },
    wide: { d: smoothClosed(wide), cx: 50, cy: 58, s: 0.95, top: [50, 25.5] },
    star: { d: smoothClosed(star), cx: 50, cy: 57, s: 0.9, top: [50, 14.5] },
  }
}

function angDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
function ellipseR(t: number, a: number, b: number): number {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return (a * b) / Math.sqrt(b * b * c * c + a * a * s * s)
}

export const BLOBS: Record<BlobKind, BlobGeo> = makeBlobs()
export const BLOB_KINDS = Object.keys(BLOBS) as BlobKind[]

/* ---------------- traits ---------------- */

const EYE_TABLE = [
  ['pair', 30],
  ['beady', 16],
  ['mismatch', 15],
  ['sleepy', 11],
  ['wide', 10],
  ['squint', 11],
  ['three', 7],
] as const satisfies readonly (readonly [EyeKind, number])[]

const MOUTH_TABLE = [
  ['grin', 20],
  ['bigD', 15],
  ['tongue', 13],
  ['o', 12],
  ['smirk', 12],
  ['teeth', 10],
  ['wavy', 10],
  ['flat', 8],
] as const satisfies readonly (readonly [MouthKind, number])[]

const BROW_TABLE = [
  ['raised', 3],
  ['worried', 3],
  ['grumpy', 2],
  ['uneven', 3],
] as const satisfies readonly (readonly [BrowKind, number])[]

const cache = new Map<string, FaceTraits>()

/** Default face used when there is no username yet (onboarding while empty). */
export const DEFAULT_FACE_KEY = '\u0000goofy'

export function faceTraits(username: string | null | undefined): FaceTraits {
  const key = (username ?? '').trim().toLowerCase() || DEFAULT_FACE_KEY
  const hit = cache.get(key)
  if (hit) return hit
  const t = key === DEFAULT_FACE_KEY ? defaultTraits() : genTraits(key)
  if (cache.size > 500) cache.clear()
  cache.set(key, t)
  return t
}

function genTraits(key: string): FaceTraits {
  const seed = hashString(key)
  const rnd = mulberry32(seed)
  const range = (a: number, b: number) => a + (b - a) * rnd()
  const chance = (p: number) => rnd() < p

  const colorIdx = Math.floor(rnd() * FACE_PALETTE.length)
  const color = FACE_PALETTE[colorIdx]
  const blob = BLOB_KINDS[Math.floor(rnd() * BLOB_KINDS.length)]
  const eyes = pickWeighted(rnd(), EYE_TABLE)
  let mouth = pickWeighted(rnd(), MOUTH_TABLE)
  if (eyes === 'sleepy' && mouth === 'bigD') mouth = 'o'
  const browRoll = rnd()
  const brows = eyes !== 'three' && browRoll < 0.24 ? pickWeighted(browRoll / 0.24, BROW_TABLE) : null
  const blush = chance(0.46)
  const freckles = chance(blush ? 0.12 : 0.22)
  const toothOk = mouth === 'grin' || mouth === 'bigD' || mouth === 'smirk'
  const tooth = toothOk && chance(0.3)
  const topRoll = rnd()
  const antenna = topRoll < 0.1
  const sprout = !antenna && topRoll < 0.2
  const spots = chance(0.1)
  const mirror = chance(0.5)
  const derp = (eyes === 'pair' || eyes === 'mismatch' || eyes === 'wide') && chance(0.22)
  const accentIdx = (colorIdx + 3 + Math.floor(rnd() * 6)) % FACE_PALETTE.length

  return {
    seed,
    color,
    shade: mixHex(color, FACE_INK, 0.24),
    deep: mixHex(color, FACE_INK, 0.62),
    blob,
    blobRot: range(-7, 7),
    eyes,
    mouth,
    brows,
    blush,
    freckles,
    tooth,
    antenna,
    sprout,
    spots,
    mirror,
    derp,
    featureRot: range(-6, 6),
    dx: range(13.5, 17),
    er: eyes === 'three' ? range(8.6, 9.6) : range(10.5, 13),
    ox: range(-2.5, 2.5),
    oy: range(-2, 2.5),
    accent: FACE_PALETTE[accentIdx],
    blinkMs: Math.round(range(3200, 7000)),
    blinkDelayMs: Math.round(range(0, 3000)),
  }
}

function defaultTraits(): FaceTraits {
  const color = FACE_PALETTE[0]
  return {
    seed: 0,
    color,
    shade: mixHex(color, FACE_INK, 0.24),
    deep: mixHex(color, FACE_INK, 0.62),
    blob: 'squircle',
    blobRot: -4,
    eyes: 'pair',
    mouth: 'grin',
    brows: null,
    blush: true,
    freckles: false,
    tooth: true,
    antenna: false,
    sprout: false,
    spots: false,
    mirror: false,
    derp: false,
    featureRot: -3,
    dx: 15.5,
    er: 12.5,
    ox: 0,
    oy: 0,
    accent: FACE_PALETTE[5],
    blinkMs: 4200,
    blinkDelayMs: 800,
  }
}

/** The blob fill color of a user's face (for accents: name chips, rings, toasts). */
export function faceColor(username: string | null | undefined): string {
  return faceTraits(username).color
}

/** A darker tone of the face color that stays readable as text on light surfaces. */
export function faceInkColor(username: string | null | undefined): string {
  return faceTraits(username).deep
}

/** Stable small tilt in degrees (+-range) for sticker-like cards. */
export function faceTilt(username: string | null | undefined, range = 1.5): number {
  const s = faceTraits(username).seed
  return (((s >>> 8) % 1000) / 1000) * range * 2 - range
}

/* ---------------- custom avatars (built at sign up) ---------------- */

export type TopKind = 'none' | 'antenna' | 'sprout'
export type AvatarConfig = {
  v: 1
  hat?: import('../lib/season').SeasonHat | null
  ghost?: boolean // ghost browse: wears a bedsheet
  photo?: string | null // approved profile photo (gat-pfp public url); null asks the server to drop it
  color: string
  blob: BlobKind
  eyes: EyeKind
  mouth: MouthKind
  brows: BrowKind | null
  blush: boolean
  freckles: boolean
  top: TopKind
}

export const EYE_KINDS: EyeKind[] = ['calm', 'soft', 'almond', 'shine', 'lashes', 'pair', 'beady', 'wide', 'mismatch', 'sleepy', 'squint', 'three']
export const MOUTH_KINDS: MouthKind[] = ['grin', 'bigD', 'tongue', 'o', 'smirk', 'teeth', 'wavy', 'flat']
export const BROW_KINDS: (BrowKind | null)[] = [null, 'raised', 'worried', 'grumpy', 'uneven']
export const TOP_KINDS: TopKind[] = ['none', 'antenna', 'sprout']

export function isAvatar(x: unknown): x is AvatarConfig {
  if (!x || typeof x !== 'object') return false
  const a = x as Record<string, unknown>
  return (
    (FACE_PALETTE as readonly string[]).includes(a.color as string) &&
    BLOB_KINDS.includes(a.blob as BlobKind) &&
    EYE_KINDS.includes(a.eyes as EyeKind) &&
    MOUTH_KINDS.includes(a.mouth as MouthKind) &&
    BROW_KINDS.includes((a.brows ?? null) as BrowKind | null) &&
    TOP_KINDS.includes(a.top as TopKind) &&
    typeof a.blush === 'boolean' &&
    typeof a.freckles === 'boolean'
  )
}

export function avatarFromTraits(t: FaceTraits): AvatarConfig {
  return {
    v: 1,
    color: t.color,
    blob: t.blob,
    eyes: t.eyes,
    mouth: t.mouth,
    brows: t.brows,
    blush: t.blush,
    freckles: t.freckles,
    top: t.antenna ? 'antenna' : t.sprout ? 'sprout' : 'none',
  }
}

export function applyAvatar(t: FaceTraits, a: AvatarConfig | null | undefined): FaceTraits {
  if (!isAvatar(a)) return t
  let er = t.er
  if (a.eyes === 'three' && t.eyes !== 'three') er = 9.1
  if (a.eyes !== 'three' && t.eyes === 'three') er = 11.8
  return {
    ...t,
    color: a.color,
    shade: mixHex(a.color, FACE_INK, 0.24),
    deep: mixHex(a.color, FACE_INK, 0.62),
    blob: a.blob,
    eyes: a.eyes,
    mouth: a.mouth,
    brows: a.eyes === 'three' ? null : a.brows,
    blush: a.blush,
    freckles: a.freckles,
    antenna: a.top === 'antenna',
    sprout: a.top === 'sprout',
    tooth: t.tooth && (a.mouth === 'grin' || a.mouth === 'bigD' || a.mouth === 'smirk'),
    derp: t.derp && (a.eyes === 'pair' || a.eyes === 'mismatch' || a.eyes === 'wide'),
    er,
  }
}

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function randomAvatar(): AvatarConfig {
  const eyes = pick(EYE_KINDS)
  return {
    v: 1,
    color: pick(FACE_PALETTE),
    blob: pick(BLOB_KINDS),
    eyes,
    mouth: pick(MOUTH_KINDS),
    brows: eyes === 'three' || Math.random() < 0.6 ? null : pick(BROW_KINDS.slice(1)),
    blush: Math.random() < 0.5,
    freckles: Math.random() < 0.25,
    top: Math.random() < 0.7 ? 'none' : pick(['antenna', 'sprout'] as const),
  }
}
