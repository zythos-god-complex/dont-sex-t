// Steam / Discord style profile card. Everyone gets the basic card; perk users get their card colours,
// live banner and bio.
import { useEffect, useState, type CSSProperties } from 'react'
import { useMe } from '../../lib/hooks'
import { report } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Aura, CARDS } from '../../ui/Aura'
import { useAvatarFor } from '../../ui/avatars'
import { applyAvatar, faceTraits } from '../../ui/face'
import { useFlairFor } from '../../ui/flair'
import { Sheet } from '../../ui/kit'
import type { Flair } from '../../lib/types'

export function ProfileCardView({ name, flair: given, sub }: { name: string; flair?: Flair | null; sub?: string | null }) {
  const looked = useFlairFor(given === undefined ? name : null)
  const flair = given === undefined ? looked : given
  const custom = useAvatarFor(name)
  const color = applyAvatar(faceTraits(name), custom).color
  const card = flair ? (CARDS.find((c) => c.id === flair.card) ?? CARDS[0]) : null
  const style = {
    '--pc-banner': `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`,
    ...(card ? { '--pc-bg': card.bg, '--pc-edge': card.edge } : {}),
  } as CSSProperties
  return (
    <div className={'pc' + (flair ? ' is-vip' : '')} style={style}>
      <div className="pc-banner">
        <Aura id={flair?.aura} />
      </div>
      <div className="pc-face">
        <GoofyFace name={name} size={88} mood="happy" hat={given === undefined ? undefined : (given?.hat ?? null)} />
      </div>
      <div className="pc-body">
        <span className="pc-name">{name}</span>
        {sub && <span className="pc-sub">{sub}</span>}
        {flair?.bio && <p className="pc-bio">{flair.bio}</p>}
      </div>
    </div>
  )
}

const REASONS = ['spam', 'creepy', 'underage', 'nasty', 'other'] as const

function Report({ name }: { name: string }) {
  const [state, setState] = useState<'idle' | 'pick' | 'busy' | 'done' | 'limit'>('idle')
  useEffect(() => setState('idle'), [name])
  const send = (r: string) => {
    setState('busy')
    report(name, r).then(() => setState('done'), (e) => setState(isApiError(e, 'rate_limited') ? 'limit' : 'pick'))
  }
  if (state === 'done') return <p className="rp-done">reported 🫡</p>
  if (state === 'limit') return <p className="rp-done">easy there, try tomorrow</p>
  if (state === 'idle')
    return (
      <button type="button" className="rp-open" onClick={() => setState('pick')}>
        report
      </button>
    )
  return (
    <div className="rp-chips">
      {REASONS.map((r) => (
        <button key={r} type="button" className="rp-chip" disabled={state === 'busy'} onClick={() => send(r)}>
          {r}
        </button>
      ))}
    </div>
  )
}

export function ProfileCard({ name, sub, open, onClose }: { name: string; sub?: string | null; open: boolean; onClose: () => void }) {
  const me = useMe()
  const mine = me?.username.toLowerCase() === name.toLowerCase()
  return (
    <Sheet open={open} onClose={onClose} label={name + ' profile'}>
      <ProfileCardView name={name} sub={sub} />
      {!mine && me && <Report name={name} />}
    </Sheet>
  )
}
