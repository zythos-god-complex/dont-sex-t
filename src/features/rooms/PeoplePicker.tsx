import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Profile } from '../../lib/types'
import { GoofyFace } from '../../ui/GoofyFace'
import { TypingDots } from '../../ui/kit'
import { IconCheck, IconClose } from '../../ui/icons'
import { searchUsers } from './rooms'

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
  const on = (id: string) => picked.some((p) => p.id === id)
  const toggle = (p: Profile) => {
    navigator.vibrate?.(6)
    onChange(on(p.id) ? picked.filter((x) => x.id !== p.id) : [...picked, p])
  }
  const shown = res.filter((p) => !exclude.includes(p.id))
  return (
    <div>
      <input
        className="rs-name rs-search"
        value={q}
        onChange={(e) => setQ(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20))}
        placeholder="search usernames"
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
            <button key={p.id} type="button" className={'rs-user' + (on(p.id) ? ' is-on' : '')} onClick={() => toggle(p)}>
              <GoofyFace name={p.username} size={40} />
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
