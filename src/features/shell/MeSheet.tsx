import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../lib/hooks'
import { forgetMe, logout, makeKey, renameMe, saveAvatar, saveBirth, saveFlair, saveNsfw, savePrivacy } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Sheet, Toggle } from '../../ui/kit'
import { IconBrush } from '../../ui/icons'
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
  const years = Array.from({ length: now.getFullYear() - 1920 + 1 }, (_, i) => now.getFullYear() - i)
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
        stamp it
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
        {HATS.map((h) => (
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
        {AURAS.map((a) => (
          <button key={a} type="button" className={'fl-chip' + ((f.aura ?? 'none') === a ? ' is-on' : '')} aria-label={a} onClick={() => void saveFlair({ aura: a })}>
            {a === 'none' ? 'off' : <Aura id={a} />}
          </button>
        ))}
      </div>
    </>
  )
}

const VALID = /^[A-Za-z0-9_.]{3,20}$/

function MeBody({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const [passport, setPassport] = useState(false)
  const [face, setFace] = useState<AvatarConfig | null>(null)
  const [name, setName] = useState(me?.username ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
          void saveAvatar(face)
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
      setErr(isApiError(e) && e.code === 'username_taken' ? 'taken, try another' : 'something broke, try again')
    }
    setBusy(false)
  }

  return (
    <div className="me">
      <div className="me-face">
        <GoofyFace name={me.username} avatar={current} size={112} mood="happy" />
        {!temp && (
          <button
            type="button"
            className="ob-face-btn ob-brush me-edit"
            aria-label="edit face"
            onClick={() => {
              setFace(current)
              setEditing(true)
            }}
          >
            <IconBrush size={22} />
          </button>
        )}
      </div>
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
      <h3 className="settings-label">privacy</h3>
      <div className="settings-row">
        <span className="grow">show active status</span>
        <Toggle label="show active status" on={me.show_status !== false} onChange={(v) => void savePrivacy(v, null)} />
      </div>
      <div className="settings-row" style={{ marginTop: 8 }}>
        <span className="grow">show seen</span>
        <Toggle label="show seen" on={me.show_seen !== false} onChange={(v) => void savePrivacy(null, v)} />
      </div>
      <Account />
      <button type="button" className="fb-done" style={{ marginTop: 18 }} onClick={onClose}>
        done
      </button>
    </div>
  )
}

export function MeButton({ size = 32 }: { size?: number }) {
  const me = useMe()
  const [open, setOpen] = useState(false)
  if (!me) return null
  return (
    <>
      <button type="button" className="me-btn" aria-label="your profile" onClick={() => setOpen(true)}>
        <GoofyFace name={me.username} size={size} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="your profile">
        <MeBody onClose={() => setOpen(false)} />
      </Sheet>
    </>
  )
}
