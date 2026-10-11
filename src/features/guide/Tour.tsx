// First time tour: a goofy face in a speech bubble points at the real buttons, one at a time.
// Runs once after sign up (home), once in the first chat, and again from settings.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { useLocation } from 'wouter'
import { GoofyFace, type FaceMood } from '../../ui/GoofyFace'
import { IconArrowRight } from '../../ui/icons'

type Kind = 'home' | 'chat'
type Step = { sel?: string[]; title: string; body: string; mood: FaceMood }

const STEPS: Record<Kind, Step[]> = {
  home: [
    { sel: ['.board .card'], title: 'real people, online now', body: 'tap anyone to peek at their profile and say hi.', mood: 'happy' },
    { sel: ['.roll:not(.is-ghost)'], title: 'or let fate pick', body: 'roll drops you straight into a chat with someone new.', mood: 'wink' },
    { sel: ['.tabbar .tab:nth-child(2)', '.d-rail .rail-chats', '.d-rail-head'], title: 'your chats', body: 'requests, friends and everyone you talked to. add someone as a friend and they stick around.', mood: 'smug' },
    { sel: ['.tabbar .tab:nth-child(3)', '.d-live:not(.is-home)'], title: 'rooms', body: 'group chats. hop in a public one or make your own with friends.', mood: 'happy' },
    { sel: ['.m-head .me-btn', '.d-me .me-btn', '.me-btn'], title: "that's you", body: 'mood, bio, song, your face and all the settings live here.', mood: 'kiss' },
    { title: 'golden rules', body: "be nice. never share where you live, never send money, and block or report anyone weird from their profile.", mood: 'angry' },
  ],
  chat: [
    { sel: ['.chat-head .chat-peer'], title: 'tap their name', body: 'add friend, pick a theme, notifications, block or report. all in one place.', mood: 'happy' },
    { sel: ['.composer .stk-toggle'], title: 'the plus', body: 'games, photos, voice notes, doodles and stickers.', mood: 'wink' },
    { sel: ['.ice-chips', '.msgs-inner .b-row .b'], title: 'stuck on what to say?', body: 'tap a line to send it. once you are talking, tap any message to react or reply, double tap for a heart.', mood: 'smug' },
    { title: 'secret move', body: 'tap 4 times fast anywhere in a chat for confetti. they see it too.', mood: 'shocked' },
  ],
}

const KEY = (k: Kind) => 'gat.tour.' + k
const NEW = 'gat.tour.new'
const get = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return '1'
  }
}
const put = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* blocked */
  }
}

const useTour = create<{ kind: Kind | null; i: number }>(() => ({ kind: null, i: 0 }))

/** called right before joining, so only brand new accounts get the tour on their own */
export const markNewUser = () => put(NEW, '1')

/** home and the first chat call this; it only runs for new accounts that haven't seen it */
export function maybeTour(kind: Kind, delay = 900): () => void {
  if (get(NEW) !== '1' || get(KEY(kind)) || useTour.getState().kind) return () => {}
  const t = setTimeout(() => !useTour.getState().kind && useTour.setState({ kind, i: 0 }), delay)
  return () => clearTimeout(t)
}

/** settings: watch it again (home now, the chat part next time a chat opens) */
export function replayTour() {
  put(KEY('home'), null)
  put(KEY('chat'), null)
  put(NEW, '1')
  setTimeout(() => useTour.setState({ kind: 'home', i: 0 }), 450)
}

function finish(kind: Kind) {
  put(KEY(kind), '1')
  if (get(KEY('home')) && get(KEY('chat'))) put(NEW, null)
  useTour.setState({ kind: null, i: 0 })
}

type Box = { x: number; y: number; w: number; h: number }
const find = (s: Step): HTMLElement | null => {
  for (const q of s.sel ?? []) {
    const el = document.querySelector<HTMLElement>(q)
    if (el && el.offsetParent !== null) return el
  }
  return null
}

