import { useEffect, useState } from 'react'
import { isPhoto } from '../../ui/photoUrl'
import { uploadPhoto } from '../profile/photo'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../lib/hooks'
import { useLocation } from 'wouter'
import { useStore } from '../../lib/store'
import { useShallow } from 'zustand/react/shallow'
import { pendingPhoto, saveAbout, saveGhost, saveMood, submitPhoto, useGhost, useMood } from '../../lib/engine'
import { connectSpotify, disconnectSpotify, spotifyEnabled, useSpotify } from '../../lib/spotify'
import { NowPlaying } from '../music/NowPlaying'
import type { FaceMood } from '../../ui/GoofyFace'
import { forgetMe, logout, setBlocked, useBlocks, makeKey, renameMe, saveAvatar, saveBirth, saveFlair, saveNsfw, savePrivacy } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Sheet, Toggle } from '../../ui/kit'
import { IconBrush, IconCrown, IconSpotify } from '../../ui/icons'
import { avatarFromTraits, faceTraits, type AvatarConfig } from '../../ui/face'
import { FaceBuilder } from '../onboarding/FaceBuilder'
import { ProfileCardView } from '../profile/ProfileCard'
import { AURAS, Aura, CARDS } from '../../ui/Aura'
import type { CSSProperties } from 'react'
import type { HatId } from '../../lib/types'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Age passport: birth month + year, stamped once. 18+ unlocks nsfw. */
function Passport({ onDone }: { onDone: () => void }) {
  const me = useMe()
  const now = new Date()
  const [month, setMonth] = useState(0)
  const [year, setYear] = useState(0)
  const [stamp, setStamp] = useState<'adult' | 'minor' | null>(null)
  const [busy, setBusy] = useState(false)
  if (!me) return null
  // nobody here is under 13, and starting the list there stops a one-tap "born this year" mistake
  const years = Array.from({ length: now.getFullYear() - 13 - 1920 + 1 }, (_, i) => now.getFullYear() - 13 - i)
  const age = month && year ? now.getFullYear() - year - (now.getMonth() + 1 < month ? 1 : 0) : null
  const go = async () => {
    if (!month || !year || busy) return
    setBusy(true)
    try {
      const m = await saveBirth(year, month)
      const adult = !!m?.adult
      setStamp(adult ? 'adult' : 'minor')
      if (adult) await saveNsfw(true).catch(() => {})
      setTimeout(onDone, 1600)
    } catch {
      setBusy(false)
    }
  }
  return (
    <div className="pp">
      <div className="pp-card">
        <span className="pp-title">goof passport</span>
        <div className="pp-row">
          <span className="pp-photo">
            <GoofyFace name={me.username} size={64} blink={false} />
          </span>
          <span className="pp-name">{me.username}</span>
        </div>
        <div className="pp-born">
          <select value={month} onChange={(e) => setMonth(+e.target.value)} aria-label="birth month" disabled={!!stamp}>
            <option value={0}>month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} aria-label="birth year" disabled={!!stamp}>
            <option value={0}>year</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {stamp && <span className={'pp-stamp ' + stamp}>{stamp === 'adult' ? '18+' : 'under 18'}</span>}
      </div>
      <p className="pp-note">set once, can't be changed</p>
      <button type="button" className="fb-done" disabled={!month || !year || busy} onClick={go}>
        {age === null ? 'stamp it' : `stamp it, i'm ${age}`}
      </button>
      <button type="button" className="pp-back" onClick={onDone}>
        not now
      </button>
    </div>
  )
}

/** Recovery key, sign out, forget me. */
function Account() {
  const me = useMe()
  const [words, setWords] = useState<string | null>(null)
  const [arm, setArm] = useState<'out' | 'forget' | null>(null)
  if (!me) return null
  const temp = !!me.temp
  return (
    <>
      <h3 className="settings-label">account</h3>
      {!temp && (
        <div className="settings-row">
          <span className="grow">recovery key</span>
          <button type="button" className="acc-btn" onClick={() => void makeKey().then(setWords).catch(() => {})}>
            {me.has_key ? 'new key' : 'make key'}
          </button>
        </div>
      )}
      {words && (
        <div className="acc-key">
          <span className="acc-words">{words}</span>
          <button type="button" className="acc-btn" onClick={() => void navigator.clipboard?.writeText(me.username + ': ' + words).catch(() => {})}>
            copy
          </button>
        </div>
      )}
      <div className="acc-danger">
        {!temp && me.has_key && (
          <button type="button" className={'acc-out' + (arm === 'out' ? ' is-armed' : '')} onClick={() => (arm === 'out' ? logout() : setArm('out'))}>
            {arm === 'out' ? 'tap again to sign out' : 'sign out'}
          </button>
        )}
        <button type="button" className={'acc-forget' + (arm === 'forget' ? ' is-armed' : '')} onClick={() => (arm === 'forget' ? void forgetMe() : setArm('forget'))}>
          {arm === 'forget' ? 'tap again, gone forever' : 'forget me'}
        </button>
      </div>
    </>
  )
}

