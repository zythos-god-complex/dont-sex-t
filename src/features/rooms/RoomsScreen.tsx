import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'wouter'
import { motion } from 'motion/react'
import { useMe, useNow } from '../../lib/hooks'
import { relTime } from '../../lib/format'
import type { Profile } from '../../lib/types'
import { getTheme } from '../../themes/themes'
import { useThemeMode } from '../../themes/mode'
import { Badge, Sheet, spring, useIsDesktop } from '../../ui/kit'
import { IconBack, IconPlus } from '../../ui/icons'
import { displayBody } from '../stickers/stickers'
import { Crew } from './Crew'
import { PeoplePicker } from './PeoplePicker'
import { createRoom, loadRooms, useRoomList, useRooms, type Room, type RoomMsg } from './rooms'

export function lastLine(m: RoomMsg | null, meId: string | null | undefined): string {
  if (!m) return ''
  const who = m.sender_id === meId ? 'you' : m.sender?.username ?? ''
  return `${who}: ${displayBody(m.body).replace(/\s+/g, ' ')}`
}

function PublicCard({ r, meId, i }: { r: Room; meId: string | null; i: number }) {
  const [, nav] = useLocation()
  const t = getTheme(r.theme, useThemeMode())
  return (
    <motion.button
      className="pub-card"
      style={{ '--card-bg': t.scheme === 'dark' ? t.composer : t.recv, '--card-ink': t.ink, background: t.bg } as CSSProperties}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay: i * 0.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => nav('/rooms/' + r.id)}
    >
      <Crew seed={r.seed} size={96} />
      <span className="pub-main">
        <span className="pub-name">{r.name}</span>
        <span className="pub-last ellipsis">{lastLine(r.last_message, meId) || 'be the first to yap'}</span>
      </span>
      {r.unread > 0 && <span className="pub-dot" />}
    </motion.button>
  )
}

function PrivateRow({ r, meId, now }: { r: Room; meId: string | null; now: number }) {
  const [, nav] = useLocation()
  return (
    <motion.button layout="position" transition={spring} className={'row-item' + (r.unread ? ' is-unread' : '')} onClick={() => nav('/rooms/' + r.id)}>
      <Crew seed={r.seed} size={54} count={(r.members ?? 3) >= 3 ? 3 : 2} still />
      <span className="row-main">
        <span className="row-name ellipsis">{r.name}</span>
        <span className="row-preview ellipsis">{lastLine(r.last_message, meId) || `${r.members ?? 1} people`}</span>
      </span>
      <span className="row-side">
        <span className="row-time tnum">{relTime(r.last_message_at ?? r.last_message?.created_at ?? new Date().toISOString(), now)}</span>
        <Badge n={r.unread} />
      </span>
    </motion.button>
  )
}

export function CreateRoomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, nav] = useLocation()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setName('')
      setPicked([])
    }
  }, [open])
  const go = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const r = await createRoom(name.trim(), picked.map((p) => p.id))
      onClose()
      nav('/rooms/' + r.id)
    } catch {
      /* stays open */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="new room">
      <div className="settings">
        <div className="rs-head">
          <Crew seed={name.length * 131 + picked.length * 17 + 7} size={110} count={picked.length >= 2 ? 3 : 2} />
          <span className="rs-title">{name.trim() || 'new room'}</span>
        </div>
        <h3 className="settings-label">name</h3>
        <input className="rs-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="the group chat" aria-label="room name" />
        <h3 className="settings-label">people</h3>
        <PeoplePicker picked={picked} onChange={setPicked} />
        <button type="button" className="rs-go" disabled={!name.trim() || busy} onClick={() => void go()}>
          {picked.length ? `create with ${picked.length}` : 'create'}
        </button>
      </div>
    </Sheet>
  )
}

export default function RoomsScreen() {
  const desktop = useIsDesktop()
  const me = useMe()
  const list = useRoomList()
  const loaded = useRooms((s) => s.loaded)
  const now = useNow(30000)
  const [create, setCreate] = useState(false)
  useEffect(() => {
    void loadRooms()
    const t = setInterval(() => document.visibilityState === 'visible' && void loadRooms(), 15000)
    return () => clearInterval(t)
  }, [])
  const pub = list.filter((r) => r.kind === 'public')
  const mine = list.filter((r) => r.kind === 'private')
  return (
    <div className="rooms">
      <header className="m-head">
        {!desktop ? (
          <Link href="/" className="icon-btn" aria-label="back">
            <IconBack size={26} />
          </Link>
        ) : (
          <span className="icon-btn-spacer" />
        )}
        <h1 className="m-title">rooms</h1>
        <button type="button" className="icon-btn" aria-label="new room" onClick={() => setCreate(true)}>
          <IconPlus size={26} />
        </button>
      </header>
      <div className="rooms-scroll scroll-y">
        <h3 className="rooms-label">public</h3>
        <div className="pub-grid">
          {pub.map((r, i) => (
            <PublicCard key={r.id} r={r} meId={me?.id ?? null} i={i} />
          ))}
          {!loaded && !pub.length && [0, 1, 2].map((i) => <div key={i} className="pub-card" style={{ height: 110, opacity: 0.4 }} />)}
        </div>
        <h3 className="rooms-label">yours</h3>
        {mine.map((r) => (
          <PrivateRow key={r.id} r={r} meId={me?.id ?? null} now={now} />
        ))}
        <button type="button" className="new-room" onClick={() => setCreate(true)}>
          <span className="new-room-plus">
            <IconPlus size={22} />
          </span>
          new room
        </button>
      </div>
      <CreateRoomSheet open={create} onClose={() => setCreate(false)} />
    </div>
  )
}
