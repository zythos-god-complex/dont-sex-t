// The call screen, the minimized pill, and the listener that keeps the admin and Ember reachable.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '../../lib/store'
import { useMe, useNow } from '../../lib/hooks'
import { GoofyFace } from '../../ui/GoofyFace'
import { IconChevronDown, IconMic, IconMicOff, IconPhone, IconSpeaker } from '../../ui/icons'
import { acceptCall, declineCall, hangUp, isCallPair, listenCalls, toggleMute, toggleSpeaker, useCall } from './call'

const NOTE: Record<string, string> = { ended: 'call ended', 'no answer': 'no answer', busy: 'they hung up', missed: 'missed call', lost: 'call dropped', mic: 'mic blocked' }
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ticks only while a call is live, not all the time
function Clock({ since }: { since: number }) {
  const now = useNow(1000)
  return <>{mmss(now - since)}</>
}

export function CallHost() {
  const me = useMe()
  const conv = useStore((s) => (s.me ? Object.values(s.conversations).find((c) => isCallPair(s.me, c.peer)) ?? null : null))
  useEffect(() => listenCalls(conv), [conv?.id, conv?.topic])
  const st = useCall()
  const [mini, setMini] = useState(false)
  useEffect(() => {
    if (st.state !== 'live') setMini(false)
  }, [st.state])
  if (!me || st.state === 'idle') return null
  const ringing = st.state === 'outgoing' || st.state === 'incoming'
  const status =
    st.state === 'outgoing' ? 'calling...' : st.state === 'incoming' ? 'calling you' : st.state === 'connecting' ? 'connecting...' : st.state === 'live' ? <Clock since={st.since} /> : NOTE[st.note] ?? 'call ended'

  return createPortal(
    <AnimatePresence>
      {mini && st.state === 'live' ? (
        <motion.button key="pill" type="button" className="call-pill" onClick={() => setMini(false)} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
          <i className="call-pill-dot" />
          <GoofyFace name={st.peer} size={22} blink={false} />
          <span className="tnum">{status}</span>
        </motion.button>
      ) : (
        <motion.div key="full" className="call" role="dialog" aria-modal="true" aria-label={'call with ' + st.peer} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
          {st.state === 'live' && (
            <button type="button" className="call-mini icon-btn" aria-label="minimize" onClick={() => setMini(true)}>
              <IconChevronDown size={26} />
            </button>
          )}
          <div className="call-who">
            <span className={'call-face' + (ringing ? ' is-ringing' : '') + (st.state === 'live' ? ' is-live' : '')}>
              <GoofyFace name={st.peer} size={150} mood={st.state === 'ended' ? 'sleepy' : st.state === 'live' ? 'happy' : 'shocked'} />
            </span>
            <h2 className="call-name">{st.peer}</h2>
            <p className={'call-status' + (st.state === 'live' ? ' tnum' : '')} aria-live="polite">
              {status}
            </p>
          </div>
          {st.state === 'incoming' ? (
            <div className="call-acts">
              <span className="call-act">
                <button type="button" className="call-btn is-end" aria-label="decline" onClick={declineCall}>
                  <IconPhone size={30} style={{ rotate: '135deg' }} />
                </button>
                decline
              </span>
              <span className="call-act">
                <button type="button" className="call-btn is-go" aria-label="accept" onClick={() => void acceptCall()}>
                  <IconPhone size={30} />
                </button>
                accept
              </span>
            </div>
          ) : st.state !== 'ended' ? (
            <div className="call-acts">
              <span className="call-act">
                <button type="button" className={'call-btn' + (st.muted ? ' is-on' : '')} aria-pressed={st.muted} aria-label="mute" onClick={toggleMute}>
                  {st.muted ? <IconMicOff size={28} /> : <IconMic size={28} />}
                </button>
                {st.muted ? 'muted' : 'mute'}
              </span>
              <span className="call-act">
                <button type="button" className="call-btn is-end" aria-label="end call" onClick={hangUp}>
                  <IconPhone size={30} style={{ rotate: '135deg' }} />
                </button>
                end
              </span>
              <span className="call-act">
                <button type="button" className={'call-btn' + (st.speaker ? ' is-on' : '')} aria-pressed={st.speaker} aria-label="speaker" onClick={() => void toggleSpeaker()}>
                  <IconSpeaker size={28} />
                </button>
                speaker
              </span>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