const HATS: HatId[] = ['none', 'crown', 'cap', 'beanie', 'halo', 'bow', 'tophat', 'party']

/** Perk users only: hat, card colours, live nameplate, bio. */
function FlairEditor() {
  const me = useMe()
  const [bio, setBio] = useState(me?.flair?.bio ?? '')
  if (!me?.vip) return null
  const f = me.flair ?? {}
  const hat = f.hat ?? 'none'
  return (
    <>
      <h3 className="settings-label">flair</h3>
      <ProfileCardView name={me.username} flair={{ ...f, bio }} />
      <h3 className="settings-label">hat</h3>
      <div className="fl-grid">
        {HATS.concat(me.admin ? ['neo'] : []).map((h) => (
          <button key={h} type="button" className={'fl-opt' + (hat === h ? ' is-on' : '')} aria-label={h} onClick={() => void saveFlair({ hat: h })}>
            <GoofyFace name={me.username} hat={h} size={44} blink={false} />
          </button>
        ))}
      </div>
      <h3 className="settings-label">bio</h3>
      <textarea
        className="fl-bio"
        maxLength={140}
        value={bio}
        aria-label="bio"
        onChange={(e) => setBio(e.target.value)}
        onBlur={() => bio !== (f.bio ?? '') && void saveFlair({ bio })}
      />
      <h3 className="settings-label">card</h3>
      <div className="fl-chips">
        {CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'fl-swatch' + ((f.card ?? 'ink') === c.id ? ' is-on' : '')}
            style={{ '--sw-bg': c.bg, '--sw-edge': c.edge } as CSSProperties}
            aria-label={c.id}
            onClick={() => void saveFlair({ card: c.id })}
          />
        ))}
      </div>
      <h3 className="settings-label">nameplate</h3>
      <div className="fl-chips">
        {AURAS.filter((a) => a !== 'matrix' || me.admin).map((a) => (
          <button key={a} type="button" className={'fl-chip' + ((f.aura ?? 'none') === a ? ' is-on' : '')} aria-label={a} onClick={() => void saveFlair({ aura: a })}>
            {a === 'none' ? 'off' : <Aura id={a} />}
          </button>
        ))}
      </div>
    </>
  )
}

const VALID = /^[A-Za-z0-9_.]{3,20}$/

const MOODS: FaceMood[] = ['happy', 'sleepy', 'angry', 'smug', 'shocked', 'wink', 'disgust', 'kiss', 'flirty']

