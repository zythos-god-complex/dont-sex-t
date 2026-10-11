import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useNow, useOnline, useTypingToMe, useUnreadFrom, useUnreadTotal, type OnlineFilter } from '../../lib/hooks'
import { hereFor } from '../../lib/format'
import type { OnlineUser } from '../../lib/types'
import { GoofyFace, useLookAt, type FaceMood } from '../../ui/GoofyFace'
import { faceTilt } from '../../ui/face'
import { Badge, Segmented, TypingDots, Wordmark, spring, useIsDesktop } from '../../ui/kit'
import { GenderIcon, IconDice, IconDm, IconRooms } from '../../ui/icons'
import { loadRooms, useRoomsUnread } from '../rooms/rooms'
import { MeButton } from '../shell/MeSheet'
import { setLooking, useBlocks, useGhost, useMood } from '../../lib/engine'
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
  const hold = useRef<{ t: ReturnType<typeof setTimeout>; fired: boolean } | null>(null)
  const about = useStore((s) => {
    const p = s.profiles[u.id]
    return p ? [p.age ? String(p.age) : '', p.place ?? ''].filter(Boolean).join(' · ') : ''
  })
  const bio = useStore((s) => s.profiles[u.id]?.bio ?? '')
  // already chatted: straight to the DM, strangers get the peek card
  const known = useStore((s) => !!s.convByPeer[u.id])
  const down = () => {
    const h = { fired: false, t: setTimeout(() => {
      h.fired = true
      navigator.vibrate?.(12)
      nav('/dm/' + encodeURIComponent(u.username))
    }, 450) }
    hold.current = h
  }
  const up = () => {
    if (hold.current) clearTimeout(hold.current.t)
  }
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
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (hold.current?.fired) return
        if (known) nav('/dm/' + encodeURIComponent(u.username))
        else peek(u.username, u.id)
      }}
    >
      {unread > 0 && <Badge n={unread} className="card-badge" />}
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

export default function Lobby() {
  const desktop = useIsDesktop()
  const [filter, setFilter] = useState<OnlineFilter | 'mood'>('all')
  const { list: everyone, counts } = useOnline(filter === 'mood' ? 'all' : filter)
  const moodNow = useMood((s) => s.mood?.mood ?? null)
  const all = filter === 'mood' ? everyone.filter((u) => u.mood && u.mood === moodNow) : everyone
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
  const unread = useUnreadTotal()
  const roomsUnread = useRoomsUnread()
  useEffect(() => void loadRooms(), [])
  const now = useNow(30000)
  const [, go] = useLocation()
  const meId = useStore((s) => s.me?.id)
  const [copied, setCopied] = useState(false)
  const [reel, setReel] = useState<OnlineUser[] | null>(null)
  const [queue, setQueue] = useState(false)
  const holdT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const pool = list.filter((u) => u.id !== meId)
  const roll = () => {
    const awake = pool.filter((u) => !u.away)
    const from = awake.length ? awake : pool
    const pick = from[Math.floor(Math.random() * from.length)]
    if (!pick) return
    // a reel of random faces that lands on the pick
    const strip = Array.from({ length: 14 }, () => pool[Math.floor(Math.random() * pool.length)])
    setReel([...strip, pick])
  }
  const landed = (u: OnlineUser) => {
    setReel(null)
    setIce(u.username, icebreaker())
    go('/dm/' + encodeURIComponent(u.username))
  }
  const diceDown = () => {
    held.current = false
    holdT.current = setTimeout(() => {
      held.current = true
      navigator.vibrate?.([10, 30, 10])
      setQueue(true)
    }, 450)
  }
  const diceUp = () => {
    if (holdT.current) clearTimeout(holdT.current)
  }
  useEffect(() => {
    setLooking(queue)
  }, [queue])
  useEffect(() => () => setLooking(false), [])
  // everyone looking pairs up the same way: sort ids, 1st with 2nd, 3rd with 4th...
  const lookers = queue && meId ? [meId, ...pool.filter((u) => u.looking).map((u) => u.id)].sort() : []
  const mate = lookers.length > 1 ? lookers[lookers.indexOf(meId!) ^ 1] : undefined
  const mateUser = mate ? pool.find((u) => u.id === mate) : undefined
  useEffect(() => {
    if (!mateUser) return
    setQueue(false)
    navigator.vibrate?.([20, 40, 20])
    setIce(mateUser.username, icebreaker())
    go('/dm/' + encodeURIComponent(mateUser.username))
  }, [mateUser, go])
  const share = () => {
    const url = location.origin
    if (navigator.share) void navigator.share({ title: 'GoofyAhhTalk', url }).catch(() => {})
    else void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})
  }

  const emptyCopy =
    filter === 'all' || filter === 'mood' ? ["nobody's here rn", "they'll pop up here"] : filter === 'm' ? ['no guys online rn', null] : ['no girls online rn', null]

  return (
    <div className="lobby">
      {!desktop && (
        <header className="m-head">
          <Wordmark size={22} />
          <div className="m-head-actions">
            <Link href="/rooms" className="icon-btn dm-btn" aria-label="rooms">
              <IconRooms size={25} />
              <Badge n={roomsUnread} className="dm-badge" />
            </Link>
            <Link href="/dm" className="icon-btn dm-btn" aria-label="chats">
              <IconDm size={25} />
              <Badge n={unread} className="dm-badge" />
            </Link>
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
          value={filter}
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
        {list.length === 0 ? (
          <motion.div className="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="empty-face">
              <GoofyFace name="sleepy.zzz" size={132} mood="sleepy" />
              <span className="zzz">z</span>
            </div>
            <p className="empty-title">{emptyCopy[0]}</p>
            {emptyCopy[1] && <p className="empty-sub">{emptyCopy[1]}</p>}
            <div className="empty-acts">
              <Link href="/rooms" className="empty-act is-ink">
                hop in a room
              </Link>
              <button type="button" className="empty-act" onClick={share}>
                {copied ? 'link copied' : 'bring a friend'}
              </button>
            </div>
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
        {ghost ? null : queue ? (
          <motion.button key="q" type="button" className="roll is-queue" onClick={() => setQueue(false)} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={spring}>
            <span className="roll-dot" />
            finding a match{lookers.length > 1 ? '' : '...'} · tap to stop
          </motion.button>
        ) : (
          pool.length >= 1 && (
            <motion.button
              key="r"
              type="button"
              className="roll"
              onClick={() => (held.current ? (held.current = false) : pool.length >= 2 ? roll() : landed(pool[0]))}
              onPointerDown={diceDown}
              onPointerUp={diceUp}
              onPointerLeave={diceUp}
              onPointerCancel={diceUp}
              onContextMenu={(e) => e.preventDefault()}
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
