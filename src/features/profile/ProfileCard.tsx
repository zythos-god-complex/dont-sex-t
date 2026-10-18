// Steam / Discord style profile card. Everyone gets the basic card; perk users get their card colours,
// live banner and bio.
import { IconAddFriend, IconBrush, IconDm, IconFlame, IconFriend, IconGhost, IconHi, IconMoon, IconPhone, IconUsers } from '../../ui/icons'
import { Coin } from '../shop/Coin'
import { Flame } from '../../ui/Flame'
import { openMeSheet } from '../shell/meSheet'
import { NowPlaying, SongCard } from '../music/NowPlaying'
import { useStore } from '../../lib/store'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMe } from '../../lib/hooks'
import { adminCall, report, saveGhost, setBlocked, setFriend, useBlocks, useGhost } from '../../lib/engine'
import { closePeek, usePeek } from './peek'
import { icebreaker, setIce } from '../../lib/drafts'
import { useLocation } from 'wouter'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Aura, CARDS } from '../../ui/Aura'
import { useAvatarFor } from '../../ui/avatars'
import { applyAvatar, faceTraits } from '../../ui/face'
import { useFlairFor } from '../../ui/flair'
import { Sheet, Toggle } from '../../ui/kit'
import type { Flair } from '../../lib/types'

// earned on the server (hourly), shown under the bio
const HOW: Record<string, string> = {
  first: 'sent their first message',
  chatty: '100 messages sent',
  social: 'chatted with 10 people',
  owl: 'lots of late night yapping',
  streak7: 'kept a streak 7 days',
  bestie: 'made a friend',
  squad: '5 friends',
}
const BADGES: Record<string, [string, typeof IconHi]> = {
  first: ['first hi', IconHi],
  chatty: ['yapper', IconDm],
  social: ['social', IconUsers],
  owl: ['night owl', IconMoon],
  streak7: ['7 day streak', IconFlame],
  bestie: ['bestie', IconFriend],
  squad: ['squad', IconUsers],
}

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
  const [open, setOpen] = useState<string | null>(null)
  const color = applyAvatar(faceTraits(name), custom).color
  const card = flair?.card ? (CARDS.find((c) => c.id === flair.card) ?? null) : null
  const style = {
    '--pc-banner': `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`,
    ...(card ? { '--pc-bg': card.bg, '--pc-edge': card.edge } : {}),
  } as CSSProperties
  return (
    <div className={'pc' + (card ? ' is-vip' : '')} style={style}>
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
        {!!prof?.badges?.length && (
          <span className="pc-badges">
            {prof.badges
              .filter((b) => BADGES[b])
              .map((b) => {
                const [label, Ico] = BADGES[b]
                return (
                  <button key={b} type="button" className={'pc-badge' + (open === b ? ' is-open' : '')} onClick={() => setOpen(open === b ? null : b)}>
                    <Ico size={14} />
                    {open === b ? HOW[b] : label}
                  </button>
                )
              })}
          </span>
        )}
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
      <button type="button" className="rp-chip is-quiet" onClick={() => setState('idle')}>
        cancel
      </button>
    </div>
  )
}

/** first tap arms (label ends in '?'), second does it */
function Armed({ label, onGo }: { label: string; onGo: () => void }) {
  const [arm, setArm] = useState(false)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(false), 3000)
    return () => clearTimeout(t)
  }, [arm])
  return (
    <button type="button" className={'rp-open' + (arm ? ' is-armed' : '')} onClick={() => (arm ? (setArm(false), onGo()) : setArm(true))}>
      {arm ? label + '?' : label}
    </button>
  )
}

function BlockBtn({ id }: { id: string }) {
  const blocked = useBlocks((b) => b.blocked.includes(id))
  if (blocked)
    return (
      <button type="button" className="rp-open" onClick={() => void setBlocked(id, false)}>
        unblock
      </button>
    )
  return <Armed key={id} label="block" onGo={() => void setBlocked(id, true)} />
}

