import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useNow, useOnline, useTypingToMe, useUnreadFrom, type OnlineFilter } from '../../lib/hooks'
import { hereFor } from '../../lib/format'
import type { OnlineUser } from '../../lib/types'
import { GoofyFace, useLookAt, type FaceMood } from '../../ui/GoofyFace'
import { faceTilt } from '../../ui/face'
import { Badge, Segmented, TypingDots, Wordmark, spring, useIsDesktop } from '../../ui/kit'
import { GenderIcon, IconClose, IconDice, IconDm, IconGhost, IconMegaphone } from '../../ui/icons'
import { loadRooms, useRoomList, useRooms } from '../rooms/rooms'
import { Crew } from '../rooms/Crew'
import { MeButton } from '../shell/MeSheet'
import { takeRoll } from '../shell/nav'
import { saveGhost, setLooking, useBlocks, useGhost, useMood } from '../../lib/engine'
import { api } from '../../lib/api'
import { icebreaker, setIce } from '../../lib/drafts'
import { peek } from '../profile/peek'
import { useStore } from '../../lib/store'

const CELL = 120

// slot reel: faces whiz past and land on the stranger you get
function Reel({ strip, onDone }: { strip: OnlineUser[]; onDone: (u: OnlineUser) => void }) {
  const last = strip[strip.length - 1]
  return (
    <motion.div className="reel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="reel-win">
        <motion.div
          className="reel-strip"
          initial={{ y: 0 }}
          animate={{ y: -(strip.length - 1) * CELL }}
          transition={{ duration: 1.5, ease: [0.12, 0.7, 0.18, 1] }}
          onAnimationComplete={() => setTimeout(() => onDone(last), 450)}
        >
          {strip.map((u, i) => (
            <span key={i} className="reel-cell">
              <GoofyFace name={u.username} size={92} blink={false} mood={i === strip.length - 1 ? 'happy' : 'shocked'} />
            </span>
          ))}
        </motion.div>
      </div>
      <motion.p className="reel-name" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45 }}>
        {last.username}
      </motion.p>
    </motion.div>
  )
}

function Card({ u, now }: { u: OnlineUser; now: number }) {
  const [, nav] = useLocation()
  const typing = useTypingToMe(u.id)
  const unread = useUnreadFrom(u.id)
  const [ref, look] = useLookAt<HTMLButtonElement>()
  const tilt = faceTilt(u.username, 1.6)
  const showStatus = useStore((s) => s.me?.show_status !== false && s.profiles[u.id]?.show_status !== false && u.show_status !== false)
  const about = useStore((s) => {
    const p = s.profiles[u.id]
    return p ? [p.age ? String(p.age) : '', p.place ?? ''].filter(Boolean).join(' · ') : ''
  })
  const bio = useStore((s) => s.profiles[u.id]?.bio ?? '')
  // already chatted: straight to the DM, strangers get the peek card
  const known = useStore((s) => !!s.convByPeer[u.id])
  return (
    <motion.button
      ref={ref}
      layout
      className={'card' + (u.away && showStatus ? ' is-away' : '')}
      style={{ '--tilt': `${tilt}deg` } as CSSProperties}
      initial={{ opacity: 0, scale: 0.85, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18 } }}
      transition={spring}
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        if (known) nav('/dm/' + encodeURIComponent(u.username))
        else peek(u.username, u.id)
      }}
    >
      {unread > 0 && <Badge n={unread} className="card-badge" />}
      {known && (
        <span className="card-known" aria-hidden="true">
          <IconDm size={14} filled />
        </span>
      )}
      <span className="card-face">
        <GoofyFace name={u.username} size={104} presence={showStatus ? (u.away ? 'away' : 'online') : null} look={look} mood={(u.mood as FaceMood | null) ?? undefined} />
      </span>
      <span className="card-name ellipsis">{u.username}</span>
      {about && <span className="card-about ellipsis">{about}</span>}
      {bio && <span className="card-bio">{bio}</span>}
      <span className={'card-meta' + (typing ? ' is-typing' : '')}>
        {typing ? (
          <>
            <TypingDots /> typing to you...
          </>
        ) : (
          <>
            <GenderIcon g={u.gender} size={15} className={'g-ico g-' + u.gender} />
            {showStatus ? (u.away ? 'away' : hereFor(u.since, now)) : u.gender === 'm' ? 'male' : 'female'}
          </>
        )}
      </span>
    </motion.button>
  )
}

