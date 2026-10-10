// Steam / Discord style profile card. Everyone gets the basic card; perk users get their card colours,
// live banner and bio.
import { IconHi } from '../../ui/icons'
import { NowPlaying, SongCard } from '../music/NowPlaying'
import { useStore } from '../../lib/store'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMe } from '../../lib/hooks'
import { report, setBlocked, useBlocks, useGhost } from '../../lib/engine'
import { closePeek, usePeek } from './peek'
import { icebreaker, setIce } from '../../lib/drafts'
import { useLocation } from 'wouter'
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
  const prof = useStore((s) => {
    const k = name.toLowerCase()
    return Object.values(s.profiles).find((x) => x.username.toLowerCase() === k) ?? (s.me?.username.toLowerCase() === k ? s.me : null)
  })
  const since = prof?.joined ? 'since ' + new Date(prof.joined).toLocaleDateString('en', { month: 'short', year: 'numeric' }).toLowerCase() : ''
  const chips = prof ? [prof.age ? String(prof.age) : '', prof.place ?? '', since].filter(Boolean) : []
  const bio = prof?.bio || flair?.bio
  const np = prof?.now_playing
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
        <GoofyFace name={name} size={88} hat={given === undefined ? undefined : (given?.hat ?? null)} />
      </div>
      <div className="pc-body">
        <span className="pc-name">{name}</span>
        {sub && <span className="pc-sub">{sub}</span>}
        {chips.length > 0 && (
          <span className="pc-chips">
            {chips.map((c) => (
              <i key={c}>{c}</i>
            ))}
          </span>
        )}
        {bio && <p className="pc-bio">{bio}</p>}
        {np ? <NowPlaying track={np} /> : prof?.song && <SongCard song={prof.song} />}
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
  if (state === 'done') return <span className="rp-done">reported</span>
  if (state === 'limit') return <span className="rp-done">easy there, try tomorrow</span>
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

function BlockBtn({ id }: { id: string }) {
  const blocked = useBlocks((b) => b.blocked.includes(id))
  const [arm, setArm] = useState(false)
  useEffect(() => setArm(false), [id])
  const tap = () => {
    if (blocked) void setBlocked(id, false)
    else if (arm) {
      setArm(false)
      void setBlocked(id, true)
    } else setArm(true)
  }
  return (
    <button type="button" className={'rp-open' + (arm ? ' is-armed' : '')} onClick={tap}>
      {blocked ? 'unblock' : arm ? 'block, sure?' : 'block'}
    </button>
  )
}

export function ProfileCard({ name, id, sub, open, onClose, chat = false }: { name: string; id?: string | null; sub?: string | null; open: boolean; onClose: () => void; chat?: boolean }) {
  const me = useMe()
  const [, nav] = useLocation()
  const mine = me?.username.toLowerCase() === name.toLowerCase()
  const blocked = useBlocks((b) => !!id && (b.blocked.includes(id) || b.blockedBy.includes(id)))
  const ghost = useGhost((g) => g.on)
  const open2 = (text: string, auto: boolean) => {
    setIce(name, text, auto)
    onClose()
    nav('/dm/' + encodeURIComponent(name))
  }
  return (
    <Sheet open={open} onClose={onClose} label={name + ' profile'}>
      <ProfileCardView name={name} sub={sub} />
      {!mine && me && chat && !blocked && !ghost && (
        <div className="pc-say">
          <button type="button" className="pc-hi" onClick={() => open2(icebreaker(), false)}>
            say hi
          </button>
          <button type="button" className="pc-wave" onClick={() => open2('[[sticker:hey]]', true)} aria-label="wave">
            <IconHi size={24} />
          </button>
        </div>
      )}
      {!mine && me && (
        <div className="pc-acts">
          {id && <BlockBtn id={id} />}
          <Report name={name} />
        </div>
      )}
    </Sheet>
  )
}

export function PeekHost() {
  const { name, id } = usePeek()
  const last = useRef(name)
  if (name) last.current = name
  if (!last.current) return null
  return <ProfileCard name={last.current} id={id} open={!!name} onClose={closePeek} chat />
}
