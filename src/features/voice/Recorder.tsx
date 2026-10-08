import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { fmtDur, pickMime, toPeaks, uploadVoice, voiceBody } from './voice'

const MAX = 120

/** Full-width recording bar: live waveform, timer, cancel and send. */
export function Recorder({ userId, onSend, onClose }: { userId: string; onSend: (body: string) => void; onClose: () => void }) {
  const [secs, setSecs] = useState(0)
  const [live, setLive] = useState<number[]>([])
  const [state, setState] = useState<'starting' | 'rec' | 'sending' | 'blocked'>('starting')
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const levels = useRef<number[]>([])
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const started = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  const sendAfterStop = useRef(false)

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
          if (!sendAfterStop.current) return
          const dur = (performance.now() - started.current) / 1000
          if (dur < 0.6) return onClose()
          setState('sending')
          try {
            const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' })
            const url = await uploadVoice(blob, userId)
            onSend(voiceBody(url, Math.min(dur, MAX), toPeaks(levels.current)))
            onClose()
          } catch {
            setState('rec')
            onClose()
          }
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
          if (t >= MAX) stop(true)
        }, 90)
      } catch {
        setState('blocked')
        setTimeout(onClose, 1600)
      }
    })()
    return () => {
      dead = true
      sendAfterStop.current = false
      if (rec.current?.state === 'recording') rec.current.stop()
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = (send: boolean) => {
    sendAfterStop.current = send
    if (rec.current && rec.current.state === 'recording') rec.current.stop()
    else if (!send) onClose()
  }

  return (
    <motion.div className="rec" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 520, damping: 30 }}>
      <button type="button" className="rec-x" aria-label="cancel" onClick={() => stop(false)} disabled={state === 'sending'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
      </button>
      {state === 'blocked' ? (
        <span className="rec-msg">mic blocked in browser settings</span>
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
      <motion.button type="button" className="send rec-send" aria-label="send voice note" onClick={() => stop(true)} disabled={state !== 'rec'} whileTap={{ scale: 0.86 }}>
        {state === 'sending' ? (
          <span className="dots-loader small"><i /><i /><i /></span>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4.5 11.2L19.3 4.6c.6-.3 1.2.3.9.9l-6.6 14.8c-.3.6-1.1.6-1.3-.1l-1.7-5.6c-.1-.3-.3-.5-.6-.6L4.4 12.4c-.6-.2-.6-1-.1-1.2z" fill="currentColor" /></svg>
        )}
      </motion.button>
    </motion.div>
  )
}
