// Toy box + 1:1 games. Results come from the server (gat_toy / gat_game_*); this only draws them.
import { IconDice, IconCoin, IconEightBall, IconTruth, IconFlame, IconRock, IconPaper, IconScissors, IconTicTacToe, IconTrophy, IconScales, IconPen } from '../../ui/icons'
import { sendTot } from './Tot'
import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { gameMove, loadGame, sendToy, startGame, useGames, type Game } from '../../lib/engine'

export type Toy = { kind: 'dice' | 'coin' | '8ball' | 'truth' | 'dare'; a: string; b: string }
const TOY_RE = /^\[\[toy:(dice|coin|8ball|truth|dare)\|([^|\]]*)(?:\|([^\]]*))?\]\]$/
const GAME_RE = /^\[\[game:([0-9a-f-]{36})\]\]$/
export const toyOf = (body: string): Toy | null => {
  const m = TOY_RE.exec(body)
  return m ? { kind: m[1] as Toy['kind'], a: m[2], b: m[3] ?? '' } : null
}
export const gameOf = (body: string): string | null => GAME_RE.exec(body)?.[1] ?? null

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
}

function Die({ n, fresh, i }: { n: number; fresh?: boolean; i: number }) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="toy-die"
      initial={fresh ? { rotate: -540, scale: 0.3, y: -30 } : false}
      animate={{ rotate: i ? 8 : -6, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 14, delay: i * 0.08 }}
    >
      <rect x="6" y="6" width="88" height="88" rx="22" />
      {(PIPS[n] ?? []).map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r="8.5" />
      ))}
    </motion.svg>
  )
}

export function ToyBubble({ toy, fresh }: { toy: Toy; fresh?: boolean }) {
  if (toy.kind === 'dice') {
    const a = Number(toy.a)
    const b = Number(toy.b)
    return (
      <div className="toy toy-dice">
        <div className="toy-dice-row">
          <Die n={a} fresh={fresh} i={0} />
          <Die n={b} fresh={fresh} i={1} />
        </div>
        <span className="toy-cap tnum">rolled {a + b}</span>
      </div>
    )
  }
  if (toy.kind === 'coin')
    return (
      <div className="toy toy-coin">
        <motion.span className={'toy-coin-face is-' + toy.a} initial={fresh ? { rotateY: 1800, y: -40 } : false} animate={{ rotateY: 0, y: 0 }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.3, 1] }}>
          {toy.a === 'heads' ? 'H' : 'T'}
        </motion.span>
        <span className="toy-cap">{toy.a}</span>
      </div>
    )
  if (toy.kind === '8ball')
    return (
      <div className="toy toy-8">
        {toy.b && <span className="toy-q">{toy.b}</span>}
        <motion.span className="toy-8-ball" initial={fresh ? { rotate: -25, x: -8 } : false} animate={{ rotate: [-25, 18, -10, 6, 0], x: [-8, 8, -5, 3, 0] }} transition={{ duration: 0.9 }}>
          <motion.span className="toy-8-win" initial={fresh ? { opacity: 0, scale: 0.6 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ delay: fresh ? 0.8 : 0 }}>
            {toy.a}
          </motion.span>
        </motion.span>
      </div>
    )
  return (
    <motion.div className={'toy toy-tod is-' + toy.kind} initial={fresh ? { rotateX: 90 } : false} animate={{ rotateX: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
      <span className="toy-tod-k">{toy.kind}</span>
      <span className="toy-tod-p">{toy.a}</span>
    </motion.div>
  )
}

// game taps must not open the bubble menu or count toward the confetti taps
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

const RPS: Record<string, ReactNode> = { rock: <IconRock size={26} />, paper: <IconPaper size={26} />, scissors: <IconScissors size={26} /> }

export function GameBubble({ id, meId, peerName }: { id: string; meId: string | null; peerName: string }) {
  const g = useGames((s) => s[id])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!g) void loadGame(id)
  }, [g, id])
  if (!g) return <div className="game game-load">loading game...</div>
  const side = g.a === meId ? 'a' : 'b'
  const other = side === 'a' ? 'b' : 'a'
  const move = (m: string) => {
    setBusy(true)
    gameMove(id, m).finally(() => setBusy(false))
  }
  const again = () => void startGame(g.conversation_id, g.kind)
  if (g.kind === 'rps') return <Rps g={g} side={side} other={other} peerName={peerName} busy={busy} move={move} again={again} />
  return <Ttt g={g} side={side} peerName={peerName} busy={busy} move={move} again={again} />
}

type GP = { g: Game; side: 'a' | 'b'; peerName: string; busy: boolean; move: (m: string) => void; again: () => void }

