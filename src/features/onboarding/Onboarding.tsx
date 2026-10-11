import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { join, joinTemp, recoverAccount, renameMe, saveAvatar } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { useOnline } from '../../lib/hooks'
import { GoofyFace, useLookAt, type FaceMood } from '../../ui/GoofyFace'
import { Sheet, Wordmark, spring } from '../../ui/kit'
import { IconArrowRight, IconBrush, IconDice, IconFemale, IconLock, IconMale } from '../../ui/icons'
import { avatarFromTraits, faceTraits, type AvatarConfig } from '../../ui/face'
import { FaceBuilder } from './FaceBuilder'
import { markNewUser } from '../guide/Tour'
import type { Gender } from '../../lib/types'

const VALID = /^[A-Za-z0-9_.]{3,20}$/
const NAME_A = ['zesty', 'wobbly', 'sleepy', 'spicy', 'tiny', 'chonky', 'sneaky', 'goofy', 'fuzzy', 'salty', 'sunny', 'moody']
const NAME_B = ['pickle', 'mango', 'noodle', 'bean', 'otter', 'momo', 'toast', 'gecko', 'boba', 'waffle', 'panda', 'samosa']
const pickName = () => `${NAME_A[(Math.random() * NAME_A.length) | 0]}.${NAME_B[(Math.random() * NAME_B.length) | 0]}${10 + ((Math.random() * 89) | 0)}`
const DECOR = ['wobbly.bob', 'sirgoofsalot', 'mochi_mochi', 'xX_bean_Xx', 'lil.pickle', 'beep.boop', 'nugget', 'zesty.lemon']

