import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { BLOBS, FACE_INK, TONGUE, applyAvatar, faceTraits, type AvatarConfig, type FaceTraits, type MouthKind } from './face'
import { useAvatarFor, useHornsFor } from './avatars'

export type FaceMood = 'neutral' | 'happy' | 'shocked' | 'sleepy' | 'talking' | 'wink'
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
  className?: string
  style?: CSSProperties
}

const W = '#FFFFFF'

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
  if (kind === 'beady') {
    const pr = r * 0.46
    return (
      <g>
        <circle cx={x + lx * r * 0.18} cy={ly * r * 0.18} r={pr} fill={FACE_INK} />
        <circle cx={x + lx * r * 0.18 - pr * 0.35} cy={ly * r * 0.18 - pr * 0.35} r={pr * 0.32} fill={W} />
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
    case 'flat':
    default:
      return <path transform={`scale(${scale})`} d="M-7.5 2 H7.5" fill="none" {...common} />
  }
}

function FaceSvg({ t, look, mood, blink, horns }: { t: FaceTraits; look: Look; mood: FaceMood; blink: boolean; horns?: boolean }) {
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
  if (mood === 'sleepy') eyes = 'closed'
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

  const brows = t.brows && eyes !== 'closed' && (
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
  )

  const top = geo.top
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ overflow: 'visible' }}>
      <g transform={`rotate(${t.blobRot} 50 55)`}>
        {horns && (
          <g fill="#E5383B" stroke={FACE_INK} strokeWidth={2.6} strokeLinejoin="round">
            <path d={`M${top[0] - 24} ${top[1] + 12} Q${top[0] - 34} ${top[1] - 6} ${top[0] - 26} ${top[1] - 16} Q${top[0] - 22} ${top[1] - 2} ${top[0] - 10} ${top[1] + 6} Z`} />
            <path d={`M${top[0] + 24} ${top[1] + 12} Q${top[0] + 34} ${top[1] - 6} ${top[0] + 26} ${top[1] - 16} Q${top[0] + 22} ${top[1] - 2} ${top[0] + 10} ${top[1] + 6} Z`} />
          </g>
        )}
        {t.antenna && (
          <g>
            <path d={`M${top[0]} ${top[1] + 4} Q${top[0] + 4} ${top[1] - 6} ${top[0] + 1} ${top[1] - 11}`} stroke={FACE_INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <circle cx={top[0] + 1} cy={top[1] - 13} r={4.4} fill={t.accent} stroke={FACE_INK} strokeWidth={2.2} />
          </g>
        )}
        {t.sprout && (
          <g>
            <path d={`M${top[0]} ${top[1] + 4} V${top[1] - 7}`} stroke={FACE_INK} strokeWidth={2.4} strokeLinecap="round" />
            <path d={`M${top[0]} ${top[1] - 6} q-9 -2 -11 -10 q9 -1 11 10 Z`} fill="#7BD66B" stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
            <path d={`M${top[0]} ${top[1] - 4} q8 -1 10 -8 q-8 -1 -10 8 Z`} fill="#9BE37E" stroke={FACE_INK} strokeWidth={2} strokeLinejoin="round" />
          </g>
        )}
        <path d={geo.d} fill={t.color} stroke={FACE_INK} strokeWidth={3} strokeLinejoin="round" />
        {t.spots && (
          <g fill={t.shade} opacity={0.35}>
            <circle cx={30} cy={34} r={3.2} />
            <circle cx={72} cy={70} r={4} />
            <circle cx={68} cy={32} r={2.2} />
          </g>
        )}
      </g>
      <g transform={`translate(${geo.cx + t.ox} ${geo.cy + t.oy}) rotate(${t.featureRot}) scale(${geo.s})`}>
        {t.blush && (
          <g fill="#FF6F91" opacity={0.42}>
            <ellipse cx={-dx - 5} cy={7} rx={6} ry={3.6} />
            <ellipse cx={dx + 5} cy={7} rx={6} ry={3.6} />
          </g>
        )}
        {t.freckles && (
          <g fill={t.deep} opacity={0.55}>
            <circle cx={-dx - 6} cy={5} r={1.1} />
            <circle cx={-dx - 2} cy={7.5} r={1.1} />
            <circle cx={-dx - 7} cy={9} r={1.1} />
            <circle cx={dx + 6} cy={5} r={1.1} />
            <circle cx={dx + 2} cy={7.5} r={1.1} />
            <circle cx={dx + 7} cy={9} r={1.1} />
          </g>
        )}
        {eyeRow}
        {brows}
        <g transform="translate(0 12)" className={mood === 'talking' ? 'gf-talk' : undefined}>
          <Mouth kind={mouth} t={t} scale={mood === 'shocked' ? 1.25 : 1} />
        </g>
      </g>
    </svg>
  )
}

const ZERO: Look = { x: 0, y: 0 }

function GoofyFaceImpl({ name, avatar, horns, size = 40, look, mood = 'neutral', presence = null, blink = true, className, style }: Props) {
  const custom = useAvatarFor(avatar === undefined ? name : null)
  const hornsReg = useHornsFor(name)
  const showHorns = horns ?? hornsReg
  const t = applyAvatar(faceTraits(name), avatar !== undefined ? avatar : custom)
  const reduce = usePrefersReducedMotion()
  const effMood = mood === 'wink' ? 'neutral' : mood
  const traits = mood === 'wink' ? { ...t, eyes: 'wink' as never } : t
  return (
    <span className={'gf ' + (className ?? '')} style={{ width: size, height: size, ...style }}>
      <FaceSvg t={traits} look={look ?? ZERO} mood={effMood} blink={blink && !reduce && size >= 28} horns={showHorns} />
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
