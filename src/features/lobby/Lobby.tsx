import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'wouter'
import { AnimatePresence, motion } from 'motion/react'
import { useNow, useOnline, useTypingToMe, useUnreadFrom, useUnreadTotal, type OnlineFilter } from '../../lib/hooks'
import { hereFor } from '../../lib/format'
import type { OnlineUser } from '../../lib/types'
import { GoofyFace, useLookAt } from '../../ui/GoofyFace'
import { faceTilt } from '../../ui/face'
import { Badge, Segmented, TypingDots, Wordmark, spring, useIsDesktop } from '../../ui/kit'
import { GenderIcon, IconDm, IconRooms } from '../../ui/icons'
import { loadRooms, useRoomsUnread } from '../rooms/rooms'
import { MeButton } from '../shell/MeSheet'
import { useBlocks } from '../../lib/engine'
import { useStore } from '../../lib/store'

function Card({ u, now }: { u: OnlineUser; now: number }) {
  const [, nav] = useLocation()
  const typing = useTypingToMe(u.id)
  const unread = useUnreadFrom(u.id)
  const [ref, look] = useLookAt<HTMLButtonElement>()
  const tilt = faceTilt(u.username, 1.6)
  const showStatus = useStore((s) => s.me?.show_status !== false && s.profiles[u.id]?.show_status !== false && u.show_status !== false)
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
      onClick={() => nav('/dm/' + encodeURIComponent(u.username))}
    >
      {unread > 0 && <Badge n={unread} className="card-badge" />}
      <span className="card-face">
        <GoofyFace name={u.username} size={104} presence={showStatus ? (u.away ? 'away' : 'online') : null} look={look} />
      </span>
      <span className="card-name ellipsis">{u.username}</span>
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
  const [filter, setFilter] = useState<OnlineFilter>('all')
  const { list: all, counts } = useOnline(filter)
  const blocked = useBlocks((b) => b.blocked)
  const blockedBy = useBlocks((b) => b.blockedBy)
  const list = all.filter((u) => !blocked.includes(u.id) && !blockedBy.includes(u.id))
  const unread = useUnreadTotal()
  const roomsUnread = useRoomsUnread()
  useEffect(() => void loadRooms(), [])
  const now = useNow(30000)

  const emptyCopy =
    filter === 'all' ? ["nobody's here rn", "they'll pop up here"] : filter === 'm' ? ['no guys online rn', null] : ['no girls online rn', null]

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
            <Link href="/dm" className="icon-btn dm-btn" aria-label="dms">
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
            live <span className="tnum d-count">{counts.all}</span>
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
    </div>
  )
}
