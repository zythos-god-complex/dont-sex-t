import { memo, type CSSProperties, type ReactNode } from 'react'
import type { Ambient as AmbientKind } from './themes'
import { useAmbientPrefs } from './ambientPrefs'

const COUNT: Partial<Record<AmbientKind, number>> = {
  petals: 14, stars: 26, bubbles: 12, leaves: 9, hearts: 10, sparkles: 16,
  bats: 6, lovebeat: 13, party: 24, embers: 22,
}

// deterministic pseudo random so layout is stable across renders
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const BAT = (
  <svg viewBox="0 0 64 28" width="100%" height="100%">
    <g className="bat-w l">
      <path d="M30 12 C24 4 14 2 2 6 C7 8 9 11 8 15 C12 12 16 13 18 17 C21 13 26 13 30 16 Z" />
    </g>
    <g className="bat-w r">
      <path d="M34 12 C40 4 50 2 62 6 C57 8 55 11 56 15 C52 12 48 13 46 17 C43 13 38 13 34 16 Z" />
    </g>
    <path d="M29 9 L30 5 L31.5 8 L32.5 8 L34 5 L35 9 C36 13 35 18 32 22 C29 18 28 13 29 9 Z" />
  </svg>
)

const PARTY_EMOJI = ['🫶', '✌️', '💅', '🤪', '👯', '🥳']
const LUST_EMOJI = ['💋', '🔥', '💋']

/** Set pieces behind the particles: skyline + bat signal, heartbeat glow, smoke. */
function Decor({ kind }: { kind: AmbientKind }): ReactNode {
  if (kind === 'bats')
    return (
      <>
        <span className="bs-beam" />
        <span className="bs-signal">
          <span className="bs-bat">{BAT}</span>
        </span>
        <span className="bs-moon" />
        <span className="bs-city" />
        <span className="bs-city bs-city2" />
      </>
    )
  if (kind === 'lovebeat') return <span className="lv-glow" />
  if (kind === 'embers')
    return (
      <>
        <span className="em-smoke" />
        <span className="em-smoke s2" />
        <span className="em-smoke s3" />
      </>
    )
  return null
}

function AmbientImpl({ kind }: { kind: AmbientKind }) {
  const amount = useAmbientPrefs((p) => p.amount)
  const speed = useAmbientPrefs((p) => p.speed)
  if (kind === 'none') return null
  if (kind === 'aurora') return <div className="amb amb-aurora" aria-hidden="true"><i /><i /><i /></div>
  if (kind === 'scanlines') return <div className="amb amb-scan" aria-hidden="true" />
  if (kind === 'haze') return <div className="amb amb-haze" aria-hidden="true"><i /><i /></div>
  const n = Math.max(1, Math.min(80, Math.round((COUNT[kind] ?? 10) * amount)))
  // a few emoji riders on top of the confetti / embers
  const riders = kind === 'party' ? PARTY_EMOJI : kind === 'embers' ? LUST_EMOJI : null
  return (
    <div className={'amb amb-' + kind} aria-hidden="true" style={{ '--spd': speed } as CSSProperties}>
      <Decor kind={kind} />
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${Math.round(rnd(i, 1) * 100)}%`,
              '--y': `${Math.round(rnd(i, 5) * 100)}%`,
              '--d': `${(9 + rnd(i, 2) * 10).toFixed(1)}s`,
              '--delay': `${(-rnd(i, 3) * 18).toFixed(1)}s`,
              '--s': (0.6 + rnd(i, 4) * 0.8).toFixed(2),
              '--drift': `${Math.round((rnd(i, 6) - 0.5) * 120)}px`,
              '--r': `${Math.round(rnd(i, 7) * 360)}deg`,
            } as CSSProperties
          }
        >
          {kind === 'bats' ? BAT : null}
        </i>
      ))}
      {riders &&
        riders.map((e, i) => (
          <b
            key={'r' + i}
            className="amb-rider"
            style={{ '--x': `${Math.round(8 + rnd(i, 9) * 84)}%`, '--delay': `${(-rnd(i, 10) * 20).toFixed(1)}s`, '--d': `${(14 + rnd(i, 11) * 8).toFixed(1)}s` } as CSSProperties}
          >
            {e}
          </b>
        ))}
    </div>
  )
}

export const Ambient = memo(AmbientImpl)