export function TourHost() {
  const kind = useTour((s) => s.kind)
  const i = useTour((s) => s.i)
  const [loc] = useLocation()
  const startLoc = useRef(loc)
  const [box, setBox] = useState<Box | null>(null)
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390))
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))
  const nextBtn = useRef<HTMLButtonElement>(null)
  const steps = kind ? STEPS[kind] : []
  const step = steps[i]
  const last = i >= steps.length - 1
  const next = () => {
    if (!kind) return
    if (last) finish(kind)
    else useTour.setState({ i: i + 1 })
  }

  // a step whose button isn't on screen (nobody new to roll, a request card instead of a composer) is skipped
  useLayoutEffect(() => {
    if (!kind || !step || !step.sel) return
    if (!find(step)) useTour.setState({ i: i + 1 < steps.length ? i + 1 : i })
  }, [kind, i, step, steps.length])

  useEffect(() => {
    if (kind) startLoc.current = loc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
  // leaving the screen ends the tour quietly
  useEffect(() => {
    if (kind && loc !== startLoc.current) finish(kind)
  }, [loc, kind])

  const measure = useCallback(() => {
    setVw(window.innerWidth)
    setVh(window.innerHeight)
    const el = step ? find(step) : null
    if (!el) return setBox(null)
    const r = el.getBoundingClientRect()
    const pad = 8
    setBox({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 })
  }, [step])

  useEffect(() => {
    if (!kind) return
    measure()
    // targets can still be springing into place; follow them for a moment, then on resize
    const t = setInterval(measure, 250)
    const stop = setTimeout(() => clearInterval(t), 1500)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(t)
      clearTimeout(stop)
      window.removeEventListener('resize', measure)
    }
  }, [kind, i, measure])

  useEffect(() => {
    if (!kind) return
    nextBtn.current?.focus({ preventScroll: true })
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(kind)
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, i])

  if (!kind || !step) return null

  // the bubble sits on the roomier side of the target and its tail points at it
  const W = Math.min(340, vw - 32)
  const left = (vw - W) / 2
  const below = box ? box.y + box.h / 2 < vh / 2 : false
  const cardPos = !box ? { top: Math.max(24, vh / 2 - 130) } : below ? { top: box.y + box.h + 18 } : { bottom: vh - box.y + 18 }
  const tailX = box ? Math.min(W - 34, Math.max(22, box.x + box.w / 2 - left - 10)) : 0
  const tilt = i % 2 ? 1.2 : -1.2

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <svg className="tour-dim" width={vw} height={vh} aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width={vw} height={vh} fill="#fff" />
            {box && <motion.rect initial={false} animate={{ x: box.x, y: box.y, width: box.w, height: box.h }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} rx={18} fill="#000" />}
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(18, 14, 26, .68)" mask="url(#tour-hole)" />
        {box && (
          <motion.rect
            className="tour-ring"
            initial={false}
            animate={{ x: box.x, y: box.y, width: box.w, height: box.h }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            rx={18}
          />
        )}
      </svg>
      <AnimatePresence mode="wait">
        <motion.div
          key={kind + i}
          className={'tour-card' + (box ? (below ? ' is-below' : ' is-above') : '')}
          style={{ width: W, left, ...cardPos }}
          initial={{ opacity: 0, scale: 0.85, rotate: tilt * 3, y: below ? -12 : 12 }}
          animate={{ opacity: 1, scale: 1, rotate: tilt, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        >
          {box && <i className="tour-tail" style={{ left: tailX }} aria-hidden="true" />}
          <span className="tour-face" aria-hidden="true">
            <GoofyFace name="tour.goof" size={58} mood={step.mood} />
          </span>
          <h2 className="tour-title">{step.title}</h2>
          <p className="tour-body">{step.body}</p>
          <div className="tour-foot">
            <button type="button" className="tour-skip" onClick={() => finish(kind)}>
              skip
            </button>
            <span className="tour-dots" aria-label={`${i + 1} of ${steps.length}`}>
              {steps.map((_, k) => (
                <i key={k} className={k === i ? 'is-on' : k < i ? 'is-done' : ''} />
              ))}
            </span>
            <button ref={nextBtn} type="button" className="tour-next" onClick={next}>
              {last ? (kind === 'home' ? "let's go" : 'got it') : 'next'}
              {!last && <IconArrowRight size={18} />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  )
}
