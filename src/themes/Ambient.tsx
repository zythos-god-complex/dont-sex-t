import { memo, type CSSProperties } from 'react'
import type { Ambient as AmbientKind } from './themes'

const COUNT: Partial<Record<AmbientKind, number>> = { petals: 14, stars: 26, bubbles: 12, leaves: 9, hearts: 10, sparkles: 16 }

// deterministic pseudo random so layout is stable across renders
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function AmbientImpl({ kind }: { kind: AmbientKind }) {
  if (kind === 'none') return null
  if (kind === 'aurora') return <div className="amb amb-aurora" aria-hidden="true"><i /><i /><i /></div>
  if (kind === 'scanlines') return <div className="amb amb-scan" aria-hidden="true" />
  if (kind === 'haze') return <div className="amb amb-haze" aria-hidden="true"><i /><i /></div>
  const n = COUNT[kind] ?? 10
  return (
    <div className={'amb amb-' + kind} aria-hidden="true">
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
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

export const Ambient = memo(AmbientImpl)
