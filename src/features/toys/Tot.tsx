// This or that: a quick two-option card. Each side taps a pick (a hidden reply message); both picks show once both are in.
import { sendMessage } from '../../lib/engine'
import { useStore } from '../../lib/store'
import type { Message } from '../../lib/types'

export const TOT: [string, string][] = [
  ['pizza', 'burger'], ['chai', 'coffee'], ['beach', 'mountains'], ['night owl', 'early bird'], ['texting', 'calling'],
  ['cats', 'dogs'], ['movies', 'series'], ['sweet', 'spicy'], ['summer', 'winter'], ['sunrise', 'sunset'],
  ['books', 'podcasts'], ['gym', 'nap'], ['sneakers', 'slides'], ['city', 'village'], ['rain', 'sun'],
  ['instagram', 'youtube'], ['maggi', 'pasta'], ['bollywood', 'hollywood'], ['dance', 'sing'], ['road trip', 'flight'],
  ['ice cream', 'cake'], ['horror', 'comedy'], ['android', 'iphone'], ['chocolate', 'vanilla'], ['call', 'voice note'],
  ['plans', 'spontaneous'], ['aesthetic', 'chaotic'], ['momos', 'samosa'], ['hoodie', 'tshirt'], ['stay in', 'go out'],
]

const RE = /^\[\[tot:(\d{1,3})\]\]$/
const RE_RE = /^\[\[totre:([0-9a-f-]{36})\|([01])\]\]$/

export const totOf = (body: string): number | null => {
  const m = RE.exec(body)
  return m && TOT[+m[1]] ? +m[1] : null
}
export const isTotReply = (body: string) => RE_RE.test(body)
export const sendTot = (convId: string) => sendMessage(convId, `[[tot:${(Math.random() * TOT.length) | 0}]]`)

export function TotCard({ m, meId, peerName }: { m: Message; meId: string | null; peerName: string }) {
  const pair = TOT[totOf(m.body) ?? 0]
  const picks = useStore((s) => {
    const out: { mine?: number; theirs?: number } = {}
    for (const x of s.messages[m.conversation_id] ?? []) {
      const r = RE_RE.exec(x.body)
      if (!r || r[1] !== m.id) continue
      if (x.sender_id === meId) out.mine = +r[2]
      else out.theirs = +r[2]
    }
    return `${out.mine ?? ''}|${out.theirs ?? ''}`
  })
  const [mineS, theirsS] = picks.split('|')
  const mine = mineS === '' ? null : +mineS
  const theirs = theirsS === '' ? null : +theirsS
  const done = mine !== null && theirs !== null
  const pick = (i: number) => mine === null && sendMessage(m.conversation_id, `[[totre:${m.id}|${i}]]`)
  return (
    <div className={'tot' + (done && mine === theirs ? ' is-match' : '')} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <span className="tot-k">this or that</span>
      <div className="tot-opts">
        {pair.map((o, i) => (
          <button key={o} type="button" className={'tot-opt' + (mine === i ? ' is-mine' : '') + (done && theirs === i ? ' is-theirs' : '')} disabled={mine !== null} onClick={() => pick(i)}>
            {o}
            {done && (mine === i || theirs === i) && <small>{mine === i && theirs === i ? 'both' : mine === i ? 'you' : peerName}</small>}
          </button>
        ))}
      </div>
      {done ? (
        <div className="tot-foot">
          <span className="tot-end">{mine === theirs ? 'same vibe' : 'opposites'}</span>
          <button type="button" className="tot-next" onClick={() => sendTot(m.conversation_id)}>
            another
          </button>
        </div>
      ) : (
        mine !== null && <span className="tot-end">waiting on {peerName}...</span>
      )}
    </div>
  )
}
