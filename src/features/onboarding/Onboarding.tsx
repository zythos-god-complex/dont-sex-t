import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { join, joinTemp, recoverAccount } from '../../lib/engine'
import { isApiError } from '../../lib/api'
import { useOnline } from '../../lib/hooks'
import { GoofyFace, useLookAt, type FaceMood } from '../../ui/GoofyFace'
import { Sheet, Wordmark, spring } from '../../ui/kit'
import { IconArrowRight, IconBrush, IconDice, IconFemale, IconMale } from '../../ui/icons'
import { avatarFromTraits, faceTraits, randomAvatar, type AvatarConfig } from '../../ui/face'
import { FaceBuilder } from './FaceBuilder'
import type { Gender } from '../../lib/types'

const VALID = /^[A-Za-z0-9_.]{3,20}$/
const DECOR = ['wobbly.bob', 'sirgoofsalot', 'mochi_mochi', 'xX_bean_Xx', 'lil.pickle', 'beep.boop', 'nugget', 'zesty.lemon']

export default function Onboarding() {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [typing, setTypingState] = useState(false)
  const [wink, setWink] = useState(false)
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null)
  const [building, setBuilding] = useState(false)
  const [spin, setSpin] = useState(0)
  const [touched, setTouched] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const shake = useAnimationControls()
  const [faceRef, look] = useLookAt<HTMLDivElement>()
  const { list, counts } = useOnline('all')
  const valid = VALID.test(name)
  const ready = valid && !!gender && !busy

  const floaters = useMemo(() => {
    const names = list.length ? list.slice(0, 8).map((u) => u.username) : DECOR.slice(0, 5)
    return names.map((n, i) => ({ n, i }))
  }, [list])

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const onChange = (v: string) => {
    const clean = v.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20)
    setName(clean)
    setError(null)
    setTypingState(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setTypingState(false), 450)
  }

  const pickGender = (g: Gender) => {
    setGender(g)
    setWink(true)
    setTimeout(() => setWink(false), 700)
  }

  const fail = (msg: string) => {
    setError(msg)
    void shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.32 } })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!valid) return fail('3 to 20 letters, numbers, _ or .')
    if (!gender) return
    setBusy(true)
    try {
      await join(name, gender, avatar)
    } catch (err) {
      setBusy(false)
      if (isApiError(err) && err.code === 'username_taken') fail('taken, try another')
      else if (isApiError(err) && err.code === 'username_invalid') fail('3 to 20 letters, numbers, _ or .')
      else fail('something broke, try again')
    }
  }

  const goTemp = async () => {
    if (busy) return
    if (!gender) return fail('pick male or female first')
    setBusy(true)
    try {
      await joinTemp(gender)
    } catch {
      setBusy(false)
      fail('something broke, try again')
    }
  }

  let mood: FaceMood = 'neutral'
  if (error === 'taken, try another') mood = 'shocked'
  else if (wink) mood = 'wink'
  else if (typing) mood = 'talking'
  else if (ready) mood = 'happy'

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
      </div>

      <div className="ob-hero">
        <motion.div ref={faceRef} className="ob-face" initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
          <motion.div key={name.toLowerCase() || 'empty'} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 14 }}>
            <GoofyFace name={name || null} avatar={avatar} size={184} look={typing ? { x: 0, y: 0.9 } : look} mood={mood} />
          </motion.div>
          <motion.button
            type="button"
            className={"ob-face-btn ob-dice" + (touched ? "" : " is-calling")}
            aria-label="random face"
            animate={{ rotate: spin * 360 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              setSpin((n) => n + 1)
              setTouched(true)
              setAvatar(randomAvatar())
            }}
          >
            <IconDice size={24} />
            <span className="ob-face-tag">random</span>
          </motion.button>
          <motion.button type="button" className={"ob-face-btn ob-brush" + (touched ? "" : " is-calling")} aria-label="build your face" whileTap={{ scale: 0.88 }} onClick={() => { setTouched(true); setBuilding(true) }}>
            <IconBrush size={24} />
            <span className="ob-face-tag">edit</span>
          </motion.button>
        </motion.div>
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
        </div>
        <AnimatePresence>
          {error && (
            <motion.p className="ob-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="ob-genders" role="radiogroup" aria-label="gender">
          {(['m', 'f'] as const).map((g) => (
            <motion.button
              key={g}
              type="button"
              role="radio"
              aria-checked={gender === g}
              className={'g-chip g-' + g + (gender === g ? ' is-on' : '')}
              onClick={() => pickGender(g)}
              whileTap={{ scale: 0.95 }}
              transition={spring}
            >
              {g === 'm' ? <IconMale size={22} /> : <IconFemale size={22} />}
              <span>{g === 'm' ? 'male' : 'female'}</span>
            </motion.button>
          ))}
        </div>
        <button className="toy-btn" type="submit" disabled={!ready}>
          {busy ? (
            <span className="dots-loader">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <>
              <span>start</span>
              <IconArrowRight size={22} />
            </>
          )}
        </button>
        <button type="button" className="temp-btn" disabled={busy} onClick={goTemp}>
          <span className="temp-ghost">
            <GoofyFace name="goof.ghost" size={22} blink={false} />
          </span>
          temp mode
        </button>
        <RecoverBox />
      </motion.form>

      <Sheet open={building} onClose={() => setBuilding(false)} label="build your face">
        <FaceBuilder
          name={name || null}
          value={avatar ?? avatarFromTraits(faceTraits(name || null))}
          onChange={setAvatar}
          onDone={() => setBuilding(false)}
        />
      </Sheet>
    </div>
  )
}

/** "got a key?": name + 6 words brings an account to this phone. */
function RecoverBox() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [words, setWords] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open)
    return (
      <button type="button" className="rec-link" onClick={() => setOpen(true)}>
        got a key?
      </button>
    )
  const go = async () => {
    if (busy || !name.trim() || words.trim().split(/\s+/).length < 6) return
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
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="username" aria-label="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <textarea value={words} onChange={(e) => setWords(e.target.value)} placeholder="your 6 words" aria-label="recovery words" rows={2} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {err && <p className="ob-error">{err}</p>}
      <button type="button" className="fb-done" disabled={busy} onClick={() => void go()}>
        get it back
      </button>
    </div>
  )
}