export default function Onboarding() {
  const [name, setName] = useState(pickName)
  const [gender, setGender] = useState<Gender | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alt, setAlt] = useState<string | null>(null)
  const [busy, setBusy] = useState<Gender | null>(null)
  const [temp, setTemp] = useState(false)
  const [typing, setTypingState] = useState(false)
  const [wink, setWink] = useState(false)
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null)
  const [building, setBuilding] = useState(false)
  const [login, setLogin] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const shake = useAnimationControls()
  const nudge = useAnimationControls()
  const [faceRef, look] = useLookAt<HTMLButtonElement>()
  const { list, counts } = useOnline('all')
  const valid = VALID.test(name)

  const floaters = useMemo(() => {
    const names = list.length ? list.slice(0, 8).map((u) => u.username) : DECOR.slice(0, 5)
    return names.map((n, i) => ({ n, i }))
  }, [list])

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const onChange = (v: string) => {
    const clean = v.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20)
    setName(clean)
    setError(null)
    setAlt(null)
    setTypingState(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setTypingState(false), 450)
  }

  const fail = (msg: string) => {
    setError(msg)
    void shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.32 } })
  }

  // male / female is the start button: one tap picks it and gets you in
  const go = async (g: Gender, as = name) => {
    if (busy) return
    setGender(g)
    setWink(true)
    setTimeout(() => setWink(false), 700)
    if (!VALID.test(as)) return fail('3 to 20 letters, numbers, _ or .')
    setBusy(g)
    markNewUser()
    try {
      if (temp) {
        await joinTemp(g)
        // temp keeps the name and face you picked; if the name is gone the goof name stays
        await renameMe(as).catch(() => {})
        if (avatar) await saveAvatar(avatar).catch(() => {})
      } else await join(as, g, avatar)
    } catch (err) {
      setBusy(null)
      if (isApiError(err) && err.code === 'username_taken') {
        fail('taken')
        setAlt(`${as.slice(0, 17)}${10 + ((Math.random() * 89) | 0)}`)
      } else if (isApiError(err) && err.code === 'username_invalid') fail('3 to 20 letters, numbers, _ or .')
      else fail('something broke, try again')
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (gender) return void go(gender)
    void nudge.start({ scale: [1, 1.05, 1], transition: { duration: 0.35 } })
  }

  let mood: FaceMood = 'neutral'
  if (error === 'taken') mood = 'shocked'
  else if (wink) mood = 'wink'
  else if (typing) mood = 'talking'
  else if (valid) mood = 'happy'

  const n = counts.all

  return (
    <div className="ob">
      <div className="ob-floaters" aria-hidden="true">
        {floaters.map(({ n: fn, i }) => (
          <span key={fn} className={'ob-float f' + i} style={{ '--i': i } as CSSProperties}>
            <GoofyFace name={fn} size={i % 3 === 0 ? 64 : 48} blink={false} />
          </span>
        ))}
      </div>

      <div className="ob-top">
        <AnimatePresence>
          {n > 0 && (
            <motion.div className="live-pill" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span className="live-dot" />
              <motion.span key={n} className="tnum" initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                {n}
              </motion.span>{' '}
              online
            </motion.div>
          )}
        </AnimatePresence>
        <button type="button" className="ob-login" onClick={() => setLogin(true)}>
          <IconLock size={15} />
          log in
        </button>
      </div>

      <div className="ob-hero">
        <motion.button
          type="button"
          ref={faceRef}
          className="ob-face"
          aria-label="build your face"
          onClick={() => setBuilding(true)}
          initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        >
          <motion.div key={name.toLowerCase() || 'empty'} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
            <GoofyFace name={name || null} avatar={avatar} size={184} look={typing ? { x: 0, y: 0.9 } : look} mood={mood} />
          </motion.div>
          <span className="ob-face-btn ob-brush is-calling" aria-hidden="true">
            <IconBrush size={22} />
          </span>
        </motion.button>
        <Wordmark size={40} />
      </div>

      <motion.form className="ob-form" onSubmit={submit} animate={shake}>
        <div className={'ob-input' + (error ? ' has-error' : '')}>
          <input
            value={name}
            onChange={(e) => onChange(e.target.value)}
            placeholder="pick a username"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={20}
            aria-label="username"
            aria-invalid={!!error}
          />
          {name.length >= 18 && <span className="ob-count tnum" aria-hidden="true">{name.length}/20</span>}
          <button
            type="button"
            className="ob-reroll"
            aria-label="random name and face"
            onClick={() => {
              onChange(pickName())
              setAvatar(null)
            }}
          >
            <IconDice size={18} />
          </button>
        </div>
        <div className="ob-error-line" aria-live="polite">
          {error && <span className="ob-error">{error}</span>}
          {alt && (
            <button type="button" className="ob-alt" onClick={() => { onChange(alt); if (gender) void go(gender, alt) }}>
              {alt}
            </button>
          )}
        </div>
        <button type="button" className={'ob-temp' + (temp ? ' is-on' : '')} aria-pressed={temp} onClick={() => setTemp((t) => !t)}>
          <span className="temp-ghost">
            <GoofyFace name="goof.ghost" size={22} blink={false} />
          </span>
          temp
          {temp && <i className="ob-temp-sub">gone on close</i>}
        </button>
        <motion.div className="ob-go" animate={nudge}>
          {(['m', 'f'] as const).map((g) => (
            <motion.button
              key={g}
              type="button"
              className={'ob-go-btn g-' + g + (temp ? ' is-temp' : '')}
              disabled={!!busy}
              onClick={() => void go(g)}
              whileTap={{ scale: 0.95 }}
              transition={spring}
            >
              {busy === g ? (
                <span className="dots-loader">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <>
                  {g === 'm' ? <IconMale size={22} /> : <IconFemale size={22} />}
                  <span>{g === 'm' ? 'male' : 'female'}</span>
                  <IconArrowRight size={20} />
                </>
              )}
            </motion.button>
          ))}
        </motion.div>
        <p className="ob-legal">
          joining means you're cool with our <a href="/terms">terms</a> and <a href="/privacy">privacy</a>
        </p>
      </motion.form>

      <Sheet open={building} onClose={() => setBuilding(false)} label="build your face">
        <FaceBuilder
          name={name || null}
          value={avatar ?? avatarFromTraits(faceTraits(name || null))}
          onChange={setAvatar}
          onDone={() => setBuilding(false)}
        />
      </Sheet>
      <Sheet open={login} onClose={() => setLogin(false)} label="log in">
        <RecoverForm />
      </Sheet>
    </div>
  )
}

/** log in: name + the 6 words brings an account to this phone. */
function RecoverForm() {
  const [name, setName] = useState('')
  const [words, setWords] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const count = words.trim() ? words.trim().split(/\s+/).length : 0
  const ok = name.trim().length >= 3 && count === 6
  const go = async () => {
    if (busy || !ok) return
    setBusy(true)
    setErr(null)
    try {
      await recoverAccount(name, words)
    } catch (e) {
      setBusy(false)
      setErr(isApiError(e, 'rate_limited') ? 'too many tries, wait an hour' : 'nope, check the name and words')
    }
  }
  return (
    <div className="rec-box">
      <h2 className="rec-title">log in</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="username" aria-label="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <div className="rec-words">
        <textarea value={words} onChange={(e) => setWords(e.target.value)} placeholder="your 6 words" aria-label="recovery words" rows={2} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <span className={'rec-n tnum' + (count === 6 ? ' is-ok' : '')}>{count}/6</span>
      </div>
      {err && <p className="ob-error">{err}</p>}
      <button type="button" className="fb-done" disabled={busy || !ok} onClick={() => void go()}>
        {busy ? 'checking...' : 'log in'}
      </button>
    </div>
  )
}
