import { memo, type CSSProperties } from 'react'
import type { Ambient as AmbientKind } from './themes'
import { useAmbientPrefs } from './ambientPrefs'
import { BatmanScene, BffScene, LoveScene, LustScene } from './scenes'

const COUNT: Partial<Record<AmbientKind, number>> = {
  petals: 14, stars: 26, bubbles: 12, leaves: 9, hearts: 10, sparkles: 16,
  bats: 1, lovebeat: 9, party: 10, embers: 10,
}

// deterministic pseudo random so layout is stable across renders
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** spicy: both people in this chat have nsfw on (unlocks the spicy lust doodles) */
function AmbientImpl({ kind, spicy = false }: { kind: AmbientKind; spicy?: boolean }) {
  const amount = useAmbientPrefs((p) => p.amount)
  const speed = useAmbientPrefs((p) => p.speed)
  if (kind === 'none') return null
  if (kind === 'aurora') return <div className="amb amb-aurora" aria-hidden="true"><i /><i /><i /></div>
  if (kind === 'scanlines') return <div className="amb amb-scan" aria-hidden="true" />
  if (kind === 'haze') return <div className="amb amb-haze" aria-hidden="true"><i /><i /></div>
  const n = Math.max(1, Math.min(80, Math.round((COUNT[kind] ?? 10) * amount)))
  const spd = { '--spd': speed } as CSSProperties
  // signature themes are full scenes
  if (kind === 'bats') return <div style={spd} className="amb-wrap"><BatmanScene /></div>
  if (kind === 'lovebeat') return <div style={spd} className="amb-wrap"><LoveScene n={n} /></div>
  if (kind === 'party') return <div style={spd} className="amb-wrap"><BffScene n={n} /></div>
  if (kind === 'embers') return <div style={spd} className="amb-wrap"><LustScene n={n} spicy={spicy} /></div>
  return (
    <div className={'amb amb-' + kind} aria-hidden="true" style={spd}>
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