function MoodRow({ name, spicy }: { name: string; spicy: boolean }) {
  const cur = useMood((s) => (s.mood && s.mood.until > Date.now() ? s.mood : null))
  const [busy, setBusy] = useState(false)
  const pick = (m: string) => {
    setBusy(true)
    saveMood(cur?.mood === m ? null : m).catch(() => {}).finally(() => setBusy(false))
  }
  const left = cur ? Math.max(1, Math.round((cur.until - Date.now()) / 60e3)) : 0
  return (
    <>
      <h3 className="settings-label">mood rn{cur && <span className="mood-left"> {left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`} left</span>}</h3>
      <div className="mood-row">
        {MOODS.filter((m) => spicy || (m !== 'flirty' && m !== 'kiss')).map((m) => (
          <button key={m} type="button" className={'mood-opt' + (cur?.mood === m ? ' is-on' : '')} disabled={busy} onClick={() => pick(m)} aria-label={m}>
            <GoofyFace name={name} size={40} mood={m} blink={false} />
          </button>
        ))}
      </div>
    </>
  )
}

function GhostRow() {
  const on = useGhost((g) => g.on)
  const [busy, setBusy] = useState(false)
  return (
    <div className="settings-row" style={{ marginTop: 8 }}>
      <span className="grow">
        ghost browse
        <small className="settings-sub">off the board, replies only</small>
      </span>
      <Toggle label="ghost browse" on={on} disabled={busy} onChange={(v) => { setBusy(true); saveGhost(v).catch(() => {}).finally(() => setBusy(false)) }} />
    </div>
  )
}

function PhotoButton({ current }: { current: AvatarConfig }) {
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState<string | null>(null)
  const has = isPhoto(current.photo)
  useEffect(() => {
    let on = true
    pendingPhoto().then((u) => on && setWait(isPhoto(u) ? u : null), () => {})
    return () => {
      on = false
    }
  }, [])
  const pick = () => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*'
    el.onchange = () => {
      const f = el.files?.[0]
      if (!f || !f.type.startsWith('image/')) return
      setBusy(true)
      uploadPhoto(f)
        .then((url) => submitPhoto(url))
        .then((u) => setWait(isPhoto(u) ? u : null))
        .catch(() => {})
        .finally(() => setBusy(false))
    }
    el.click()
  }
  if (wait)
    return (
      <div className="me-photo">
        <span className="me-photo-wait">
          <img src={wait} alt="" />
          in review
        </span>
        <button
          type="button"
          className="acc-btn"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            submitPhoto(null)
              .then(() => setWait(null))
              .catch(() => {})
              .finally(() => setBusy(false))
          }}
        >
          cancel
        </button>
      </div>
    )
  return (
    <div className="me-photo">
      <button type="button" className="acc-btn" disabled={busy} onClick={pick}>
        {busy ? 'uploading...' : has ? 'change photo' : 'use a photo'}
      </button>
      {has && (
        <button type="button" className="acc-btn" disabled={busy} onClick={() => void saveAvatar({ ...current, photo: null })}>
          back to face
        </button>
      )}
    </div>
  )
}

function Music() {
  const connected = useSpotify((s) => s.connected)
  const track = useSpotify((s) => s.track)
  return (
    <>
      <h3 className="settings-label">music</h3>
      {connected ? (
        <>
          {track ? (
            <NowPlaying track={track} />
          ) : (
            <p className="settings-hint">nothing playing on spotify right now</p>
          )}
          <button type="button" className="block-btn" style={{ marginTop: 10 }} onClick={() => disconnectSpotify()}>
            disconnect spotify
          </button>
        </>
      ) : (
        <button type="button" className="acc-btn sp-connect" onClick={() => void connectSpotify()}>
          <IconSpotify size={18} /> connect spotify
        </button>
      )}
    </>
  )
}

function About() {
  const me = useMe()
  const [place, setPlace] = useState(me?.place ?? '')
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const save = (p: string, show: boolean) => {
    setBusy(true)
    saveAbout(p, show).catch(() => {}).finally(() => setBusy(false))
  }
  const dirty = place.trim() !== (me.place ?? '')
  return (
    <>
      <h3 className="settings-label">about you</h3>
      <div className="about-row">
        <input className="about-input" value={place} maxLength={30} placeholder="city or place (optional)" onChange={(e) => setPlace(e.target.value)} />
        {dirty && (
          <button type="button" className="acc-btn" disabled={busy} onClick={() => save(place, me.show_age === true)}>
            save
          </button>
        )}
      </div>
      {me.age_set && (
        <div className="settings-row" style={{ marginTop: 8 }}>
          <span className="grow">show my age</span>
          <Toggle label="show my age" on={me.show_age === true} disabled={busy} onChange={(v) => save(me.place ?? '', v)} />
        </div>
      )}
    </>
  )
}

function Blocked() {
  const ids = useBlocks((b) => b.blocked)
  const names = useStore(useShallow((s) => ids.map((id) => s.profiles[id]?.username ?? Object.values(s.conversations).find((c) => c.peer.id === id)?.peer.username ?? '')))
  if (!ids.length) return null
  return (
    <>
      <h3 className="settings-label">blocked</h3>
      <div className="blk-list">
        {ids.map((id, i) => (
          <div key={id} className="blk">
            <span className="blk-face">
              <GoofyFace name={names[i] || id} size={44} blink={false} hat={null} />
              <span className="blk-tape" aria-hidden="true" />
            </span>
            <span className="blk-name ellipsis">{names[i] || 'someone'}</span>
            <button type="button" className="acc-btn" onClick={() => void setBlocked(id, false)}>
              unblock
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function MeBody({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const [passport, setPassport] = useState(false)
  const [face, setFace] = useState<AvatarConfig | null>(null)
  const [name, setName] = useState(me?.username ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, nav] = useLocation()
  useEffect(() => setName(me?.username ?? ''), [me?.username])
  if (!me) return null
  const temp = !!me.temp
  const current = me.avatar ?? avatarFromTraits(faceTraits(me.username))

  if (passport) return <Passport onDone={() => setPassport(false)} />
  if (editing && face)
    return (
      <FaceBuilder
        name={me.username}
        value={face}
        onChange={setFace}
        onDone={() => {
          void saveAvatar({ ...face, photo: null })
          setEditing(false)
        }}
      />
    )

  const dirty = name !== me.username
  const saveName = async () => {
    if (!VALID.test(name)) return setErr('3 to 20 letters, numbers, _ or .')
    setBusy(true)
    try {
      await renameMe(name)
      setErr(null)
    } catch (e) {
      setErr(isApiError(e, 'username_taken') ? 'taken, try another' : isApiError(e, 'rename_cooldown') ? 'one rename a week' : 'something broke, try again')
    }
    setBusy(false)
  }

  return (
    <div className="me">
      <div className="me-face">
        <GoofyFace name={me.username} avatar={current} size={112} />
        {!temp && (
          <button
            type="button"
            className="ob-face-btn ob-brush me-edit"
            aria-label="edit face"
            onClick={() => {
              setFace({ ...current, photo: undefined })
              setEditing(true)
            }}
          >
            <IconBrush size={22} />
          </button>
        )}
      </div>
      {!temp && <PhotoButton current={current} />}
      {temp ? (
        <p className="me-temp">
          {me.username} <span>temp</span>
        </p>
      ) : (
        <div className="me-name">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20))
              setErr(null)
            }}
            aria-label="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <AnimatePresence>
            {dirty && (
              <motion.button type="button" className="me-save" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} disabled={busy} onClick={saveName}>
                save
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
      {err && <p className="ob-error">{err}</p>}
      <FlairEditor />
      <h3 className="settings-label">vibe</h3>
      <div className="settings-row">
        <span className="grow">
          nsfw <small className="nsfw-sub">{me.age_set && !me.adult ? '18+ only' : 'foul language ok'}</small>
        </span>
        <Toggle
          label="nsfw"
          on={me.nsfw === true}
          onChange={(v) => {
            if (v && !me.adult) return void (!me.age_set && setPassport(true))
            void saveNsfw(v).catch(() => {})
          }}
        />
      </div>
      <MoodRow name={me.username} spicy={me.nsfw === true && me.adult === true} />
      {!temp && <About />}
      {spotifyEnabled() && <Music />}
      <h3 className="settings-label">privacy</h3>
      <GhostRow />
      <div className="settings-row">
        <span className="grow">show active status</span>
        <Toggle label="show active status" on={me.show_status !== false} onChange={(v) => void savePrivacy(v, null)} />
      </div>
      <div className="settings-row" style={{ marginTop: 8 }}>
        <span className="grow">show seen</span>
        <Toggle label="show seen" on={me.show_seen !== false} onChange={(v) => void savePrivacy(null, v)} />
      </div>
      <Account />
      <Blocked />
      {me.admin && (
        <button type="button" className="me-admin" onClick={() => { onClose(); nav('/admin') }}>
          <IconCrown size={18} /> control room
        </button>
      )}
      <button type="button" className="fb-done" style={{ marginTop: 18 }} onClick={onClose}>
        done
      </button>
    </div>
  )
}

export function MeButton({ size = 32 }: { size?: number }) {
  const moodRn = useMood((m) => (m.mood && m.mood.until > Date.now() ? (m.mood.mood as FaceMood) : undefined))
  const me = useMe()
  const [open, setOpen] = useState(false)
  if (!me) return null
  return (
    <>
      <button type="button" className="me-btn" aria-label="your profile" onClick={() => setOpen(true)}>
        <GoofyFace name={me.username} size={size} mood={moodRn} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="your profile">
        <MeBody onClose={() => setOpen(false)} />
      </Sheet>
    </>
  )
}
