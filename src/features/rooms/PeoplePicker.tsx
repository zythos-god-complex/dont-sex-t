import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Profile } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { TypingDots } from '../../ui/kit'
import { IconCheck, IconClose } from '../../ui/icons'
import { searchUsers } from './rooms'
import { useStore } from '../../lib/store'
import { useShallow } from 'zustand/react/shallow'
import { useBlocks } from '../../lib/engine'

/** Username search with toggleable picks. `exclude` hides people already in the room. */
export function PeoplePicker({ picked, onChange, exclude = [] }: { picked: Profile[]; onChange: (p: Profile[]) => void; exclude?: string[] }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setRes([])
      setBusy(false)
      return
    }
    const n = ++seq.current
    setBusy(true)
    const t = setTimeout(() => {
      searchUsers(term)
        .then((r) => n === seq.current && setRes(r))
        .catch(() => {})
        .finally(() => n === seq.current && setBusy(false))
    }, 180)
    return () => clearTimeout(t)
  }, [q])
  const blocked = useBlocks((b) => b.blocked)
  const blockedBy = useBlocks((b) => b.blockedBy)
  const hide = (id: string) => exclude.includes(id) || blocked.includes(id) || blockedBy.includes(id)
  // people you already talk to: friends first, then the rest of your chats, newest first
  const known = useStore(
    useShallow((s) => {
      const list = Object.values(s.conversations).filter((c) => !c.blocked && c.status !== 'pending' && c.status !== 'declined' && c.last_message)
      const friend = (c: (typeof list)[number]) => (c.my_friend && c.peer_friend ? 1 : 0)
      return list
        .sort((a, b) => friend(b) - friend(a) || (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
        .map((c) => c.peer)
        .slice(0, 16)
    }),
  )
  const online = useStore((s) => s.online)
  const on = (id: string) => picked.some((p) => p.id === id)
  const toggle = (p: Profile, fromSearch = false) => {
    navigator.vibrate?.(6)
    onChange(on(p.id) ? picked.filter((x) => x.id !== p.id) : [...picked, p])
    if (fromSearch) setQ('')
  }
  const shown = (q.trim() ? res : known).filter((p) => !hide(p.id)).slice(0, 12)
  return (
    <div>
      <input
        className="rs-name rs-search"
        value={q}
        onChange={(e) => setQ(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20))}
        placeholder="search a username"
        aria-label="search usernames"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {picked.length > 0 && (
        <div className="rs-chips">
          <AnimatePresence initial={false}>
            {picked.map((p) => (
              <motion.button key={p.id} type="button" className="rs-chip" layout initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => toggle(p)}>
                <GoofyFace name={p.username} size={26} blink={false} />
                {p.username}
                <IconClose size={14} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="rs-results">
        {busy && !shown.length ? (
          <span style={{ alignSelf: 'center', padding: 14 }}>
            <TypingDots />
          </span>
        ) : (
          shown.map((p) => (
            <button key={p.id} type="button" className={'rs-user' + (on(p.id) ? ' is-on' : '')} onClick={() => toggle(p, !!q.trim())}>
              <GoofyFace name={p.username} size={40} presence={online[p.id] ? 'online' : null} />
              <span className="grow ellipsis">{p.username}</span>
              <span className="rs-check">{on(p.id) && <IconCheck size={16} />}</span>
            </button>
          ))
        )}
        {!busy && q.trim() && !shown.length && <span className="empty-sub" style={{ alignSelf: 'center', padding: 14 }}>nobody by that name</span>}
      </div>
    </div>
  )
}