function Rps({ g, side, other, peerName, busy, move, again }: GP & { other: 'a' | 'b' }) {
  const st = g.state as { round: number; moved: Record<string, boolean>; score: Record<string, number>; last: { a: string; b: string; w: string } | null; to: number }
  const mine = st.score?.[side] ?? 0
  const theirs = st.score?.[other] ?? 0
  const iMoved = !!st.moved?.[side]
  const last = st.last
  return (
    <div className="game game-rps" onPointerDown={stop} onPointerUp={stop}>
      <div className="game-head">
        <span>rock paper scissors</span>
        <b className="tnum">
          {mine} : {theirs}
        </b>
      </div>
      {last && (
        <div className="rps-last">
          <span>{RPS[last[side as 'a']]}</span>
          <small>{last.w === 'tie' ? 'tie' : last.w === side ? 'you got it' : `${peerName} got it`}</small>
          <span>{RPS[last[other as 'a']]}</span>
        </div>
      )}
      {g.done ? (
        <div className="game-end">
          <b>{mine > theirs ? <>you win <IconTrophy size={16} /></> : `${peerName} wins`}</b>
          <button type="button" className="game-btn" onClick={again}>
            rematch
          </button>
        </div>
      ) : iMoved ? (
        <p className="game-wait">locked in, waiting for {peerName}...</p>
      ) : (
        <div className="rps-pick">
          {Object.entries(RPS).map(([k, e]) => (
            <motion.button key={k} type="button" disabled={busy} whileTap={{ scale: 0.85 }} onClick={() => move(k)} aria-label={k}>
              {e}
            </motion.button>
          ))}
        </div>
      )}
      {!g.done && <span className="game-sub">first to {st.to} · round {st.round}{st.moved?.[side === 'a' ? 'b' : 'a'] ? ` · ${peerName} picked` : ''}</span>}
    </div>
  )
}

function Ttt({ g, side, peerName, busy, move, again }: GP) {
  const st = g.state as { board: string; turn: string; winner: string | null; line: number[] | null }
  const mark = side === 'a' ? 'x' : 'o'
  const myTurn = !g.done && st.turn === side
  return (
    <div className="game game-ttt" onPointerDown={stop} onPointerUp={stop}>
      <div className="game-head">
        <span>tic tac toe</span>
        <b>you're {mark.toUpperCase()}</b>
      </div>
      <div className="ttt">
        {st.board.split('').map((c, i) => (
          <button key={i} type="button" className={'ttt-c' + (st.line?.includes(i) ? ' is-win' : '')} disabled={!myTurn || c !== '.' || busy} onClick={() => move(String(i))}>
            {c !== '.' && (
              <motion.span className={'ttt-m is-' + c} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                {c.toUpperCase()}
              </motion.span>
            )}
          </button>
        ))}
      </div>
      {g.done ? (
        <div className="game-end">
          <b>{st.winner === 'draw' ? 'draw' : st.winner === side ? <>you win <IconTrophy size={16} /></> : `${peerName} wins`}</b>
          <button type="button" className="game-btn" onClick={again}>
            rematch
          </button>
        </div>
      ) : (
        <span className="game-sub">{myTurn ? 'your move' : `${peerName}'s move`}</span>
      )}
    </div>
  )
}

/** The toys tab in the sticker tray. The 8-ball takes whatever you typed as the question. */
export function ToyGrid({ convId, question, onUsed, onDoodle }: { convId: string; question: string; onUsed: (clearText: boolean) => void; onDoodle: () => void }) {
  const items: { id: string; label: string; ico: ReactNode; go: () => Promise<void>; clear?: boolean }[] = [
    { id: 'tot', label: 'this or that', ico: <IconScales size={28} />, go: async () => { sendTot(convId) } },
    { id: 'doodle', label: 'doodle', ico: <IconPen size={28} />, go: async () => onDoodle() },
    { id: 'dice', label: 'dice', ico: <IconDice size={28} />, go: () => sendToy(convId, 'dice') },
    { id: 'coin', label: 'coin', ico: <IconCoin size={28} />, go: () => sendToy(convId, 'coin') },
    { id: '8ball', label: '8-ball', ico: <IconEightBall size={28} />, go: () => sendToy(convId, '8ball', question), clear: true },
    { id: 'truth', label: 'truth', ico: <IconTruth size={28} />, go: () => sendToy(convId, 'truth') },
    { id: 'dare', label: 'dare', ico: <IconFlame size={28} />, go: () => sendToy(convId, 'dare') },
    { id: 'rps', label: 'rock paper scissors', ico: <IconScissors size={28} />, go: () => startGame(convId, 'rps') },
    { id: 'ttt', label: 'tic tac toe', ico: <IconTicTacToe size={28} />, go: () => startGame(convId, 'ttt') },
  ]
  return (
    <div className="toy-grid">
      {items.map((t, i) => (
        <motion.button
          key={t.id}
          type="button"
          className="toy-pick"
          initial={{ scale: 0.5, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * i, type: 'spring', stiffness: 520, damping: 22 }}
          whileTap={{ scale: 0.85 }}
          onClick={() => {
            navigator.vibrate?.(8)
            void t.go().catch(() => {})
            onUsed(!!t.clear)
          }}
        >
          <span className="toy-ico">{t.ico}</span>
          <span className="toy-lbl">{t.label}</span>
        </motion.button>
      ))}
    </div>
  )
}
