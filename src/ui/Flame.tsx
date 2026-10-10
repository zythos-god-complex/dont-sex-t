// Ink flame on chats where both people talk every day; droops after 8pm if today isn't kept yet.
import { IconHourglass } from './icons'
import type { CSSProperties } from 'react'
import { usePulse } from '../lib/pulse'

export function Flame({ convId }: { convId: string }) {
  const s = usePulse((p) => p.streaks[convId])
  if (!s) return null
  return (
    <span className={'flame' + (s.droop ? ' is-droop' : '')} style={{ '--g': Math.min(1, s.n / 30) } as CSSProperties} aria-label={`${s.n} day streak`}>
      <svg viewBox="0 0 16 20" aria-hidden="true">
        <path d="M8 1c1 3 4.6 5 4.6 9.4a4.6 4.6 0 0 1-9.2.4C3.4 8 4.8 6.6 5.2 5c.5 1.5 1.4 2.3 2 2.3C7 5 7 3 8 1Z" />
        <path className="flame-in" d="M8 11c.6 1.2 2 2 2 3.6a2 2 0 0 1-4 0c0-1 .6-1.6 1-2.4.2.6.6 1 1 1 0-.8-.2-1.4 0-2.2Z" />
      </svg>
      <b className="tnum">{s.n}</b>
    </span>
  )
}

export function Melt({ convId }: { convId: string }) {
  const m = usePulse((p) => p.melt[convId])
  if (!m) return null
  return (
    <span className="melt" aria-label="melting soon">
      <IconHourglass size={13} strokeWidth={2.4} />
    </span>
  )
}
