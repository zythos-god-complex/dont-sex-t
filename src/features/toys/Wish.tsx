// Catch a star (meteor shower, four taps): write a wish, it lands in the DM as a card,
// the other person answers "did it" or "can't do it" and the card shows it to both.
import { useState } from 'react'
import { motion } from 'motion/react'
import { sendMessage } from '../../lib/engine'
import { useStore } from '../../lib/store'
import type { Message } from '../../lib/types'
import { Sheet } from '../../ui/kit'
import { Ink } from '../../ui/Ink'

const WISH_RE = /^\[\[wish:([\s\S]{1,240})\]\]$/
const RE_RE = /^\[\[wishre:([0-9a-f-]{36})\|(did|no)\]\]$/
export const wishOf = (body: string): string | null => WISH_RE.exec(body)?.[1] ?? null
export const isWishReply = (body: string) => RE_RE.test(body)

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
        <span className="wish-star" aria-hidden="true">🌠</span>
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
      <span className="wish-card-k">🌠 {who} made a wish</span>
      <p className="wish-card-t">
        <Ink text={text} />
      </p>
      {verdict ? (
        <motion.span className="wish-card-v" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {verdict === 'did' ? `✨ ${answerer} made it happen` : `${answerer} can't do this one 🥲`}
        </motion.span>
      ) : mine ? (
        <span className="wish-card-w">waiting on {peerName}...</span>
      ) : (
        <div className="wish-card-a">
          <button type="button" className="wish-did" onClick={() => answer('did')}>
            did it ✨
          </button>
          <button type="button" className="wish-no" onClick={() => answer('no')}>
            can't do it
          </button>
        </div>
      )}
    </div>
  )
}
