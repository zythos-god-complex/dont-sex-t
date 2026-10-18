import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { isPhoto } from './photoUrl'
import { BLOBS, FACE_INK, TONGUE, applyAvatar, faceTraits, mixHex, type AvatarConfig, type FaceTraits, type MouthKind } from './face'
import { useAvatarFor, useHornsFor } from './avatars'
import { useFlairFor } from './flair'
import type { HatId } from '../lib/types'

export type FaceMood = 'neutral' | 'happy' | 'shocked' | 'sleepy' | 'talking' | 'wink' | 'kiss' | 'angry' | 'disgust' | 'smug' | 'flirty'
export type Look = { x: number; y: number }

type Props = {
  name: string | null | undefined
  /** explicit face (onboarding builder); undefined = look up this user's custom face */
  avatar?: AvatarConfig | null
  size?: number
  look?: Look | null
  mood?: FaceMood
  presence?: 'online' | 'away' | null
  blink?: boolean
  /** devil horns (nsfw); undefined = look up the user's setting */
  horns?: boolean
  /** perk hat; undefined = look up the user's flair */
  hat?: HatId | null
  className?: string
  style?: CSSProperties
}

const W = '#FFFFFF'

const heartPath = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + s * 0.9} C${cx - s * 1.25} ${cy + s * 0.05} ${cx - s * 1.05} ${cy - s * 1} ${cx} ${cy - s * 0.38} C${cx + s * 1.05} ${cy - s * 1} ${cx + s * 1.25} ${cy + s * 0.05} ${cx} ${cy + s * 0.9} Z`
const starPath = (cx: number, cy: number, ro: number, ri: number) => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? ri : ro
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2)
  }
  return d + 'Z'
}

function Eye({ x, r, t, look, kind, side }: { x: number; r: number; t: FaceTraits; look: Look; kind: string; side: number }) {
  const lx = Math.max(-1, Math.min(1, look.x))
  const ly = Math.max(-1, Math.min(1, look.y))
  if (kind === 'closed') {
    return <path d={`M${x - r * 0.8} 0 Q${x} ${r * 0.7} ${x + r * 0.8} 0`} stroke={FACE_INK} strokeWidth={3} fill="none" strokeLinecap="round" />
  }
  if (kind === 'squint') {
    const s = side
    return <path d={`M${x - r * 0.7 * s} ${-r * 0.55} L${x + r * 0.6 * s} 0 L${x - r * 0.7 * s} ${r * 0.55}`} stroke={FACE_INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
  // calmer, less emoji-like eyes
  if (kind === 'calm') {
    const pr = r * 0.4
    return (
      <g>
        <circle cx={x + lx * r * 0.12} cy={ly * r * 0.12} r={pr} fill={FACE_INK} />
        <circle cx={x + lx * r * 0.12 - pr * 0.3} cy={ly * r * 0.12 - pr * 0.32} r={pr * 0.28} fill={W} />
      </g>
    )
  }
  if (kind === 'soft') {
    return <path d={`M${x - r * 0.8} ${r * 0.2} Q${x} ${-r * 0.75} ${x + r * 0.8} ${r * 0.2}`} stroke={FACE_INK} strokeWidth={3} fill="none" strokeLinecap="round" />
  }
  if (kind === 'almond') {
    const ir = r * 0.48
    return (
      <g>
        <path d={`M${x - r * 1.15} 0 Q${x} ${-r * 1.05} ${x + r * 1.15} 0 Q${x} ${r * 0.85} ${x - r * 1.15} 0 Z`} fill={W} stroke={FACE_INK} strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={x + lx * r * 0.3} cy={ly * r * 0.12} r={ir} fill={FACE_INK} />
        <circle cx={x + lx * r * 0.3 - ir * 0.35} cy={ly * r * 0.12 - ir * 0.35} r={ir * 0.3} fill={W} />
      </g>
    )
  }
  if (kind === 'shine') {
    const ir = r * 0.76
    const cx = x + lx * r * 0.12
    const cy = ly * r * 0.1
    return (
      <g>
        <circle cx={x} cy={0} r={r} fill={W} stroke={FACE_INK} strokeWidth={2.2} />
        <circle cx={cx} cy={cy} r={ir} fill={FACE_INK} />
        <circle cx={cx - ir * 0.36} cy={cy - ir * 0.38} r={ir * 0.32} fill={W} />
        <circle cx={cx + ir * 0.34} cy={cy + ir * 0.36} r={ir * 0.14} fill={W} />
      </g>
    )
  }
  if (kind === 'lashes') {
    const s = side || 1
    const pr = r * 0.5
    return (
      <g>
        <circle cx={x} cy={0} r={r} fill={W} stroke={FACE_INK} strokeWidth={2.2} />
        <circle cx={x + lx * (r - pr - 1.4)} cy={ly * (r - pr - 1.4)} r={pr} fill={FACE_INK} />
        <circle cx={x + lx * (r - pr - 1.4) - pr * 0.38} cy={ly * (r - pr - 1.4) - pr * 0.38} r={pr * 0.3} fill={W} />
        <path d={`M${x + s * r * 0.35} ${-r * 0.92} l${s * 2.2} -3.6 M${x + s * r * 0.72} ${-r * 0.66} l${s * 3.2} -2.8 M${x + s * r * 0.95} ${-r * 0.28} l${s * 3.6} -1.2`} stroke={FACE_INK} strokeWidth={2} strokeLinecap="round" />
      </g>
    )
  }
  if (kind === 'hearts') {
    const s = r * 1.05
    const cx = x + lx * r * 0.08
    const cy = ly * r * 0.08
    return (
      <g>
        <path d={heartPath(cx, cy, s)} fill="#FF4D6D" stroke={FACE_INK} strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={cx - s * 0.42} cy={cy - s * 0.2} r={s * 0.17} fill={W} />
      </g>
    )
  }
  if (kind === 'stars') {
    const cx = x + lx * r * 0.08
    const cy = ly * r * 0.08
    return (
      <g>
        <path d={starPath(cx, cy, r * 1.2, r * 0.55)} fill="#FFD84D" stroke={FACE_INK} strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.16} fill={W} />
      </g>
    )
  }
  if (kind === 'dizzy') {
    const s = (side || 1) * (r / 9)
    return (
      <g>
        <circle cx={x} cy={0} r={r} fill={W} stroke={FACE_INK} strokeWidth={2.2} />
        <path
          d={`M${x} 0 a${1.5 * Math.abs(s)} ${1.5 * Math.abs(s)} 0 0 1 ${3 * s} 0 a${3 * Math.abs(s)} ${3 * Math.abs(s)} 0 0 1 ${-6 * s} 0 a${4.6 * Math.abs(s)} ${4.6 * Math.abs(s)} 0 0 1 ${9.2 * s} 0 a${6 * Math.abs(s)} ${6 * Math.abs(s)} 0 0 1 ${-12 * s} 0`}
          stroke={FACE_INK}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    )
  }
  if (kind === 'dead') {
    const k = r * 0.62
    return <path d={`M${x - k} ${-k} L${x + k} ${k} M${x + k} ${-k} L${x - k} ${k}`} stroke={FACE_INK} strokeWidth={3.2} strokeLinecap="round" />
  }
  if (kind === 'beady') {
    const pr = r * 0.46
    return (
      <g>
        <circle cx={x + lx * r * 0.18} cy={ly * r * 0.18} r={pr} fill={FACE_INK} />
        <circle cx={x + lx * r * 0.18 - pr * 0.35} cy={ly * r * 0.18 - pr * 0.35} r={pr * 0.32} fill={W} />
      </g>
    )
  }
  if (kind === 'lidded') {
    // half-moon eye under a heavy flat lid
    const y0 = -r * 0.12
    return (
      <g>
        <path d={`M${x - r} ${y0} A ${r} ${r} 0 0 0 ${x + r} ${y0} Z`} fill={W} stroke={FACE_INK} strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={x + lx * r * 0.28} cy={y0 + r * 0.4} r={r * 0.42} fill={FACE_INK} />
        <circle cx={x + lx * r * 0.28 - r * 0.14} cy={y0 + r * 0.28} r={r * 0.12} fill={W} />
        <path d={`M${x - r - 1.8} ${y0} H${x + r + 1.8}`} stroke={FACE_INK} strokeWidth={3.2} strokeLinecap="round" />
      </g>
    )
  }
  if (kind === 'angry') {
    const s = side || 1
    const inner = x - s * r * 1.1
    const outer = x + s * r * 1.1
    const pr = r * 0.46
    const px = x - s * r * 0.16
    return (
      <g>
        <circle cx={x} cy={0} r={r} fill={W} stroke={FACE_INK} strokeWidth={2.2} />
        <circle cx={px} cy={r * 0.22} r={pr} fill={FACE_INK} />
        <circle cx={px - pr * 0.35} cy={r * 0.22 - pr * 0.35} r={pr * 0.3} fill={W} />
        <path d={`M${outer} ${-r - 2} L${inner} ${-r - 2} L${inner} ${r * 0.12} L${outer} ${-r * 0.5} Z`} fill={t.color} />
        <path d={`M${inner} ${r * 0.12} L${outer} ${-r * 0.5}`} stroke={FACE_INK} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    )
  }
  const pupil = kind === 'wide' ? r * 0.32 : r * 0.5
  const travel = r - pupil - 1.4
  const px = x + lx * travel
  const py = ly * travel
  return (
    <g>
      <circle cx={x} cy={0} r={r} fill={W} stroke={FACE_INK} strokeWidth={2.2} />
      <circle cx={px} cy={py} r={pupil} fill={FACE_INK} />
      <circle cx={px - pupil * 0.38} cy={py - pupil * 0.38} r={pupil * 0.3} fill={W} />
      {kind === 'sleepy' && (
        <path d={`M${x - r - 1} ${-r - 1} H${x + r + 1} V${-r * 0.05} Q${x} ${r * 0.28} ${x - r - 1} ${-r * 0.05} Z`} fill={t.color} stroke={FACE_INK} strokeWidth={2.2} strokeLinejoin="round" />
      )}
    </g>
  )
}

function Mouth({ kind, t, scale = 1 }: { kind: MouthKind; t: FaceTraits; scale?: number }) {
  const m = t.mirror ? -1 : 1
  const sw = 3
  const common = { stroke: FACE_INK, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'grin':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M-10.5 0 Q0 10 10.5 0" fill="none" {...common} />
          {t.tooth && <rect x={-2.6} y={3.6} width={5.2} height={4.4} rx={1} fill={W} stroke={FACE_INK} strokeWidth={1.6} />}
        </g>
      )
    case 'o':
      return (
        <g transform={`scale(${scale})`}>
          <ellipse cx={0} cy={3} rx={4.6} ry={5.6} fill={FACE_INK} />
          <ellipse cx={0} cy={6} rx={2.8} ry={2} fill={TONGUE} />
        </g>
      )
    case 'wavy':
      return <path transform={`scale(${scale})`} d="M-11 2 q2.75 -4 5.5 0 t5.5 0 t5.5 0 t5.5 0" fill="none" {...common} />
    case 'tongue':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M-3.4 4.5 v4 a3.4 3.4 0 0 0 6.8 0 v-4" fill={TONGUE} stroke={FACE_INK} strokeWidth={2} />
          <path d="M-10 0 Q0 8.5 10 0" fill="none" {...common} />
        </g>
      )
    case 'teeth':
      return (
        <g transform={`scale(${scale})`}>
          <rect x={-10} y={-1} width={20} height={9} rx={4.2} fill={W} stroke={FACE_INK} strokeWidth={2.4} />
          <path d="M-10 3.6 H10 M-3.4 -1 V8 M3.4 -1 V8" stroke={FACE_INK} strokeWidth={1.4} />
        </g>
      )
    case 'smirk':
      return (
        <g transform={`scale(${scale * m} ${scale})`}>
          <path d="M-9 2.5 Q2 6.5 10 -2.5" fill="none" {...common} />
          {t.tooth && <rect x={0.5} y={3} width={4.6} height={4} rx={1} fill={W} stroke={FACE_INK} strokeWidth={1.5} />}
        </g>
      )
    case 'bigD':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M-11.5 -1.5 H11.5 Q11.5 13 0 13 Q-11.5 13 -11.5 -1.5 Z" fill={FACE_INK} stroke={FACE_INK} strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M-6 9.6 Q0 5.4 6 9.6 Q3.4 12.6 0 12.6 Q-3.4 12.6 -6 9.6 Z" fill={TONGUE} />
          {t.tooth && <rect x={-3} y={-1.5} width={6} height={3.8} rx={0.8} fill={W} />}
        </g>
      )
    case 'pucker' as MouthKind:
      // kissy lips pushed out past the cheek toward the partner (mirrored faces point the other way)
      return (
        <g transform={`translate(40 -4) scale(${scale * 1.15})`}>
          <path d="M-1 -4.5 C3 -6.5 6 -3 4.2 -0.6 C6.4 1.6 4 5.8 -0.6 4.2 C-2.2 3.2 -1.4 1.2 0.2 0 C-1.6 -1.2 -2.6 -3.4 -1 -4.5 Z" fill="#FF6F91" stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
        </g>
      )
    case 'bleh' as MouthKind:
      return (
        <g transform={`scale(${scale * m} ${scale})`}>
          <path d="M1.5 3.2 v5.4 a3.6 3.6 0 0 0 7.2 0 v-4.6" fill={TONGUE} stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M-10 4 q2.5 -4.5 5 -1 t5 -1 t5 1 t5 -1" fill="none" {...common} />
        </g>
      )
    case 'fangs':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M-10.5 0 Q0 10 10.5 0" fill="none" {...common} />
          <path d="M-6.6 3.1 L-4.9 8.4 L-3 4.3 Z M6.6 3.1 L4.9 8.4 L3 4.3 Z" fill={W} stroke={FACE_INK} strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      )
    case 'cat':
      return <path transform={`scale(${scale})`} d="M-9 1 Q-4.6 7.6 0 1.6 Q4.6 7.6 9 1" fill="none" {...common} />
    case 'mustache':
      return (
        <g transform={`scale(${scale})`}>
          <path d="M-4.4 6 Q0 8.6 4.4 6" fill="none" {...common} strokeWidth={2.6} />
          <path
            d="M0 -1.6 C-2.6 -5.2 -7.6 -5.4 -10.6 -2.4 C-12.4 -0.6 -13.6 1.6 -16 0.8 C-14.4 4.8 -8.2 5 -4.4 1.8 C-2.4 0.4 -1 0 0 0 C1 0 2.4 0.4 4.4 1.8 C8.2 5 14.4 4.8 16 0.8 C13.6 1.6 12.4 -0.6 10.6 -2.4 C7.6 -5.4 2.6 -5.2 0 -1.6 Z"
            fill="#4A2E1E"
            stroke={FACE_INK}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </g>
      )
    case 'braces':
      return (
        <g transform={`scale(${scale})`}>
          <rect x={-10} y={-1} width={20} height={9} rx={4.2} fill={W} stroke={FACE_INK} strokeWidth={2.4} />
          <path d="M-9 3.6 H9" stroke="#8F99A6" strokeWidth={1.8} />
          {[-6, -2, 2, 6].map((bx) => (
            <rect key={bx} x={bx - 1.3} y={2.3} width={2.6} height={2.6} rx={0.5} fill="#C9D0D8" stroke={FACE_INK} strokeWidth={0.8} />
          ))}
        </g>
      )
    case 'flat':
    default:
      return <path transform={`scale(${scale})`} d="M-7.5 2 H7.5" fill="none" {...common} />
  }
}

/** Perk hats, drawn in the face's ink style and anchored on the top of the blob. */
function Hat({ kind, x, y }: { kind: HatId; x: number; y: number }) {
  const ink = { stroke: FACE_INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (kind) {
    case 'crown':
      return (
        <g transform={`rotate(-8 ${x} ${y})`}>
          <path d={`M${x - 17} ${y + 5} L${x - 19} ${y - 13} L${x - 9} ${y - 4} L${x} ${y - 18} L${x + 9} ${y - 4} L${x + 19} ${y - 13} L${x + 17} ${y + 5} Z`} fill="#FFC83D" {...ink} />
          <path d={`M${x - 17.6} ${y - 0.6} H${x + 17.6}`} fill="none" {...ink} strokeWidth={1.8} />
          <circle cx={x} cy={y + 2.3} r={2.1} fill="#FF5C7A" {...ink} strokeWidth={1.4} />
          <circle cx={x - 10} cy={y + 2.4} r={1.5} fill="#5BC0FF" {...ink} strokeWidth={1.2} />
          <circle cx={x + 10} cy={y + 2.4} r={1.5} fill="#5BC0FF" {...ink} strokeWidth={1.2} />
          <circle cx={x - 19} cy={y - 13} r={2.2} fill="#FFE27A" {...ink} strokeWidth={1.6} />
          <circle cx={x} cy={y - 18.5} r={2.4} fill="#FFE27A" {...ink} strokeWidth={1.6} />
          <circle cx={x + 19} cy={y - 13} r={2.2} fill="#FFE27A" {...ink} strokeWidth={1.6} />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d={`M${x - 19} ${y + 6} C${x - 19} ${y - 10} ${x - 10} ${y - 15} ${x} ${y - 15} C${x + 10} ${y - 15} ${x + 19} ${y - 10} ${x + 19} ${y + 6} Z`} fill="#FF5C7A" {...ink} />
          <path d={`M${x} ${y - 15} V${y + 5}`} fill="none" {...ink} strokeWidth={1.4} />
          <path d={`M${x + 6} ${y + 5} C${x + 18} ${y + 1} ${x + 30} ${y + 2} ${x + 33} ${y + 7} C${x + 24} ${y + 10} ${x + 14} ${y + 10} ${x + 6} ${y + 8} Z`} fill="#D93A5A" {...ink} />
          <circle cx={x} cy={y - 15} r={2.2} fill="#D93A5A" {...ink} strokeWidth={1.4} />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d={`M${x - 19} ${y + 3} C${x - 19} ${y - 15} ${x + 19} ${y - 15} ${x + 19} ${y + 3} Z`} fill="#5BC0FF" {...ink} />
          <rect x={x - 21} y={y} width={42} height={8} rx={4} fill="#3A8FD0" {...ink} />
          {[-12, -4, 4, 12].map((d) => (
            <path key={d} d={`M${x + d} ${y + 1.6} V${y + 6.4}`} stroke={FACE_INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
          ))}
          <circle cx={x} cy={y - 14} r={4.6} fill="#F4F1EA" {...ink} />
        </g>
      )
    case 'halo':
      return (
        <g>
          <ellipse cx={x} cy={y - 9} rx={15} ry={4.6} fill="none" stroke={FACE_INK} strokeWidth={6} />
          <ellipse cx={x} cy={y - 9} rx={15} ry={4.6} fill="none" stroke="#FFD84D" strokeWidth={3.2} />
        </g>
      )
    case 'bow': {
      const cx = x + 12
      const cy = y + 2
      return (
        <g transform={`rotate(14 ${cx} ${cy})`}>
          <path d={`M${cx} ${cy} C${cx - 4} ${cy - 10} ${cx - 15} ${cy - 8} ${cx - 13} ${cy + 1} C${cx - 12} ${cy + 8} ${cx - 4} ${cy + 5} ${cx} ${cy} Z`} fill="#FF8FC7" {...ink} />
          <path d={`M${cx} ${cy} C${cx + 4} ${cy - 10} ${cx + 15} ${cy - 8} ${cx + 13} ${cy + 1} C${cx + 12} ${cy + 8} ${cx + 4} ${cy + 5} ${cx} ${cy} Z`} fill="#FF8FC7" {...ink} />
          <circle cx={cx} cy={cy} r={3.2} fill="#FF5CA8" {...ink} strokeWidth={1.8} />
        </g>
      )
    }
    case 'tophat':
      return (
        <g transform={`rotate(-10 ${x} ${y})`}>
          <path d={`M${x - 12} ${y + 3} V${y - 19} C${x - 12} ${y - 23} ${x + 12} ${y - 23} ${x + 12} ${y - 19} V${y + 3} Z`} fill="#2A2A35" {...ink} />
          <rect x={x - 12} y={y - 4} width={24} height={5} fill="#FF5C7A" stroke={FACE_INK} strokeWidth={1.6} />
          <ellipse cx={x} cy={y + 4} rx={20} ry={4.2} fill="#2A2A35" {...ink} />
        </g>
      )
    case 'party':
      return (
        <g transform={`rotate(12 ${x} ${y})`}>
          <path d={`M${x - 12} ${y + 4} L${x} ${y - 24} L${x + 12} ${y + 4} Z`} fill="#8A6BFF" {...ink} />
          <path d={`M${x - 8.6} ${y - 4} L${x + 4} ${y - 12} M${x - 4.6} ${y - 13.6} L${x + 2} ${y - 18}`} fill="none" stroke="#FFC83D" strokeWidth={2.6} strokeLinecap="round" />
          <path d={`M${x - 11} ${y + 1.4} L${x + 8.6} ${y - 4.4}`} fill="none" stroke="#3DD6B5" strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={x} cy={y - 25} r={3.8} fill="#FFC83D" {...ink} strokeWidth={1.8} />
        </g>
      )
    case 'cowboy':
      return (
        <g transform={`rotate(-6 ${x} ${y})`}>
          <path d={`M${x - 14} ${y + 3} C${x - 15} ${y - 10} ${x - 12} ${y - 18} ${x - 6} ${y - 17} C${x - 3} ${y - 16} ${x - 1} ${y - 13} ${x} ${y - 13} C${x + 1} ${y - 13} ${x + 3} ${y - 16} ${x + 6} ${y - 17} C${x + 12} ${y - 18} ${x + 15} ${y - 10} ${x + 14} ${y + 3} Z`} fill="#C07A3A" {...ink} />
          <path d={`M${x - 14.4} ${y - 2} C${x - 5} ${y} ${x + 5} ${y} ${x + 14.4} ${y - 2} L${x + 14.2} ${y + 2.4} C${x + 5} ${y + 4.4} ${x - 5} ${y + 4.4} ${x - 14.2} ${y + 2.4} Z`} fill="#5A3A1E" stroke={FACE_INK} strokeWidth={1.6} strokeLinejoin="round" />
          <path d={`M${x - 31} ${y + 2} C${x - 26} ${y + 11} ${x + 26} ${y + 11} ${x + 31} ${y + 2} C${x + 25} ${y - 2} ${x + 15} ${y + 3} ${x} ${y + 3} C${x - 15} ${y + 3} ${x - 25} ${y - 2} ${x - 31} ${y + 2} Z`} fill="#A8672F" {...ink} />
        </g>
      )
    case 'wizard':
      return (
        <g transform={`rotate(-8 ${x} ${y})`}>
          <path d={`M${x - 14} ${y + 3} C${x - 10} ${y - 10} ${x - 4} ${y - 24} ${x + 7} ${y - 33} C${x + 4} ${y - 26} ${x + 6} ${y - 14} ${x + 14} ${y + 3} Z`} fill="#4B5BD6" {...ink} />
          <path d={starPath(x - 3, y - 8, 3.2, 1.4)} fill="#FFD84D" stroke={FACE_INK} strokeWidth={1} strokeLinejoin="round" />
          <path d={starPath(x + 4.5, y - 19, 2.4, 1.1)} fill="#FFD84D" stroke={FACE_INK} strokeWidth={1} strokeLinejoin="round" />
          <circle cx={x + 6} cy={y - 4} r={1.3} fill="#FFD84D" />
          <ellipse cx={x} cy={y + 4} rx={21} ry={4.6} fill="#3D49B8" {...ink} />
        </g>
      )
    case 'headphones':
      return (
        <g>
          <path d={`M${x - 25} ${y + 15} C${x - 26} ${y - 12} ${x + 26} ${y - 12} ${x + 25} ${y + 15}`} fill="none" stroke={FACE_INK} strokeWidth={7.4} strokeLinecap="round" />
          <path d={`M${x - 25} ${y + 15} C${x - 26} ${y - 12} ${x + 26} ${y - 12} ${x + 25} ${y + 15}`} fill="none" stroke="#FF5C7A" strokeWidth={3.6} strokeLinecap="round" />
          <rect x={x - 31} y={y + 9} width={11} height={18} rx={5} fill="#2A2A35" {...ink} />
          <rect x={x + 20} y={y + 9} width={11} height={18} rx={5} fill="#2A2A35" {...ink} />
          <rect x={x - 22.6} y={y + 11.5} width={3.6} height={13} rx={1.8} fill="#FF5C7A" />
          <rect x={x + 19} y={y + 11.5} width={3.6} height={13} rx={1.8} fill="#FF5C7A" />
        </g>
      )
    case 'flowercrown': {
      const spots: [number, number, string][] = [[-18, 6, '#FF8FC7'], [-9, 0.5, '#FFD84D'], [0, -1.5, '#FFFFFF'], [9, 0.5, '#C69CFF'], [18, 6, '#FF8FC7']]
      return (
        <g>
          <path d={`M${x - 22} ${y + 9} Q${x} ${y - 6} ${x + 22} ${y + 9}`} fill="none" stroke="#4E9A3A" strokeWidth={2.4} strokeLinecap="round" />
          {[[-13, 4, -30], [5, 0, 20], [13, 4, 40]].map(([dx, dy, rot], i) => (
            <ellipse key={'l' + i} cx={x + dx} cy={y + dy - 2} rx={3.4} ry={1.8} fill="#7BD66B" stroke={FACE_INK} strokeWidth={1.1} transform={`rotate(${rot} ${x + dx} ${y + dy - 2})`} />
          ))}
          {spots.map(([dx, dy, c], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={x + dx + Math.cos((a * Math.PI) / 180) * 2.9} cy={y + dy + Math.sin((a * Math.PI) / 180) * 2.9} r={2.4} fill={c} stroke={FACE_INK} strokeWidth={1.1} />
              ))}
              <circle cx={x + dx} cy={y + dy} r={1.7} fill={c === '#FFD84D' ? '#FF8A3D' : '#FFD84D'} stroke={FACE_INK} strokeWidth={0.9} />
            </g>
          ))}
        </g>
      )
    }
    case 'chef':
      return (
        <g transform={`rotate(6 ${x} ${y})`}>
          <path d={`M${x - 14} ${y - 2} C${x - 23} ${y - 6} ${x - 21} ${y - 21} ${x - 10} ${y - 19} C${x - 8} ${y - 28} ${x + 8} ${y - 28} ${x + 10} ${y - 19} C${x + 21} ${y - 21} ${x + 23} ${y - 6} ${x + 14} ${y - 2} Z`} fill="#FFFFFF" {...ink} />
          <path d={`M${x - 6} ${y - 4} Q${x - 7} ${y - 12} ${x - 5} ${y - 17} M${x + 6} ${y - 4} Q${x + 7} ${y - 12} ${x + 5} ${y - 17}`} fill="none" stroke={FACE_INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.35} />
          <rect x={x - 14.5} y={y - 4} width={29} height={9} rx={2.5} fill="#F2EFE7" {...ink} />
        </g>
      )
    case 'ghost':
      return (
        <g transform={`rotate(8 ${x} ${y})`}>
          <path d={`M${x - 11} ${y + 4} V${y - 10} C${x - 11} ${y - 26} ${x + 11} ${y - 26} ${x + 11} ${y - 10} V${y + 4} L${x + 7} ${y + 1} L${x + 3.5} ${y + 4} L${x} ${y + 1} L${x - 3.5} ${y + 4} L${x - 7} ${y + 1} Z`} fill="#F7F5FF" {...ink} />
          <ellipse cx={x - 4} cy={y - 12} rx={1.8} ry={2.6} fill={FACE_INK} />
          <ellipse cx={x + 4} cy={y - 12} rx={1.8} ry={2.6} fill={FACE_INK} />
          <ellipse cx={x} cy={y - 5} rx={2.2} ry={2.8} fill={FACE_INK} />
        </g>
      )
    default:
      return null
  }
}

/** shop tops, drawn behind the blob so their roots tuck under it */
function Top({ t, geo }: { t: FaceTraits; geo: (typeof BLOBS)[keyof typeof BLOBS] }) {
  const [tx, ty] = geo.top
  const [ex, ey] = geo.ear ?? [13, ty + 9]
  const ink = { stroke: FACE_INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const }
  const inner = mixHex(t.color, '#FF6F91', 0.55)
  switch (t.top) {
    case 'cat':
      return (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <path d={`M${tx + s * (ex - 9)} ${ey + 3} L${tx + s * (ex + 4)} ${ey - 21} L${tx + s * (ex + 11)} ${ey + 5} Z`} fill={t.color} {...ink} />
              <path d={`M${tx + s * (ex - 3)} ${ey} L${tx + s * (ex + 4)} ${ey - 13} L${tx + s * (ex + 7.5)} ${ey + 1} Z`} fill={inner} />
            </g>
          ))}
        </g>
      )
    case 'bunny':
      return (
        <g>
          {[-1, 1].map((s) => (
            <g key={s} transform={`rotate(${s * 14} ${tx + s * ex} ${ey})`}>
              <ellipse cx={tx + s * ex} cy={ey - 17} rx={6.6} ry={19} fill={t.color} {...ink} />
              <ellipse cx={tx + s * ex} cy={ey - 15} rx={3} ry={12.5} fill={inner} />
            </g>
          ))}
        </g>
      )
    case 'flower': {
      const fx = tx + 3
      const fy = ty - 16
      return (
        <g>
          <path d={`M${tx} ${ty + 5} Q${tx + 2} ${ty - 4} ${fx} ${fy}`} stroke={FACE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d={`M${tx + 1} ${ty - 3} q-8 -1 -9 -7 q7 -1 9 7 Z`} fill="#7BD66B" stroke={FACE_INK} strokeWidth={1.8} strokeLinejoin="round" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={fx + Math.cos(((a - 90) * Math.PI) / 180) * 6.4} cy={fy + Math.sin(((a - 90) * Math.PI) / 180) * 6.4} r={5.3} fill="#FFFFFF" stroke={FACE_INK} strokeWidth={2} />
          ))}
          <circle cx={fx} cy={fy} r={4.2} fill="#FFC83D" stroke={FACE_INK} strokeWidth={2} />
        </g>
      )
    }
    case 'unicorn':
      return (
        <g transform={`rotate(8 ${tx} ${ty})`}>
          <path d={`M${tx - 9} ${ty + 8} L${tx + 1} ${ty - 30} L${tx + 9} ${ty + 8} Z`} fill="#FFE27A" {...ink} />
          <path d={`M${tx - 7.4} ${ty + 1} L${tx + 7.6} ${ty - 3.6} M${tx - 5.2} ${ty - 7.4} L${tx + 5.4} ${ty - 11} M${tx - 3} ${ty - 15.6} L${tx + 3.4} ${ty - 18.4} M${tx - 1} ${ty - 23} L${tx + 1.8} ${ty - 24.4}`} stroke="#FF6FB5" strokeWidth={2.2} strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

function FaceSvg({ t, look, mood, blink, horns, hat }: { t: FaceTraits; look: Look; mood: FaceMood; blink: boolean; horns?: boolean; hat?: HatId | null }) {
  const geo = BLOBS[t.blob]
  const dx = t.dx
  let eyes: string = t.eyes
  let mouth: MouthKind = t.mouth
  let r = t.er
  if (mood === 'happy') mouth = t.mouth === 'o' || t.mouth === 'flat' || t.mouth === 'wavy' ? 'bigD' : t.mouth === 'smirk' ? 'grin' : t.mouth
  if (mood === 'shocked') {
    mouth = 'o'
    if (eyes !== 'three') eyes = 'wide'
    r *= 1.08
  }
  if (mood === 'talking') mouth = 'o'
  if (mood === 'sleepy' || mood === 'kiss') eyes = 'closed'
  if (mood === 'kiss') mouth = 'pucker' as MouthKind
  if (mood === 'angry') {
    eyes = 'angry'
    mouth = 'teeth'
  }
  if (mood === 'disgust') {
    eyes = 'disgust'
    mouth = 'bleh' as MouthKind
  }
  if (mood === 'smug') {
    eyes = 'lidded'
    mouth = 'smirk'
  }
  if (mood === 'flirty') {
    eyes = 'flirty'
    mouth = 'smirk'
  }
  const derpL: Look = t.derp ? { x: look.x - 0.6, y: look.y + 0.2 } : look
  const derpR: Look = t.derp ? { x: look.x + 0.7, y: look.y - 0.3 } : look

  const eyeRow = (() => {
    const ey = -7
    const lids = blink && eyes !== 'closed' && eyes !== 'squint'
    const inner = (() => {
      switch (eyes) {
        case 'mismatch': {
          const big = t.mirror ? 1 : -1
          return (
            <>
              <Eye x={-dx} r={big < 0 ? r * 1.2 : r * 0.78} t={t} look={derpL} kind="pair" side={-1} />
              <Eye x={dx} r={big > 0 ? r * 1.2 : r * 0.78} t={t} look={derpR} kind="pair" side={1} />
            </>
          )
        }
        case 'squint':
          return (
            <>
              <Eye x={-dx} r={r} t={t} look={look} kind={t.mirror ? 'squint' : 'pair'} side={-1} />
              <Eye x={dx} r={r} t={t} look={look} kind={t.mirror ? 'pair' : 'squint'} side={1} />
            </>
          )
        case 'three':
          return (
            <>
              <Eye x={-dx * 1.15} r={r} t={t} look={look} kind="pair" side={-1} />
              <g transform="translate(0 -6)">
                <Eye x={0} r={r * 1.05} t={t} look={look} kind="pair" side={0} />
              </g>
              <Eye x={dx * 1.15} r={r} t={t} look={look} kind="pair" side={1} />
            </>
          )
        case 'disgust':
          // scrunched shut: > <
          return (
            <>
              <path d={`M${-dx - r * 0.75} ${-r * 0.6} L${-dx + r * 0.65} 0 L${-dx - r * 0.75} ${r * 0.6}`} stroke={FACE_INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d={`M${dx + r * 0.75} ${-r * 0.6} L${dx - r * 0.65} 0 L${dx + r * 0.75} ${r * 0.6}`} stroke={FACE_INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )
        case 'flirty':
          return (
            <>
              <Eye x={-dx} r={r} t={t} look={{ x: 0.5, y: 0 }} kind="lidded" side={-1} />
              <Eye x={dx} r={r} t={t} look={look} kind="closed" side={1} />
            </>
          )
        case 'angry':
          return (
            <>
              <Eye x={-dx} r={r} t={t} look={look} kind="angry" side={-1} />
              <Eye x={dx} r={r} t={t} look={look} kind="angry" side={1} />
            </>
          )
        case 'shades': {
          // never wider than the gap between the eyes allows, so the lenses don't melt into one
          const w = Math.min(r * 1.25, dx - 2.5)
          const h = r * 0.95
          const lens = (cx: number) => `M${cx - w} ${-h * 0.75} H${cx + w} Q${cx + w} ${h * 0.95} ${cx} ${h} Q${cx - w} ${h * 0.95} ${cx - w} ${-h * 0.75} Z`
          return (
            <>
              <path d={`M${-dx - w - 4} ${-h * 0.55} L${-dx - w} ${-h * 0.62} M${dx + w} ${-h * 0.62} L${dx + w + 4} ${-h * 0.55}`} stroke={FACE_INK} strokeWidth={2.4} strokeLinecap="round" />
              <path d={lens(-dx) + lens(dx)} fill="#1B1726" stroke={FACE_INK} strokeWidth={2.4} strokeLinejoin="round" />
              <path d={`M${-dx + w} ${-h * 0.62} Q0 ${-h * 1.05} ${dx - w} ${-h * 0.62}`} stroke={FACE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
              <path d={`M${-dx - w * 0.55} ${-h * 0.25} L${-dx - w * 0.05} ${-h * 0.62} M${dx - w * 0.55} ${-h * 0.25} L${dx - w * 0.05} ${-h * 0.62}`} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
            </>
          )
        }
        case 'nerd': {
          const g = Math.min(r * 1.18, dx - 2)
          return (
            <>
              <Eye x={-dx} r={r * 0.82} t={t} look={derpL} kind="beady" side={-1} />
              <Eye x={dx} r={r * 0.82} t={t} look={derpR} kind="beady" side={1} />
              <circle cx={-dx} cy={0} r={g} fill="rgba(255,255,255,.28)" stroke={FACE_INK} strokeWidth={2.6} />
              <circle cx={dx} cy={0} r={g} fill="rgba(255,255,255,.28)" stroke={FACE_INK} strokeWidth={2.6} />
              <path d={`M${-dx + g} -1 Q0 -5 ${dx - g} -1 M${-dx - g} -1 L${-dx - g - 4} -3 M${dx + g} -1 L${dx + g + 4} -3`} stroke={FACE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            </>
          )
        }
        case 'wink':
          return (
            <>
              <Eye x={-dx} r={r} t={t} look={look} kind="pair" side={-1} />
              <Eye x={dx} r={r} t={t} look={look} kind="closed" side={1} />
            </>
          )
        default:
          return (
            <>
              <Eye x={-dx} r={r} t={t} look={derpL} kind={eyes} side={-1} />
              <Eye x={dx} r={r} t={t} look={derpR} kind={eyes} side={1} />
            </>
          )
      }
    })()
    return (
      <g transform={`translate(0 ${ey})`}>
        <g
          className={lids ? 'gf-blink' : undefined}
          style={lids ? ({ '--blink': `${t.blinkMs}ms`, '--blink-delay': `${t.blinkDelayMs}ms` } as CSSProperties) : undefined}
        >
          {inner}
        </g>
      </g>
    )
  })()

  const moodBrows =
    mood === 'angry' ? (
      <g transform={`translate(0 ${-7 - r - 6})`} stroke={FACE_INK} strokeWidth={3.6} strokeLinecap="round" fill="none">
        <path d={`M${-dx - 8} -3 L${-dx + 6} 3`} />
        <path d={`M${dx - 6} 3 L${dx + 8} -3`} />
      </g>
    ) : mood === 'disgust' ? (
      <g transform={`translate(0 ${-7 - r - 4})`} stroke={FACE_INK} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d={`M${-dx - 7} -1 Q${-dx} 3 ${-dx + 6} 1`} />
        <path d={`M${dx - 6} 1 Q${dx} 3 ${dx + 7} -1`} />
      </g>
    ) : mood === 'smug' || mood === 'flirty' ? (
      <g transform={`translate(0 ${-7 - r - 5})`} stroke={FACE_INK} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d={`M${-dx - 6} 1 L${-dx + 6} 1`} />
        <path d={`M${dx - 7} 0 Q${dx} -8 ${dx + 7} -3`} />
      </g>
    ) : null
  const brows = moodBrows ?? (t.brows && eyes !== 'closed' && (
    <g transform={`translate(0 ${-7 - r - 5})`} stroke={FACE_INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
      {t.brows === 'raised' && (
        <>
          <path d={`M${-dx - 6} 1 Q${-dx} -3 ${-dx + 6} 0`} />
          <path d={`M${dx - 6} 0 Q${dx} -3 ${dx + 6} 1`} />
        </>
      )}
      {t.brows === 'worried' && (
        <>
          <path d={`M${-dx - 6} 1 L${-dx + 5} -3`} />
          <path d={`M${dx - 5} -3 L${dx + 6} 1`} />
        </>
      )}
      {t.brows === 'grumpy' && (
        <>
          <path d={`M${-dx - 6} -3 L${-dx + 5} 1`} />
          <path d={`M${dx - 5} 1 L${dx + 6} -3`} />
        </>
      )}
      {t.brows === 'uneven' && (
        <>
          <path d={`M${-dx - 6} -2 Q${-dx} -6 ${-dx + 6} -2`} />
          <path d={`M${dx - 6} 1 L${dx + 6} 1`} />
        </>
      )}
    </g>
  ))

  const top = geo.top
  // neo (admin only): plain black body with two evil green eyes, nothing else
  const neo = hat === 'neo'
  const hatOn = !!hat && hat !== 'none' && !neo
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ overflow: 'visible' }} className={neo ? 'gf-matrix' : undefined}>
      <g transform={`rotate(${t.blobRot} 50 55)`}>
        {horns && (
          <g fill="#E5383B" stroke={FACE_INK} strokeWidth={2.6} strokeLinejoin="round">
            <path d={`M${top[0] - 24} ${top[1] + 12} Q${top[0] - 34} ${top[1] - 6} ${top[0] - 26} ${top[1] - 16} Q${top[0] - 22} ${top[1] - 2} ${top[0] - 10} ${top[1] + 6} Z`} />
            <path d={`M${top[0] + 24} ${top[1] + 12} Q${top[0] + 34} ${top[1] - 6} ${top[0] + 26} ${top[1] - 16} Q${top[0] + 22} ${top[1] - 2} ${top[0] + 10} ${top[1] + 6} Z`} />
          </g>
        )}
        {!hatOn && !neo && <Top t={t} geo={geo} />}
        {t.top === 'antenna' && !hatOn && !neo && (
          <g>
            <path d={`M${top[0]} ${top[1] + 4} Q${top[0] + 4} ${top[1] - 6} ${top[0] + 1} ${top[1] - 11}`} stroke={FACE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <circle cx={top[0] + 1} cy={top[1] - 13} r={4.4} fill={t.accent} stroke={FACE_INK} strokeWidth={2.2} />
          </g>
        )}
        {t.top === 'sprout' && !hatOn && !neo && (
          <g>
            <path d={`M${top[0]} ${top[1] + 4} V${top[1] - 7}`} stroke={FACE_INK} strokeWidth={2.4} strokeLinecap="round" />
            <path d={`M${top[0]} ${top[1] - 6} q-9 -2 -11 -10 q9 -1 11 10 Z`} fill="#7BD66B" stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
            <path d={`M${top[0]} ${top[1] - 4} q8 -1 10 -8 q-8 -1 -10 8 Z`} fill="#9BE37E" stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
          </g>
        )}
        <path d={geo.d} fill={neo ? '#0A0A0B' : t.color} stroke={neo ? '#0A0A0B' : FACE_INK} strokeWidth={3} strokeLinejoin="round" />
        {t.spots && !neo && (
          <g fill={t.shade} opacity={0.35}>
            <circle cx={30} cy={34} r={3.2} />
            <circle cx={72} cy={70} r={4} />
            <circle cx={68} cy={32} r={2.2} />
          </g>
        )}
        {hatOn && <Hat kind={hat!} x={(geo.hat ?? top)[0]} y={(geo.hat ?? top)[1]} />}
      </g>
      <g transform={`translate(${geo.cx + t.ox} ${geo.cy + t.oy}) rotate(${t.featureRot}) scale(${geo.s})`} className={neo ? 'gf-feat' : undefined}>
        {t.blush && !neo && (
          <g fill="#FF6F91" opacity={0.42}>
            <ellipse cx={-dx - 5} cy={7} rx={6} ry={3.6} />
            <ellipse cx={dx + 5} cy={7} rx={6} ry={3.6} />
          </g>
        )}
        {t.freckles && !neo && (
          <g fill={t.deep} opacity={0.55}>
            <circle cx={-dx - 6} cy={5} r={1.1} />
            <circle cx={-dx - 2} cy={7.5} r={1.1} />
            <circle cx={-dx - 7} cy={9} r={1.1} />
            <circle cx={dx + 6} cy={5} r={1.1} />
            <circle cx={dx + 2} cy={7.5} r={1.1} />
            <circle cx={dx + 7} cy={9} r={1.1} />
          </g>
        )}
        {neo ? (
          <g>
            <path d={`M${-dx - 10} -12 L${-dx + 8} -6 Q${-dx + 2} -1 ${-dx - 8} -4 Z M${dx + 10} -12 L${dx - 8} -6 Q${dx - 2} -1 ${dx + 8} -4 Z`} fill="none" stroke="#39FF6A" strokeWidth={4.5} strokeLinejoin="round" opacity={0.3} />
            <path d={`M${-dx - 10} -12 L${-dx + 8} -6 Q${-dx + 2} -1 ${-dx - 8} -4 Z M${dx + 10} -12 L${dx - 8} -6 Q${dx - 2} -1 ${dx + 8} -4 Z`} fill="#39FF6A" />
            <path d={`M${-dx - 1} -9.5 V-3.5 M${dx + 1} -9.5 V-3.5`} stroke="#0A0A0B" strokeWidth={1.6} strokeLinecap="round" />
          </g>
        ) : (
          <>
            {eyeRow}
            {brows}
          </>
        )}
        <g transform="translate(0 12)" className={mood === 'talking' ? 'gf-talk' : undefined} display={neo ? 'none' : undefined}>
          <Mouth kind={mouth} t={t} scale={mood === 'shocked' ? 1.25 : 1} />
        </g>
      </g>
    </svg>
  )
}

const ZERO: Look = { x: 0, y: 0 }

function GoofyFaceImpl({ name, avatar, horns, hat, size = 40, look, mood = 'neutral', presence = null, blink = true, className, style }: Props) {
  const flair = useFlairFor(hat === undefined ? name : null)
  const custom = useAvatarFor(avatar === undefined ? name : null)
  const hornsReg = useHornsFor(name)
  const showHorns = horns ?? hornsReg
  const av = avatar !== undefined ? avatar : custom
  const t = applyAvatar(faceTraits(name), av)
  const flairHat = flair?.hat && flair.hat !== 'none' ? flair.hat : undefined
  const reduce = usePrefersReducedMotion()
  const effMood = mood === 'wink' ? 'neutral' : mood
  const traits = mood === 'wink' ? { ...t, eyes: 'wink' as never } : mood === 'kiss' || mood === 'flirty' ? { ...t, blush: true } : t
  return (
    <span className={'gf ' + (className ?? '')} style={{ width: size, height: size, ...style }}>
      {isPhoto(av?.photo) ? (
        <img className="gf-photo" src={av.photo} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <FaceSvg t={traits} look={look ?? ZERO} mood={effMood} blink={blink && !reduce && size >= 28} horns={showHorns} hat={hat === undefined ? (av?.ghost ? 'ghost' : flairHat) : hat} />
      )}
      {presence && <span className={'gf-dot ' + (presence === 'away' ? 'is-away' : 'is-online')} style={{ '--s': `${Math.max(9, Math.round(size * 0.26))}px` } as CSSProperties} />}
    </span>
  )
}

export const GoofyFace = memo(GoofyFaceImpl)

let mq: MediaQueryList | null = null
function usePrefersReducedMotion(): boolean {
  const [v, setV] = useState(() => {
    if (typeof window === 'undefined') return false
    mq ??= window.matchMedia('(prefers-reduced-motion: reduce)')
    return mq.matches
  })
  useEffect(() => {
    mq ??= window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setV(mq!.matches)
    mq.addEventListener('change', on)
    return () => mq!.removeEventListener('change', on)
  }, [])
  return v
}

/** Pupils follow the pointer (desktop). Returns a ref for the element and the current look vector. */
export function useLookAt<T extends HTMLElement>(enabled = true): [React.RefObject<T | null>, Look] {
  const ref = useRef<T | null>(null)
  const [look, setLook] = useState<Look>(ZERO)
  useEffect(() => {
    if (!enabled || window.matchMedia('(pointer: coarse)').matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = ref.current
        if (!el) return
        const b = el.getBoundingClientRect()
        const cx = b.left + b.width / 2
        const cy = b.top + b.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const d = Math.max(1, Math.hypot(dx, dy))
        const k = Math.min(1, d / 260)
        setLook({ x: (dx / d) * k, y: (dy / d) * k })
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [enabled])
  return [ref, look]
}
