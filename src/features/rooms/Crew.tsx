import { memo, type CSSProperties } from 'react'
import { GoofyFace } from '../../ui/GoofyFace'

const NAMES = ['zoomer', 'yapper', 'lurker', 'doomscroll', 'gremlin', 'bestie', 'goblin', 'menace', 'sleepy', 'chaos', 'npc', 'icon']

/** 2 or 3 goofy characters glued to their phones, texting each other. Drawn at 120x100 and scaled. */
function CrewImpl({ seed, size = 120, count = 3, still = false }: { seed: number; size?: number; count?: 2 | 3; still?: boolean }) {
  const pick = (i: number) => `${NAMES[(seed + i * 7) % NAMES.length]}.${(seed >> (i + 2)) % 97}`
  const k = size / 120
  const spots =
    count === 3
      ? [
          { x: 33, y: 12, s: 46, look: { x: 0.2, y: 0.85 }, z: 1 },
          { x: 0, y: 44, s: 52, look: { x: 0.5, y: 0.8 }, z: 2 },
          { x: 66, y: 44, s: 52, look: { x: -0.5, y: 0.8 }, z: 3 },
        ]
      : [
          { x: 4, y: 30, s: 58, look: { x: 0.45, y: 0.8 }, z: 1 },
          { x: 58, y: 30, s: 58, look: { x: -0.45, y: 0.8 }, z: 2 },
        ]
  return (
    <span className={'crew' + (still ? ' is-still' : '')} style={{ width: size, height: size * (100 / 120) }} aria-hidden="true">
      <span className="crew-in" style={{ transform: `scale(${k})` }}>
        {spots.map((p, i) => (
          <span key={i} className="crew-dude" style={{ left: p.x, top: p.y, zIndex: p.z, '--i': i } as CSSProperties}>
            <GoofyFace name={pick(i)} size={p.s} look={p.look} blink={!still} mood={i === 1 ? 'happy' : 'neutral'} horns={false} />
            <span className="crew-phone" style={{ width: p.s * 0.36, height: p.s * 0.5 }}>
              <i />
            </span>
            {!still && (
              <span className="crew-pop">
                <b />
                <b />
                <b />
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  )
}

export const Crew = memo(CrewImpl)
