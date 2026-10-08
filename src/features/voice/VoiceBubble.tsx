import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { fmtDur, type VoiceNote } from './voice'
import { useMediaSrc } from '../../lib/useMediaSrc'

let current: HTMLAudioElement | null = null
const SPEEDS = [1, 1.5, 2]

export function VoiceBubble({ note }: { note: VoiceNote }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [speed, setSpeed] = useState(1)
  const raf = useRef(0)
  const dur = note.dur || 1
  const src = useMediaSrc(note.url)

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      audio.current?.pause()
    },
    [],
  )

  const tick = () => {
    const a = audio.current
    if (!a) return
    setPos(a.currentTime)
    if (!a.paused) raf.current = requestAnimationFrame(tick)
  }

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    let a = audio.current
    if (!a) {
      a = new Audio(src)
      a.preload = 'auto'
      a.onended = () => {
        setPlaying(false)
        setPos(0)
      }
      a.onpause = () => setPlaying(false)
      a.onplay = () => {
        setPlaying(true)
        raf.current = requestAnimationFrame(tick)
      }
      audio.current = a
    }
    if (a.paused) {
      if (current && current !== a) current.pause()
      current = a
      a.playbackRate = speed
      void a.play().catch(() => setPlaying(false))
    } else a.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    if (!audio.current) return
    audio.current.currentTime = f * dur
    setPos(f * dur)
  }

  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audio.current) audio.current.playbackRate = next
  }

  const prog = Math.min(1, pos / dur)
  return (
    <div className="vn" onPointerDown={(e) => e.stopPropagation()}>
      <motion.button type="button" className="vn-play" aria-label={playing ? 'pause' : 'play'} onClick={toggle} whileTap={{ scale: 0.88 }}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
        )}
      </motion.button>
      <div className="vn-wave" onClick={seek}>
        {note.peaks.map((p, i) => (
          <i key={i} className={i / note.peaks.length < prog ? 'on' : ''} style={{ height: `${Math.round(18 + p * 82)}%` }} />
        ))}
      </div>
      <div className="vn-side">
        <span className="vn-time tnum">{fmtDur(playing || pos ? dur - pos : dur)}</span>
        <button type="button" className="vn-speed" onClick={cycle}>
          {speed}x
        </button>
      </div>
    </div>
  )
}
