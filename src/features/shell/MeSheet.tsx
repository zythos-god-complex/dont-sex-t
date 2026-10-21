import { useEffect, useRef, useState } from 'react'
import { isPhoto } from '../../ui/photoUrl'
import { uploadPhoto } from '../profile/photo'
import { AnimatePresence, motion } from 'motion/react'
import { useMe } from '../../lib/hooks'
import { useLocation } from 'wouter'
import { useStore } from '../../lib/store'
import { useShallow } from 'zustand/react/shallow'
import { keepAccount, pendingPhoto, saveAbout, saveBio, saveGhost, saveMood, saveSong, searchSongs, submitPhoto, useGhost, useMood } from '../../lib/engine'
import type { Song } from '../../lib/types'
import { connectSpotify, disconnectSpotify, spotifyEnabled, useSpotify } from '../../lib/spotify'
import { NowPlaying, SongCard } from '../music/NowPlaying'
import type { FaceMood } from '../../ui/GoofyFace'
import { forgetMe, logout, setBlocked, useBlocks, makeKey, renameMe, saveAvatar, saveBirth, saveFlair, saveNsfw, savePrivacy } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { GoofyFace } from '../../ui/GoofyFace'
import { Segmented, Sheet, Toggle, useIsDesktop } from '../../ui/kit'
import { setModePref, useModeStore } from '../../themes/mode'
import { useReward } from '../rewards/Reward'
import { IconArrowRight, IconBrush, IconCheck, IconClose, IconCopy, IconCrown, IconFlame, IconGhost, IconImage, IconLock, IconSpotify } from '../../ui/icons'
import { avatarFromTraits, faceTraits, type AvatarConfig } from '../../ui/face'
import { FaceBuilder } from '../onboarding/FaceBuilder'
import { ProfileCardView } from '../profile/ProfileCard'
import { AURAS, Aura, CARDS } from '../../ui/Aura'
import type { CSSProperties } from 'react'
import type { HatId } from '../../lib/types'
import { peek } from '../profile/peek'
import { closeMeSheet, openMeSheet, useMeSheet, type MeTab } from './meSheet'
import { replayTour } from '../guide/Tour'
import { mailto } from '../../lib/contact'
import { itemById } from '../shop/catalog'
import { askBuy, coinText, openShop, useOwnsFn, useShop } from '../shop/shop'
import { Coin, Lock } from '../shop/Coin'

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
      <button type="button" className="fb-done" disabled={!month || !year || busy} onClick={go}>
        <IconLock size={16} />
        {age === null ? 'stamp it' : `stamp it, i'm ${age}`}
      </button>
      <button type="button" className="pp-back" onClick={onDone}>
        not now
      </button>
    </div>
  )
}

/** first tap arms (red, label ends in '?'), second tap does it; disarms on its own */
function useArm<T extends string>(): [T | null, (k: T) => boolean] {
  const [arm, setArm] = useState<T | null>(null)
  useEffect(() => {
    if (!arm) return
    const t = setTimeout(() => setArm(null), 3000)
    return () => clearTimeout(t)
  }, [arm])
  return [arm, (k: T) => (arm === k ? (setArm(null), true) : (setArm(k), false))]
}

// the 6 words survive closing the sheet until you say you saved them
let shownWords: string | null = null

/** Make or show the recovery key: big words, copy, and an 'i saved it' that puts it away. */
function KeyCard({ words, onWords }: { words: string | null; onWords: (w: string | null) => void }) {
  const me = useMe()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!me) return null
  if (!words && me.has_key) return null
  const make = () => {
    setBusy(true)
    makeKey()
      .then((w) => onWords((shownWords = w)))
      .catch(() => {})
      .finally(() => setBusy(false))
  }
  return (
    <div className="key-card">
      {words ? (
        <>
          <span className="key-words">{words}</span>
          <div className="key-acts">
            <button
              type="button"
              className="acc-btn"
              onClick={() =>
                void navigator.clipboard?.writeText(me.username + ': ' + words).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }, () => {})
              }
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? 'copied' : 'copy'}
            </button>
            <button type="button" className="acc-btn is-main" onClick={() => onWords((shownWords = null))}>
              i saved it
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="key-title">
            <IconLock size={18} /> save your account
          </span>
          <button type="button" className="acc-btn is-main" disabled={busy} onClick={make}>
            {busy ? 'making...' : 'make key'}
          </button>
        </>
      )}
    </div>
  )
}