// the gender filter survives coming back from a chat and reloads
const FKEY = 'gat.lobbyFilter'
let lastFilter: OnlineFilter | 'mood' = (() => {
  try {
    const v = localStorage.getItem(FKEY)
    return v === 'm' || v === 'f' || v === 'mood' ? v : 'all'
  } catch {
    return 'all'
  }
})()

// one line from the admin for everyone, sits in the lobby flow, tap to hide until the next one
function Notice() {
  const [n, setN] = useState<{ text: string; at: string } | null>(null)
  useEffect(() => {
    let seen = ''
    try { seen = localStorage.getItem('gat.notice') ?? '' } catch { /* blocked */ }
    void api.notice().then((v) => { if (v?.text && v.at !== seen) setN(v) }, () => {})
  }, [])
  if (!n) return null
  const hide = () => {
    try { localStorage.setItem('gat.notice', n.at) } catch { /* blocked */ }
    setN(null)
  }
  return (
    <button type="button" className="notice" onClick={hide} aria-label="hide notice">
      <IconMegaphone className="notice-ico" size={20} />
      <span className="notice-text">{n.text}</span>
      <IconClose className="notice-x" size={16} />
    </button>
  )
}

export default function Lobby() {
  const desktop = useIsDesktop()
  const [filter, setFilterRaw] = useState<OnlineFilter | 'mood'>(lastFilter)
  const setFilter = (f: OnlineFilter | 'mood') => {
    lastFilter = f
    try { localStorage.setItem(FKEY, f) } catch { /* blocked */ }
    setFilterRaw(f)
  }
  const { list: everyone, counts } = useOnline(filter === 'mood' ? 'all' : filter)
  const moodNow = useMood((s) => s.mood?.mood ?? null)
  // a remembered 'same mood' filter with no mood set falls back to everyone
  const eff = filter === 'mood' && !moodNow ? 'all' : filter
  const all = eff === 'mood' ? everyone.filter((u) => u.mood && u.mood === moodNow) : everyone
  const ghost = useGhost((g) => g.on)
  const blocked = useBlocks((b) => b.blocked)
  const blockedBy = useBlocks((b) => b.blockedBy)
  const visible = all.filter((u) => !blocked.includes(u.id) && !blockedBy.includes(u.id))
  const convByPeer = useStore((s) => s.convByPeer)
  const conversations = useStore((s) => s.conversations)
  const typing = useStore((s) => s.typing)
  const myNsfw = useStore((s) => s.me?.nsfw === true)
  const myMood = useMood((s) => s.mood?.mood ?? null)
  // buds first, then people typing to you, shared vibes, same mood, new arrivals, everyone else
  const list = useMemo(() => {
    const t = Date.now()
    const score = (u: OnlineUser) => {
      const cid = convByPeer[u.id]
      const c = cid ? conversations[cid] : undefined
      return (c && c.status !== 'declined' ? 1000 : 0) + (cid && (typing[cid] ?? 0) > t ? 100 : 0) + (myNsfw && u.nsfw ? 10 : 0) + (myMood && u.mood === myMood ? 5 : 0) + (t - Date.parse(u.since) < 5 * 60e3 ? 2 : 0)
    }
    return visible.map((u, i) => ({ u, i, s: score(u) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.u)
  }, [visible, convByPeer, conversations, typing, myNsfw, myMood])
  useEffect(() => void loadRooms(), [])
  const rooms = useRoomList()
  const here = useRooms((s) => s.here)
  const now = useNow(30000)
  const [, go] = useLocation()
  const meId = useStore((s) => s.me?.id)
  const [copied, setCopied] = useState(false)
  const [reel, setReel] = useState<OnlineUser[] | null>(null)
  const pool = list.filter((u) => u.id !== meId)
  // roll only lands on people you have never talked to; known faces are one tap away on their cards
  const fresh = pool.filter((u) => !convByPeer[u.id])
  const freshRef = useRef(fresh)
  freshRef.current = fresh
  const landed = (u: OnlineUser) => {
    setReel(null)
    setLooking(false)
    setIce(u.username, icebreaker())
    go('/dm/' + encodeURIComponent(u.username))
  }
  const roll = () => {
    const from = freshRef.current
    if (!from.length) return
    if (from.length === 1) return landed(from[0])
    // while the reel spins we also look for anyone else rolling right now, and pair up if we find them
    setLooking(true)
    const awake = from.filter((u) => !u.away)
    const pickFrom = awake.length ? awake : from
    const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)]
    const strip = Array.from({ length: 14 }, () => from[Math.floor(Math.random() * from.length)])
    setReel([...strip, pick])
  }
  useEffect(() => () => setLooking(false), [])
  // everyone looking pairs up the same way: sort ids, 1st with 2nd, 3rd with 4th...
  const lookers = reel && meId ? [meId, ...fresh.filter((u) => u.looking).map((u) => u.id)].sort() : []
  const mate = lookers.length > 1 ? lookers[lookers.indexOf(meId!) ^ 1] : undefined
  const mateUser = mate ? fresh.find((u) => u.id === mate) : undefined
  useEffect(() => {
    if (!mateUser) return
    navigator.vibrate?.([20, 40, 20])
    landed(mateUser)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mateUser])
  // 'roll another' from a chat lands here with a roll queued up
  useEffect(() => {
    if (fresh.length && takeRoll()) roll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh.length > 0])
  const share = () => {
    const url = location.origin
    if (navigator.share) void navigator.share({ title: 'GoofyAhhTalk', url }).catch(() => {})
    else void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})
  }

  // filtered to nobody while others are around: the way out is everyone, not rooms
  const filteredEmpty = eff !== 'all' && counts.all > 0
  const emptyTitle = eff === 'm' ? 'no guys online rn' : eff === 'f' ? 'no girls online rn' : eff === 'mood' ? 'nobody in your mood rn' : "nobody's here rn"
  const publicRooms = rooms.filter((r) => r.kind === 'public').slice(0, 3)

  return (
    <div className="lobby">
      {!desktop && (
        <header className="m-head">
          <Wordmark size={22} />
          <div className="m-head-actions">
            <MeButton />
          </div>
        </header>
      )}
      {desktop && (
        <header className="d-head">
          <h1>
            online <span className="tnum d-count">{counts.all}</span>
          </h1>
        </header>
      )}
      <div className="lobby-filter">
        <Segmented
          layoutId="lobby-filter"
          value={eff}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'all', count: counts.all },
            { id: 'm', label: 'male', count: counts.m },
            { id: 'f', label: 'female', count: counts.f },
            ...(moodNow ? [{ id: 'mood' as const, label: 'same mood', count: everyone.filter((u) => u.mood === moodNow).length }] : []),
          ]}
        />
      </div>
      <div className="lobby-scroll scroll-y">
        <Notice />
        {list.length === 0 ? (
          <motion.div className="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="empty-face">
              <GoofyFace name="sleepy.zzz" size={132} mood="sleepy" />
              <span className="zzz">z</span>
            </div>
            <p className="empty-title">{emptyTitle}</p>
            {filteredEmpty ? (
              <div className="empty-acts">
                <button type="button" className="empty-act is-ink" onClick={() => setFilter('all')}>
                  show all {counts.all}
                </button>
              </div>
            ) : (
              <>
                {publicRooms.length > 0 && (
                  <div className="empty-rooms">
                    {publicRooms.map((r) => (
                      <button key={r.id} type="button" className="empty-room" onClick={() => go('/rooms/' + r.id)}>
                        <Crew seed={r.seed} size={44} still />
                        <span className="empty-room-name ellipsis">{r.name}</span>
                        {(here[r.id] ?? 0) > 0 && <span className="empty-room-n tnum">{here[r.id]} here</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="empty-acts">
                  <button type="button" className="empty-act" onClick={share}>
                    {copied ? 'link copied' : 'bring a friend'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <div className="board">
            <AnimatePresence mode="popLayout">
              {list.map((u) => (
                <Card key={u.id} u={u} now={now} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AnimatePresence>
        {ghost ? (
          <motion.button key="g" type="button" className="roll is-ghost" onClick={() => void saveGhost(false)} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} whileTap={{ scale: 0.94 }} transition={spring}>
            <IconGhost size={20} />
            ghosting
          </motion.button>
        ) : (
          fresh.length >= 1 && (
            <motion.button
              key="r"
              type="button"
              className="roll"
              onClick={() => !reel && roll()}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              whileTap={{ scale: 0.94 }}
              transition={spring}
            >
              <span className={'roll-dice' + (reel ? ' is-spin' : '')}>
                <IconDice size={20} />
              </span>
              roll a stranger
            </motion.button>
          )
        )}
      </AnimatePresence>
      <AnimatePresence>{reel && <Reel strip={reel} onDone={landed} />}</AnimatePresence>
    </div>
  )
}
