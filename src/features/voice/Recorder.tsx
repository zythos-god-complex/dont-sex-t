import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { fmtDur, pickMime, toPeaks, uploadVoice, voiceBody } from './voice'

const MAX = 120

/** Full-width recording bar: live waveform, timer, cancel and send. */
export function Recorder({ userId, onSend, onClose }: { userId: string; onSend: (body: string) => void; onClose: () => void }) {
  const [secs, setSecs] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [state, setState] = useState<'starting' | 'rec' | 'review' | 'sending' | 'blocked'>('starting')
  const [review, setReview] = useState<{ blob: Blob; url: string; dur: number; peaks: number[] } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const player = useRef<HTMLAudioElement | null>(null)
  const raf = useRef(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const levels = useRef<number[]>([])
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const started = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  const sendAfterStop = useRef<'no' | 'send' | 'review'>('no')

  const cleanup = () => {
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    void ctx.current?.close().catch(() => {})
  }

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        const mime = pickMime()
        const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
        r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
        r.onstop = async () => {
          cleanup()
          const mode = sendAfterStop.current
          if (mode === 'no') return
          const dur = (performance.now() - started.current) / 1000
          if (dur < 0.6) return onClose()
          const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' })
          const peaks = toPeaks(levels.current)
          if (mode === 'review') {
            setReview({ blob, url: URL.createObjectURL(blob), dur: Math.min(dur, MAX), peaks })
            setState('review')
            return
          }
          await upload(blob, Math.min(dur, MAX), peaks)
        }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ac = new AC()
        ctx.current = ac
        const an = ac.createAnalyser()
        an.fftSize = 512
        ac.createMediaStreamSource(s).connect(an)
        const buf = new Uint8Array(an.fftSize)
        r.start(250)
        rec.current = r
        started.current = performance.now()
        setState('rec')
        navigator.vibrate?.(12)
        timer.current = setInterval(() => {
          an.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += ((buf[i] - 128) / 128) ** 2
          const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2)
          levels.current.push(rms)
          setLive((l) => [...l.slice(-31), rms])
          const t = (performance.now() - started.current) / 1000
          setSecs(t)
          if (t >= MAX) stop('review')
        }, 90)
      } catch {
        setState('blocked')
        setTimeout(onClose, 1600)
      }
    })()
    return () => {
      dead = true
      sendAfterStop.current = 'no'
      cancelAnimationFrame(raf.current)
      player.current?.pause()
      if (rec.current?.state === 'recording') rec.current.stop()
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upload = async (blob: Blob, dur: number, peaks: number[]) => {
    setState('sending')
    player.current?.pause()
    try {
      const url = await uploadVoice(blob, userId)
      onSend(voiceBody(url, dur, peaks))
    } catch {
      /* dropped */
    }
    onClose()
  }

  const stop = (mode: 'no' | 'send' | 'review') => {
    sendAfterStop.current = mode
    if (rec.current && rec.current.state === 'recording') rec.current.stop()
    else if (mode === 'no') onClose()
  }

  const discard = () => {
    player.current?.pause()
    if (review) URL.revokeObjectURL(review.url)
    if (state === 'review') onClose()
    else stop('no')
  }

  const togglePlay = () => {
    if (!review) return
    let a = player.current
    if (!a) {
      a = new Audio(review.url)
      a.onended = () => {
        setPlaying(false)
        setPos(0)
      }
      player.current = a
    }
    if (a.paused) {
      void a.play().then(() => {
        setPlaying(true)
        const tick = () => {
          setPos(a!.currentTime)
          if (!a!.paused) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
      })
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const prog = review ? Math.min(1, pos / review.dur) : 0

  return (
    <motion.div className="rec" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 520, damping: 30 }}>
      <button type="button" className="rec-x" aria-label="cancel" onClick={discard} disabled={state === 'sending'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
      </button>
      {state === 'blocked' ? (
        <span className="rec-msg">mic blocked in browser settings</span>
      ) : review ? (
        <>
          <motion.button type="button" className="rec-play" aria-label={playing ? 'pause' : 'play'} onClick={togglePlay} whileTap={{ scale: 0.88 }} disabled={state === 'sending'}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
            )}
          </motion.button>
          <div className="rec-wave is-review">
            {review.peaks.map((p, i) => (
              <i key={i} className={i / review.peaks.length < prog ? 'on' : ''} style={{ transform: `scaleY(${0.15 + p * 0.85})` }} />
            ))}
          </div>
          <span className="rec-time tnum">{fmtDur(playing || pos ? review.dur - pos : review.dur)}</span>
        </>
      ) : (
        <>
          <span className="rec-dot" />
          <span className="rec-time tnum">{fmtDur(secs)}</span>
          <div className="rec-wave">
            {Array.from({ length: 32 }, (_, i) => {
              const v = live[live.length - 32 + i] ?? 0
              return <i key={i} style={{ transform: `scaleY(${0.12 + v * 0.88})` }} />
            })}
          </div>
        </>
      )}
      {state === 'rec' && (
        <motion.button type="button" className="rec-stop" aria-label="stop and listen" onClick={() => stop('review')} whileTap={{ scale: 0.86 }}>
          <svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" /></svg>
        </motion.button>
      )}
      <motion.button
        type="button"
        className="send rec-send"
        aria-label="send voice note"
        onClick={() => (review ? void upload(review.blob, review.dur, review.peaks) : stop('send'))}
        disabled={state !== 'rec' && state !== 'review'}
        whileTap={{ scale: 0.86 }}
      >
        {state === 'sending' ? (
          <span className="dots-loader small"><i /><i /><i /></span>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4.5 11.2L19.3 4.6c.6-.3 1.2.3.9.9l-6.6 14.8c-.3.6-1.1.6-1.3-.1l-1.7-5.6c-.1-.3-.3-.5-.6-.6L4.4 12.4c-.6-.2-.6-1-.1-1.2z" fill="currentColor" /></svg>
        )}
      </motion.button>
    </motion.div>
  )
}