/** Temp accounts: keep it in place (same chats, friends, streaks), with the name you want. */
function KeepCard() {
  const me = useMe()
  const [name, setName] = useState(me?.username ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const go = async () => {
    if (!VALID.test(name)) return setErr('3 to 20 letters, numbers, _ or .')
    setBusy(true)
    setErr(null)
    try {
      await keepAccount(name)
    } catch (e) {
      setErr(isApiError(e, 'username_taken') ? 'taken, try another' : 'something broke, try again')
    }
    setBusy(false)
  }
  return (
    <div className="keep-card">
      <span className="key-title">
        <IconGhost size={18} /> temp, gone on close
      </span>
      <div className="me-name">
        <input value={name} onChange={(e) => (setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20)), setErr(null))} aria-label="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <button type="button" className="me-save" disabled={busy} onClick={() => void go()}>
          keep it
        </button>
      </div>
      {err && <p className="ob-error">{err}</p>}
    </div>
  )
}

function Account({ onWords }: { onWords: (w: string) => void }) {
  const me = useMe()
  const [arm, tap] = useArm<'out' | 'forget' | 'key'>()
  if (!me) return null
  const temp = !!me.temp
  return (
    <>
      <h3 className="settings-label">account</h3>
      {!temp && me.has_key && !me.admin && (
        <div className="settings-row">
          <span className="grow">recovery key</span>
          <button type="button" className={'acc-btn' + (arm === 'key' ? ' acc-forget is-armed' : '')} onClick={() => tap('key') && void makeKey().then((w) => onWords((shownWords = w))).catch(() => {})}>
            {arm === 'key' ? 'new key?' : 'new key'}
          </button>
        </div>
      )}
      <div className="acc-danger">
        {!temp && me.has_key && (
          <button type="button" className={'acc-out' + (arm === 'out' ? ' is-armed' : '')} onClick={() => tap('out') && logout()}>
            {arm === 'out' ? 'sign out?' : 'sign out'}
          </button>
        )}
        <button type="button" className={'acc-forget' + (arm === 'forget' ? ' is-armed' : '')} onClick={() => tap('forget') && void forgetMe()}>
          {arm === 'forget' ? 'forget me?' : 'forget me'}
        </button>
      </div>
    </>
  )
}

const HATS: HatId[] = ['none', 'cap', 'beanie', 'bow', 'party', 'chef', 'halo', 'tophat', 'cowboy', 'headphones', 'flowercrown', 'wizard', 'crown']

