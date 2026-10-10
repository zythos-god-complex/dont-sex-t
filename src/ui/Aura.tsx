// Live nameplate backgrounds for perk users. Fill the nearest positioned parent; transform + opacity only.
import { MatrixRain } from '../themes/MatrixRain'
import type { CSSProperties } from 'react'
import type { AuraId, CardId } from '../lib/types'

const SPRINKLES: Partial<Record<AuraId, number>> = { gold: 4, galaxy: 7, sakura: 4, hearts: 4 }

export function Aura({ id }: { id: AuraId | undefined }) {
  if (!id || id === 'none') return null
  if (id === 'matrix')
    return (
      <span className="aura aura-matrix" aria-hidden="true">
        <MatrixRain size={10} fps={14} />
      </span>
    )
  const n = SPRINKLES[id] ?? 0
  return (
    <span className={'aura aura-' + id} aria-hidden="true">
      <span className="aura-flow" />
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ '--i': i, '--x': `${12 + ((i * 41) % 80)}%`, '--y': `${18 + ((i * 37) % 64)}%` } as CSSProperties} />
      ))}
    </span>
  )
}

export const AURAS: AuraId[] = ['none', 'gold', 'sunset', 'galaxy', 'sakura', 'aurora', 'hearts', 'matrix']
export const CARDS: { id: CardId; bg: string; edge: string }[] = [
  { id: 'ink', bg: '#16141C', edge: '#3A3646' },
  { id: 'gold', bg: '#1E1608', edge: '#C99A2E' },
  { id: 'rose', bg: '#2A0E1A', edge: '#E0507F' },
  { id: 'grape', bg: '#1B1230', edge: '#8A6BFF' },
  { id: 'mint', bg: '#0C231C', edge: '#3DD6A0' },
  { id: 'sky', bg: '#0D1A2E', edge: '#5BB5FF' },
]
