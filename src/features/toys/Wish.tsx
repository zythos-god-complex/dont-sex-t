// Catch a star (meteor shower, four taps): write a wish, it lands in the DM as a card,
// the other person answers "did it" or "can't do it" and the card shows it to both.
import { useId, useState } from 'react'
import { motion } from 'motion/react'
import { sendMessage } from '../../lib/engine'
import { useStore } from '../../lib/store'
import type { Message } from '../../lib/types'
import { Sheet } from '../../ui/kit'
import { Ink } from '../../ui/Ink'
import { IconShootingStar, IconSparkle } from '../../ui/icons'

const WISH_RE = /^\[\[wish:([\s\S]{1,240})\]\]$/
const RE_RE = /^\[\[wishre:([0-9a-f-]{36})\|(did|no)\]\]$/
export const wishOf = (body: string): string | null => WISH_RE.exec(body)?.[1] ?? null
export const isWishReply = (body: string) => RE_RE.test(body)

// the golden wish star from the meteor shower, caught in a little patch of night sky
export function WishStar({ size = 72 }: { size?: number }) {
  const u = useId().replace(/:/g, '')
  return (
    <svg className="wish-star" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id={u + 'sky'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070D2E" />
          <stop offset=".55" stopColor="#17195A" />
          <stop offset="1" stopColor="#3B2373" />
        </linearGradient>
        <radialGradient id={u + 'dusk'} cx=".5" cy="1.05" r=".62">
          <stop offset="0" stopColor="#B07AE8" stopOpacity=".55" />
          <stop offset="1" stopColor="#B07AE8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + 'tail'} gradientUnits="userSpaceOnUse" x1="37" y1="59" x2="86" y2="10">
          <stop offset="0" stopColor="#FFD98A" stopOpacity=".95" />
          <stop offset=".4" stopColor="#FFC36B" stopOpacity=".38" />
          <stop offset="1" stopColor="#FFC36B" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u + 'core'} gradientUnits="userSpaceOnUse" x1="40" y1="56" x2="80" y2="16">
          <stop offset="0" stopColor="#FFFBEA" />
          <stop offset="1" stopColor="#FFFBEA" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={u + 'halo'}>
          <stop offset="0" stopColor="#FFD98A" stopOpacity=".7" />
          <stop offset=".45" stopColor="#FFC36B" stopOpacity=".22" />
          <stop offset="1" stopColor="#FFC36B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={u + 'gold'} cx=".42" cy=".38" r=".7">
          <stop offset="0" stopColor="#FFFBE8" />
          <stop offset=".38" stopColor="#FFE08A" />
          <stop offset="1" stopColor="#F2A43A" />
        </radialGradient>
        <clipPath id={u + 'clip'}>
          <circle cx="48" cy="48" r="44" />
        </clipPath>
      </defs>
      <circle cx="48" cy="48" r="44" fill={`url(#${u}sky)`} />
      <g clipPath={`url(#${u}clip)`}>
        <rect x="0" y="40" width="96" height="56" fill={`url(#${u}dusk)`} />
        <g fill="#FFFFFF">
          <circle cx="24" cy="26" r=".9" opacity=".8" />
          <circle cx="58" cy="20" r=".7" opacity=".6" />
          <circle cx="71" cy="47" r="1" opacity=".75" />
          <circle cx="18" cy="52" r=".6" opacity=".5" />
          <circle cx="62" cy="76" r=".7" opacity=".45" />
          <circle cx="45" cy="13" r=".6" opacity=".5" />
          <circle className="wh-tw" cx="78" cy="62" r="1.1" />
          <circle className="wh-tw is-2" cx="32" cy="17" r="1" />
        </g>
        <path className="wh-tail" d="M31 53 L88 6 L92 10 L44 65 Z" fill={`url(#${u}tail)`} />
        <path d="M40 56 L80 16" stroke={`url(#${u}core)`} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="38" cy="58" r="26" fill={`url(#${u}halo)`} />
      </g>
      <g className="wh-star">
        <path d="M34.4 43.4L40.7 51.3L50.7 50.1L45.2 58.5L49.5 67.6L39.7 65L32.4 71.9L31.9 61.8L23 57L32.5 53.4Z" fill={`url(#${u}gold)`} stroke="#F6B84A" strokeWidth="3.2" strokeLinejoin="round" />
        <path d="M33.6 52.6c.6-1.8 1.4-3.3 2.1-4.4" stroke="#FFFFFF" strokeOpacity=".85" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>
      <path className="wh-tw is-3" d="M66 66c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4z" fill="#FFE7A8" />
      <path className="wh-tw is-4" d="M19 34c.2 1.8 1 2.6 2.8 2.8-1.8.2-2.6 1-2.8 2.8-.2-1.8-1-2.6-2.8-2.8 1.8-.2 2.6-1 2.8-2.8z" fill="#FFFFFF" />
    </svg>
  )
}

export function WishSheet({ convId, open, onClose }: { convId: string; open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const send = () => {
    const t = text.trim().replace(/\]\]/g, ']').slice(0, 240)
    if (!t) return
    sendMessage(convId, `[[wish:${t}]]`)
    setText('')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} label="make a wish">
      <div className="wish-sheet">
        <WishStar />
        <h2 className="wish-title">you caught a star</h2>
        <p className="wish-sub">make a wish, they'll see it</p>
        <textarea className="wish-input" value={text} maxLength={240} rows={3} placeholder="i wish..." onChange={(e) => setText(e.target.value)} autoFocus />
        <button type="button" className="wish-send" disabled={!text.trim()} onClick={send}>
          send wish
        </button>
      </div>
    </Sheet>
  )
}

export function WishCard({ m, mine, peerName }: { m: Message; mine: boolean; peerName: string }) {
  const text = wishOf(m.body) ?? ''
  const reply = useStore((s) => s.messages[m.conversation_id]?.find((x) => x.body.startsWith(`[[wishre:${m.id}|`)))
  const verdict = reply ? (RE_RE.exec(reply.body)?.[2] as 'did' | 'no' | undefined) : undefined
  const who = mine ? 'you' : peerName
  const answerer = mine ? peerName : 'you'
  const answer = (v: 'did' | 'no') => sendMessage(m.conversation_id, `[[wishre:${m.id}|${v}]]`)
  return (
    <div className={'wish-card' + (verdict === 'did' ? ' is-did' : verdict === 'no' ? ' is-no' : '')} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <span className="wish-card-k">
        <IconShootingStar size={14} />
        {who} made a wish
      </span>
      <p className="wish-card-t">
        <Ink text={text} />
      </p>
      {verdict ? (
        <motion.span className="wish-card-v" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {verdict === 'did' ? (
            <>
              <IconSparkle size={14} />
              {answerer} made it happen
            </>
          ) : (
            `${answerer} can't do this one`
          )}
        </motion.span>
      ) : mine ? (
        <span className="wish-card-w">waiting on {peerName}...</span>
      ) : (
        <div className="wish-card-a">
          <button type="button" className="wish-did" onClick={() => answer('did')}>
            <IconSparkle size={15} />
            did it
          </button>
          <button type="button" className="wish-no" onClick={() => answer('no')}>
            can't do it
          </button>
        </div>
      )}
    </div>
  )
}