/** hats, card colours and a live nameplate; shop ones show their price and buy right here */
function FlairEditor() {
  const me = useMe()
  const has = useOwnsFn()
  const prices = useShop((s) => s.prices)
  if (!me) return null
  const f = me.flair ?? {}
  const hat = f.hat ?? 'none'
  const face = { ...(me.avatar ?? avatarFromTraits(faceTraits(me.username))), photo: undefined }
  const price = (id: string) => (has(id) ? null : (prices[id] ?? itemById(id)?.price ?? null))
  const use = (kind: 'hat' | 'card' | 'aura', v: string) => {
    const go = () => void saveFlair({ [kind]: v }).catch(() => {})
    if (v !== 'none' && v !== f[kind] && !has(kind + ':' + v)) return askBuy(kind + ':' + v, go)
    go()
  }
  return (
    <>
      <h3 className="settings-label">flair</h3>
      <ProfileCardView name={me.username} flair={f} />
      <h3 className="settings-label">hat</h3>
      <div className="fl-grid">
        {HATS.concat(me.admin ? ['neo'] : []).map((h) => {
          const p = h === 'none' || h === 'neo' || h === hat ? null : price('hat:' + h)
          return (
            <button key={h} type="button" className={'fl-opt' + (hat === h ? ' is-on' : '')} aria-label={h === 'none' ? 'no hat' : h} onClick={() => use('hat', h)}>
              <GoofyFace name={me.username} avatar={face} hat={h} size={44} blink={false} />
              <AnimatePresence initial={false}>
                {p && (
                  <motion.span key="price" className="fl-price tnum" exit={{ y: -8, opacity: 0, scale: 0.7 }}>
                    <Lock size={10} />
                    <Coin size={11} />
                    {coinText(p)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </div>
      <h3 className="settings-label">card</h3>
      <div className="fl-chips">
        <button type="button" className={'fl-chip' + (!f.card || f.card === 'none' ? ' is-on' : '')} onClick={() => use('card', 'none')}>
          off
        </button>
        {CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'fl-swatch' + (f.card === c.id ? ' is-on' : '')}
            style={{ '--sw-bg': c.bg, '--sw-edge': c.edge } as CSSProperties}
            aria-label={c.id + (price('card:' + c.id) && f.card !== c.id ? ', in the shop' : '')}
            onClick={() => use('card', c.id)}
          >
            {f.card !== c.id && price('card:' + c.id) && (
              <span className="fl-coin">
                <Coin size={12} />
              </span>
            )}
          </button>
        ))}
      </div>
      <h3 className="settings-label">nameplate</h3>
      <div className="fl-chips">
        {AURAS.filter((a) => a !== 'matrix' || me.admin).map((a) => (
          <button key={a} type="button" className={'fl-chip' + ((f.aura ?? 'none') === a ? ' is-on' : '')} aria-label={a} onClick={() => use('aura', a)}>
            {a === 'none' ? 'off' : <Aura id={a} />}
            {a !== 'none' && a !== 'matrix' && f.aura !== a && price('aura:' + a) && (
              <span className="fl-coin">
                <Coin size={12} />
              </span>
            )}
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
    <div className="settings-row">
      <span className="grow">ghost browse</span>
      <Toggle label="ghost browse" on={on} disabled={busy} onChange={(v) => { setBusy(true); saveGhost(v).catch(() => {}).finally(() => setBusy(false)) }} />
    </div>
  )
}

/** Your picture: build a face, use a photo (goes to review), or go back to the face. */
function Picture({ current, onBuild }: { current: AvatarConfig; onBuild: () => void }) {
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const me = useMe()
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
      setErr(false)
      uploadPhoto(f)
        .then((url) => submitPhoto(url))
        .then((u) => setWait(isPhoto(u) ? u : null))
        .catch(() => {
          setErr(true)
          setTimeout(() => setErr(false), 3000)
        })
        .finally(() => setBusy(false))
    }
    el.click()
  }
  return (
    <div className="pic">
      <div className="pic-tiles">
        <button type="button" className="pic-tile" onClick={onBuild}>
          <IconBrush size={22} /> build face
        </button>
        <button type="button" className="pic-tile" disabled={busy} onClick={pick}>
          <IconImage size={22} /> {busy ? 'uploading...' : 'photo'}
        </button>
        {has && (
          <button type="button" className="pic-tile" disabled={busy} onClick={() => void saveAvatar({ ...current, photo: null })}>
            <GoofyFace name={me?.username ?? ''} avatar={{ ...current, photo: null }} size={22} blink={false} /> face again
          </button>
        )}
      </div>
      {(wait || err) && (
        <div className={'me-photo-wait' + (err ? ' is-err' : '')}>
          {wait && !err && <img src={wait} alt="" />}
          {err ? "didn't upload" : 'in review'}
          {wait && !err && (
            <button
              type="button"
              className="pic-x"
              aria-label="cancel photo"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                submitPhoto(null)
                  .then(() => setWait(null))
                  .catch(() => {})
                  .finally(() => setBusy(false))
              }}
            >
              <IconClose size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** saves on its own a moment after you stop typing (and when the sheet closes) */
function useAutosave(value: string, saved: string, save: (v: string) => Promise<unknown>): boolean {
  const [ok, setOk] = useState(false)
  const latest = useRef({ value, saved, save })
  latest.current = { value, saved, save }
  useEffect(() => {
    if (value.trim() === saved.trim()) return
    const t = setTimeout(() => {
      void save(value).then(() => {
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }, () => {})
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  useEffect(
    () => () => {
      const l = latest.current
      if (l.value.trim() !== l.saved.trim()) void l.save(l.value).catch(() => {})
    },
    [],
  )
  return ok
}

function BioRow() {
  const me = useMe()
  const saved = me?.bio ?? me?.flair?.bio ?? ''
  const [bio, setBio] = useState(saved)
  const ok = useAutosave(bio, saved, saveBio)
  return (
    <>
      <h3 className="settings-label">
        bio{ok && <IconCheck size={14} className="saved-tick" />}
      </h3>
      <div className="bio-wrap">
        <textarea className="fl-bio" maxLength={140} value={bio} aria-label="bio" onChange={(e) => setBio(e.target.value)} />
        <span className="bio-n tnum">{bio.length}/140</span>
      </div>
    </>
  )
}

function SongRow() {
  const song = useMe()?.song ?? null
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Song[]>([])
  const [st, setSt] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!picking || q.trim().length < 2) {
      setRes([])
      setSt('idle')
      return
    }
    let on = true
    setSt('loading')
    const t = setTimeout(
      () =>
        searchSongs(q.trim()).then(
          (r) => on && (setRes(r), setSt('done')),
          () => on && setSt('error'),
        ),
      300,
    )
    return () => {
      on = false
      clearTimeout(t)
    }
  }, [q, picking, n])
  const pick = (s: Song | null) => {
    setBusy(true)
    saveSong(s)
      .then(() => {
        setPicking(false)
        setQ('')
      })
      .catch(() => {})
      .finally(() => setBusy(false))
  }
  return (
    <>
      <h3 className="settings-label">song</h3>
      {picking ? (
        <div className="song-pick">
          <input className="song-q" value={q} placeholder="search a song" autoFocus onChange={(e) => setQ(e.target.value)} />
          <div className="song-res">
            {st === 'loading' &&
              [0, 1, 2].map((i) => (
                <span key={i} className="song-row is-skel">
                  <i />
                  <span className="np-text">
                    <b />
                    <small />
                  </span>
                </span>
              ))}
            {st === 'done' && res.length === 0 && <p className="song-none">no songs</p>}
            {st === 'error' && (
              <p className="song-none">
                search broke{' '}
                <button type="button" className="acc-btn" onClick={() => setN((x) => x + 1)}>
                  retry
                </button>
              </p>
            )}
            {st === 'done' &&
              res.map((s) => (
                <button key={s.id} type="button" className="song-row" disabled={busy} onClick={() => pick(s)}>
                  <img src={s.img.replace('/600x600bb.', '/100x100bb.')} alt="" loading="lazy" />
                  <span className="np-text">
                    <b className="ellipsis">{s.t}</b>
                    <small className="ellipsis">{s.by}</small>
                  </span>
                </button>
              ))}
          </div>
          <button type="button" className="acc-btn" onClick={() => setPicking(false)}>
            cancel
          </button>
        </div>
      ) : song ? (
        <>
          <SongCard song={song} />
          <div className="song-acts">
            <button type="button" className="acc-btn" onClick={() => setPicking(true)}>
              change
            </button>
            <button type="button" className="acc-btn" disabled={busy} onClick={() => pick(null)}>
              remove
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="acc-btn" onClick={() => setPicking(true)}>
          add a song
        </button>
      )}
    </>
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
            <p className="settings-hint">nothing playing</p>
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
  const ok = useAutosave(place, me?.place ?? '', (p) => saveAbout(p, me?.show_age === true))
  if (!me) return null
  const save = (p: string, show: boolean) => {
    setBusy(true)
    saveAbout(p, show).catch(() => {}).finally(() => setBusy(false))
  }
  return (
    <>
      <h3 className="settings-label">
        about you{ok && <IconCheck size={14} className="saved-tick" />}
      </h3>
      <div className="about-row">
        <input className="about-input" value={place} maxLength={30} placeholder="city or place" onChange={(e) => setPlace(e.target.value)} />
      </div>
      {me.age_set && (
        <div className="settings-row" style={{ marginTop: 8 }}>
          <span className="grow">show my age</span>
          <Toggle label="show my age" on={me.show_age === true} disabled={busy} onChange={(v) => save(place, v)} />
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

/** Your name as text with a pencil; editing swaps in the input with save and cancel. */
function NameRow() {
  const me = useMe()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(me?.username ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  if (!me) return null
  const save = async () => {
    if (name === me.username) return setEdit(false)
    if (!VALID.test(name)) return setErr('3 to 20 letters, numbers, _ or .')
    setBusy(true)
    try {
      await renameMe(name)
      setErr(null)
      setEdit(false)
      setOk(true)
      setTimeout(() => setOk(false), 1200)
    } catch (e) {
      setErr(isApiError(e, 'username_taken') ? 'taken, try another' : isApiError(e, 'rename_cooldown') ? 'one rename a week' : 'something broke, try again')
    }
    setBusy(false)
  }
  if (!edit)
    return (
      <button
        type="button"
        className="me-nm"
        onClick={() => {
          setName(me.username)
          setEdit(true)
        }}
      >
        <span className="ellipsis">{me.username}</span>
        {ok ? <IconCheck size={16} className="saved-tick" /> : <IconBrush size={16} />}
      </button>
    )
  return (
    <div className="me-nm-edit">
      <div className="me-name">
        <input
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20))
            setErr(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          aria-label="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="button" className="me-save" disabled={busy} onClick={() => void save()}>
          save
        </button>
        <button type="button" className="acc-btn" onClick={() => (setEdit(false), setErr(null))}>
          cancel
        </button>
      </div>
      {err && <p className="ob-error">{err}</p>}
    </div>
  )
}

function MeBody({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const desktop = useIsDesktop()
  const [editing, setEditing] = useState(false)
  const [passport, setPassport] = useState(false)
  const [face, setFace] = useState<AvatarConfig | null>(null)
  const [pic, setPic] = useState(false)
  const [words, setWords] = useState<string | null>(shownWords)
  const tab = useMeSheet((s) => s.tab)
  const setTab = (t: MeTab) => useMeSheet.setState({ tab: t })
  const pref = useModeStore((s) => s.pref)
  const freezes = useReward((s) => s.freezes)
  const [, nav] = useLocation()
  if (!me) return null
  const temp = !!me.temp
  const current = me.avatar ?? avatarFromTraits(faceTraits(me.username))

  if (passport) return <Passport onDone={() => setPassport(false)} />
  if (editing && face)
    return (
      <FaceBuilder
        shop
        name={me.username}
        value={face}
        onChange={setFace}
        onDone={() => {
          void saveAvatar({ ...face, photo: null })
          setEditing(false)
        }}
      />
    )

  const settings = (
    <>
      <h3 className="settings-label">appearance</h3>
      <div className="me-mode">
        <Segmented layoutId="me-mode" value={pref} onChange={setModePref} items={[{ id: 'auto', label: 'auto' }, { id: 'light', label: 'light' }, { id: 'dark', label: 'dark' }]} />
      </div>
      {!temp && (
        <>
          <h3 className="settings-label">content</h3>
          <div className="settings-row">
            <span className="grow">
              nsfw <small className="nsfw-sub">{me.age_set && !me.adult ? '18+ only' : '18+'}</small>
            </span>
            <Toggle
              label="nsfw"
              on={me.nsfw === true}
              disabled={me.age_set === true && !me.adult}
              onChange={(v) => {
                if (v && !me.adult) return void (!me.age_set && setPassport(true))
                void saveNsfw(v).catch(() => {})
              }}
            />
          </div>
        </>
      )}
      <h3 className="settings-label">privacy</h3>
      <GhostRow />
      <div className="settings-row">
        <span className="grow">
          show active status <small className="nsfw-sub">both ways</small>
        </span>
        <Toggle label="show active status" on={me.show_status !== false} onChange={(v) => void savePrivacy(v, null)} />
      </div>
      <div className="settings-row">
        <span className="grow">
          show seen <small className="nsfw-sub">both ways</small>
        </span>
        <Toggle label="show seen" on={me.show_seen !== false} onChange={(v) => void savePrivacy(null, v)} />
      </div>
      <Account onWords={setWords} />
      <Blocked />
      <button
        type="button"
        className="settings-row me-tour"
        onClick={() => {
          onClose()
          nav('/')
          replayTour()
        }}
      >
        <GoofyFace name="tour.goof" size={26} mood="wink" blink={false} />
        <span className="grow">how it works</span>
        <IconArrowRight size={18} />
      </button>
      <div className="me-legal">
        <a href="/privacy" onClick={(e) => (e.preventDefault(), onClose(), nav('/privacy'))}>privacy</a>
        <a href="/terms" onClick={(e) => (e.preventDefault(), onClose(), nav('/terms'))}>terms</a>
        <a href={mailto('hi from ' + me.username)}>contact</a>
      </div>
      {me.admin && (
        <button type="button" className="me-admin" onClick={() => { onClose(); nav('/admin') }}>
          <IconCrown size={18} /> control room
        </button>
      )}
    </>
  )

  return (
    <div className="me">
      {!desktop && (
        <button type="button" className="icon-btn me-close" aria-label="close" onClick={onClose}>
          <IconClose size={22} />
        </button>
      )}
      <div className="me-head">
        <button type="button" className="me-face" aria-label="change picture" onClick={() => !temp && setPic((v) => !v)}>
          <GoofyFace name={me.username} avatar={current} size={72} />
          {!temp && (
            <span className="me-edit" aria-hidden="true">
              <IconBrush size={14} />
            </span>
          )}
        </button>
        <div className="me-head-text">
          {temp ? <span className="me-nm is-static ellipsis">{me.username}</span> : <NameRow />}
          <button
            type="button"
            className="me-card-btn"
            onClick={() => {
              onClose()
              setTimeout(() => peek(me.username, me.id), 180)
            }}
          >
            see my card
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {pic && !temp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <Picture
              current={current}
              onBuild={() => {
                setFace({ ...current, photo: undefined })
                setEditing(true)
                setPic(false)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <MoodRow name={me.username} spicy={me.nsfw === true && me.adult === true} />
      {temp ? (
        <>
          <KeepCard />
          {settings}
        </>
      ) : (
        <>
          <KeyCard words={words} onWords={setWords} />
          <div className="me-tabs">
            <Segmented layoutId="me-tab" value={tab} onChange={setTab} items={[{ id: 'me', label: 'me' }, { id: 'settings', label: 'settings' }]} />
          </div>
          {tab === 'me' ? (
            <>
              <ShopRow onClose={onClose} />
              <BioRow />
              <SongRow />
              {spotifyEnabled() && <Music />}
              <About />
              <div className="settings-row" style={{ marginTop: 10 }}>
                <IconFlame size={22} />
                <span className="grow">streak freezes</span>
                <b className="tnum">{freezes}/2</b>
              </div>
              <FlairEditor />
            </>
          ) : (
            settings
          )}
        </>
      )}
    </div>
  )
}

function ShopRow({ onClose }: { onClose: () => void }) {
  const coins = useShop((s) => s.coins)
  return (
    <button
      type="button"
      className="settings-row me-shop"
      onClick={() => {
        onClose()
        setTimeout(() => openShop('themes'), 180)
      }}
    >
      <Coin size={24} />
      <span className="grow">shop</span>
      <b className="tnum">{coinText(coins)}</b>
      <IconArrowRight size={18} />
    </button>
  )
}

/** red dot only once there's something to lose: a friend, or a few real chats */
function useKeyDot(): boolean {
  return useStore((s) => {
    const me = s.me
    if (!me || (me.has_key && !me.temp)) return false
    let friends = 0
    let chats = 0
    for (const c of Object.values(s.conversations)) {
      if (c.my_friend && c.peer_friend) friends++
      if (c.last_message) chats++
    }
    return me.temp ? friends > 0 : friends > 0 || chats >= 3
  })
}

export function MeButton({ size = 32 }: { size?: number }) {
  const moodRn = useMood((m) => (m.mood && m.mood.until > Date.now() ? (m.mood.mood as FaceMood) : undefined))
  const me = useMe()
  const dot = useKeyDot()
  const ghost = useGhost((g) => g.on)
  if (!me) return null
  return (
    <button type="button" className={'me-btn' + (ghost ? ' is-ghost' : '')} aria-label="your profile" onClick={() => openMeSheet()}>
      <GoofyFace name={me.username} size={size} mood={moodRn} />
      {ghost && (
        <i className="me-ghost" aria-hidden="true">
          <IconGhost size={14} />
        </i>
      )}
      {dot && <i className="me-dot" aria-hidden="true" />}
    </button>
  )
}

/** mounted once in App; every MeButton opens this one */
export function MeSheetHost() {
  const open = useMeSheet((s) => s.open)
  const me = useMe()
  if (!me) return null
  return (
    <Sheet open={open} onClose={closeMeSheet} label="your profile">
      <MeBody onClose={closeMeSheet} />
    </Sheet>
  )
}
