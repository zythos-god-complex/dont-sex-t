import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation } from 'wouter'
import { motion } from 'motion/react'
import { useMe, useNow } from '../../lib/hooks'
import { relTime } from '../../lib/format'
import type { Profile } from '../../lib/types'
import { getTheme } from '../../themes/themes'
import { useThemeMode } from '../../themes/mode'
import { Badge, Sheet, spring, useIsDesktop } from '../../ui/kit'
import { IconPlus } from '../../ui/icons'
import { MeButton } from '../shell/MeSheet'
import { CoinChip } from '../shop/Coin'
import { displayBody } from '../stickers/stickers'
import { Crew, Faces } from './Crew'
import { PeoplePicker } from './PeoplePicker'
import { createRoom, loadRooms, useRoomList, useRooms, type Room, type RoomMsg } from './rooms'

export function lastLine(m: RoomMsg | null, meId: string | null | undefined): string {
  if (!m || m.kind === 'removed') return ''
  const who = m.sender_id === meId ? 'you' : m.sender?.username ?? ''
  return `${who}: ${displayBody(m.body).replace(/\s+/g, ' ')}`
}

function PublicCard({ r, meId, i }: { r: Room; meId: string | null; i: number }) {
  const [, nav] = useLocation()
  const t = getTheme(r.theme, useThemeMode())
  const here = useRooms((s) => s.here[r.id] ?? 0)
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
      <Crew seed={r.seed} size={64} />
      <span className="pub-main">
        <span className="pub-name">{r.name}</span>
        <span className="pub-last ellipsis">{lastLine(r.last_message, meId) || (here > 0 ? `${here} here` : '')}</span>
      </span>
      {r.unread > 0 && <span className="pub-dot" />}
    </motion.button>
  )
}

function PrivateRow({ r, meId, now }: { r: Room; meId: string | null; now: number }) {
  const [, nav] = useLocation()
  const fresh = useRooms((s) => s.unseen.includes(r.id))
  const people = useRooms((s) => s.people[r.id])
  const when = r.last_message_at ?? r.last_message?.created_at ?? null
  return (
    <motion.button layout="position" transition={spring} className={'row-item' + (r.unread || fresh ? ' is-unread' : '')} onClick={() => nav('/rooms/' + r.id)}>
      {people?.length ? <Faces names={people.map((p) => p.username)} size={40} /> : <Crew seed={r.seed} size={54} count={(r.members ?? 3) >= 3 ? 3 : 2} still />}
      <span className="row-main">
        <span className="row-name ellipsis">{r.name}</span>
        <span className="row-preview ellipsis">{lastLine(r.last_message, meId) || `${r.members ?? 1} people`}</span>
      </span>
      <span className="row-side">
        {fresh ? <span className="row-new">new</span> : when && <span className="row-time tnum">{relTime(when, now)}</span>}
        <Badge n={r.unread} />
      </span>
    </motion.button>
  )
}

export function CreateRoomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, nav] = useLocation()
  const me = useMe()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (open) {
      setName('')
      setPicked([])
      setErr(false)
    }
  }, [open])
  // people are the point; the name is optional and defaults to who's in it
  const fallback = picked.map((p) => p.username).join(', ').slice(0, 40)
  const ready = !!name.trim() || picked.length > 0
  const go = async () => {
    if (!ready || busy) return
    setBusy(true)
    setErr(false)
    try {
      const r = await createRoom(name.trim() || fallback, picked.map((p) => p.id))
      onClose()
      nav('/rooms/' + r.id)
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} label="new room">
      <div className="settings">
        <div className="rs-head is-row">
          <Faces names={[me?.username ?? '', ...picked.map((p) => p.username)]} size={44} />
          <span className="rs-title ellipsis">{name.trim() || fallback || 'new room'}</span>
        </div>
        <h3 className="settings-label">people</h3>
        <PeoplePicker picked={picked} onChange={setPicked} />
        <h3 className="settings-label">name</h3>
        <input className="rs-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} enterKeyHint="done" placeholder={fallback || 'the group chat'} aria-label="room name" />
        <button type="button" className="rs-go is-sticky" disabled={!ready || busy} onClick={() => void go()}>
          {err ? 'try again' : picked.length ? `create with ${picked.length}` : 'create'}
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
  const newRow = (
    <button type="button" className={'new-room' + (mine.length ? ' is-row' : '')} onClick={() => setCreate(true)}>
      <span className="new-room-plus">
        <IconPlus size={22} />
      </span>
      new room
    </button>
  )
  const yours = (
    <>
      <h3 className="rooms-label">yours</h3>
      {mine.length > 0 && newRow}
      {mine.map((r) => (
        <PrivateRow key={r.id} r={r} meId={me?.id ?? null} now={now} />
      ))}
      {!mine.length && newRow}
    </>
  )
  return (
    <div className="rooms">
      <header className="m-head">
        <h1 className="m-title is-left">rooms</h1>
        <div className="m-head-actions">
          {!desktop && (
            <>
              <CoinChip />
              <MeButton />
            </>
          )}
        </div>
      </header>
      <div className="rooms-scroll scroll-y">
        {/* your rooms (with the unread ones) come first once you have any */}
        {mine.length > 0 && yours}
        <h3 className="rooms-label">public</h3>
        <div className="pub-grid">
          {pub.map((r, i) => (
            <PublicCard key={r.id} r={r} meId={me?.id ?? null} i={i} />
          ))}
          {!loaded && !pub.length && [0, 1, 2].map((i) => <div key={i} className="pub-card" style={{ height: 76, opacity: 0.4 }} />)}
        </div>
        {!mine.length && yours}
      </div>
      <CreateRoomSheet open={create} onClose={() => setCreate(false)} />
    </div>
  )
}