/** admin only: let this person make voice calls (to friends who can call too) */
function CallsSwitch({ id }: { id: string }) {
  const on = useStore((s) => !!(s.profiles[id]?.can_call ?? s.conversations[s.convByPeer[id]]?.peer.can_call))
  const [busy, setBusy] = useState(false)
  const flip = (v: boolean) => {
    setBusy(true)
    adminCall('calls', { id, on: v })
      .then(() =>
        useStore.setState((s) => {
          const prof = s.profiles[id]
          const cid = s.convByPeer[id]
          const conv = cid ? s.conversations[cid] : undefined
          return {
            profiles: prof ? { ...s.profiles, [id]: { ...prof, can_call: v } } : s.profiles,
            conversations: conv ? { ...s.conversations, [cid]: { ...conv, peer: { ...conv.peer, can_call: v } } } : s.conversations,
          }
        }),
      )
      .catch(() => {})
      .finally(() => setBusy(false))
  }
  return (
    <div className="pc-admin">
      <IconPhone size={18} />
      <span className="grow">calls</span>
      <Toggle label="allow calls" on={on} disabled={busy} onChange={flip} />
    </div>
  )
}

/** admin only: drop someone coins */
function GiftCoins({ id }: { id: string }) {
  const [st, setSt] = useState<'idle' | 'busy' | 'done'>('idle')
  return (
    <div className="pc-admin">
      <Coin size={18} />
      <span className="grow">coins</span>
      <button
        type="button"
        className="ci-buy"
        disabled={st === 'busy'}
        onClick={() => {
          setSt('busy')
          adminCall('coins', { id, n: 500 })
            .then(() => setSt('done'))
            .catch(() => setSt('idle'))
        }}
      >
        {st === 'done' ? 'sent' : 'gift 500'}
      </button>
    </div>
  )
}

// the relationship lives here: say hi, message, add friend, add back, friends, unfriend
export function ProfileCard({ name, id, sub, open, onClose }: { name: string; id?: string | null; sub?: string | null; open: boolean; onClose: () => void; chat?: boolean }) {
  const me = useMe()
  const [, nav] = useLocation()
  const mine = me?.username.toLowerCase() === name.toLowerCase()
  const blocked = useBlocks((b) => !!id && (b.blocked.includes(id) || b.blockedBy.includes(id)))
  const ghost = useGhost((g) => g.on)
  const conv = useStore((s) => (id ? s.conversations[s.convByPeer[id]] : undefined))
  const go = () => {
    onClose()
    nav('/dm/' + encodeURIComponent(name))
  }
  const sayHi = () => {
    setIce(name, icebreaker(), false)
    go()
  }
  const live = !!conv && conv.status !== 'pending' && conv.status !== 'declined' && !conv.blocked
  const myF = !!conv?.my_friend
  const theirF = !!conv?.peer_friend
  return (
    <Sheet open={open} onClose={onClose} label={name + ' profile'}>
      <ProfileCardView name={name} sub={sub} />
      {mine && (
        <div className="pc-say">
          <button
            type="button"
            className="pc-hi is-soft"
            onClick={() => {
              onClose()
              setTimeout(() => openMeSheet(), 180)
            }}
          >
            <IconBrush size={18} /> edit
          </button>
        </div>
      )}
      {!mine && me && !blocked && (
        <div className="pc-say">
          {!conv && ghost ? (
            <button type="button" className="pc-hi is-soft" onClick={() => void saveGhost(false)}>
              <IconGhost size={18} /> ghosting
            </button>
          ) : !conv ? (
            <button type="button" className="pc-hi" onClick={sayHi}>
              <IconHi size={20} /> say hi
            </button>
          ) : (
            <>
              <button type="button" className="pc-hi" onClick={go}>
                <IconDm size={18} /> message
              </button>
              {live &&
                (myF && theirF ? (
                  <span className="pc-friends">
                    <IconFriend size={18} /> friends
                    <Flame convId={conv.id} />
                  </span>
                ) : (
                  <button type="button" className={'pc-hi is-soft' + (theirF && !myF ? ' is-accent' : '')} onClick={() => void setFriend(conv.id, !myF)}>
                    {myF ? <IconFriend size={18} /> : <IconAddFriend size={18} />}
                    {myF ? 'requested' : theirF ? 'add back' : 'add friend'}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
      {!mine && me?.admin && id && <CallsSwitch id={id} />}
      {!mine && me?.admin && id && <GiftCoins id={id} />}
      {!mine && me && (
        <div className="pc-acts">
          {live && myF && theirF && <Armed key={'uf' + conv.id} label="unfriend" onGo={() => void setFriend(conv.id, false)} />}
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
  return <ProfileCard name={last.current} id={id} open={!!name} onClose={closePeek} />
}
