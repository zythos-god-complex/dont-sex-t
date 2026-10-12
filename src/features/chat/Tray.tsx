// The plus tray: 'play' (send things, games, quick toys) and 'stickers' (packs picked from a thumbnail strip).
import { useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Segmented } from '../../ui/kit'
import { IconClock, IconCoin, IconDice, IconEightBall, IconFlame, IconImage, IconLock, IconMic, IconOnce, IconPen, IconScales, IconScissors, IconShootingStar, IconSparkle, IconTicTacToe, IconTruth, IconWave } from '../../ui/icons'
import { Sticker } from '../stickers/Sticker'
import { CoupleSticker } from '../stickers/CoupleSticker'
import { COUPLES, STICKERS, stickerBody } from '../stickers/stickers'
import { shareSticker } from '../stickers/share'
import { KAOMOJI } from './kaomoji'

const load = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* blocked */
  }
}

export type TrayTab = 'play' | 'stickers' | 'faces'
export const lastTrayTab = (): TrayTab => {
  const v = load('gat.tray')
  return v === 'stickers' || v === 'faces' ? v : 'play'
}

export function TrayTabs({ value, onChange }: { value: TrayTab; onChange: (t: TrayTab) => void }) {
  return (
    <div className="stk-tabs">
      <Segmented
        layoutId="tray-tab"
        value={value}
        onChange={(t) => {
          save('gat.tray', t)
          onChange(t)
        }}
        items={[
          { id: 'play' as const, label: 'play' },
          { id: 'stickers' as const, label: 'stickers' },
          { id: 'faces' as const, label: 'faces' },
        ]}
      />
    </div>
  )
}

/** ok: both have it on. asked: mine is on, waiting on them. off: mine is off. */
export type Media = 'ok' | 'asked' | 'off'
type Tile = { id: string; label: string; ico: ReactNode; go: () => void; state?: Media }

function TileBtn({ t, i, big }: { t: Tile; i: number; big?: boolean }) {
  const [nope, setNope] = useState(0)
  return (
    <motion.button
      type="button"
      className={'toy-pick' + (big ? ' is-big' : '') + (t.state && t.state !== 'ok' ? ' is-' + t.state : '')}
      initial={{ scale: 0.6, opacity: 0, y: 10 }}
      animate={nope ? { x: [0, -6, 5, -3, 0], scale: 1, opacity: 1, y: 0 } : { scale: 1, opacity: 1, y: 0 }}
      transition={nope ? { duration: 0.3 } : { delay: 0.02 * i, type: 'spring', stiffness: 520, damping: 22 }}
      whileTap={{ scale: 0.86 }}
      onClick={() => {
        navigator.vibrate?.(8)
        if (t.state === 'asked') return setNope((n) => n + 1)
        t.go()
      }}
    >
      <span className="toy-ico">
        {t.ico}
        {t.state === 'off' && (
          <i className="toy-badge">
            <IconLock size={11} />
          </i>
        )}
        {t.state === 'asked' && (
          <i className="toy-badge">
            <IconClock size={11} />
          </i>
        )}
      </span>
      <span className="toy-lbl">{t.state === 'asked' ? 'asked' : t.label}</span>
    </motion.button>
  )
}

export function PlayTray(p: {
  images: Media
  voice: Media
  onPhoto: (once: boolean) => void
  onRecord: () => void
  onAudio: () => void
  onAskImages: () => void
  onAskVoice: () => void
  onDoodle: () => void
  onTot: () => void
  onGame: (k: 'ttt' | 'rps') => void
  onToy: (k: 'truth' | 'dare' | 'dice' | 'coin') => void
  on8ball: () => void
  onWish: () => void
  onConfetti: () => void
}) {
  const img = (go: () => void) => (p.images === 'ok' ? go : p.onAskImages)
  const vo = (go: () => void) => (p.voice === 'ok' ? go : p.onAskVoice)
  const send: Tile[] = [
    { id: 'photo', label: 'photo', ico: <IconImage size={26} />, state: p.images, go: img(() => p.onPhoto(false)) },
    { id: 'once', label: 'view once', ico: <IconOnce size={26} />, state: p.images, go: img(() => p.onPhoto(true)) },
    { id: 'voice', label: 'voice', ico: <IconMic size={26} />, state: p.voice, go: vo(p.onRecord) },
    { id: 'audio', label: 'audio file', ico: <IconWave size={26} />, state: p.voice, go: vo(p.onAudio) },
    { id: 'doodle', label: 'doodle', ico: <IconPen size={26} />, go: p.onDoodle },
  ]
  const games: Tile[] = [
    { id: 'ttt', label: 'tic tac toe', ico: <IconTicTacToe size={30} />, go: () => p.onGame('ttt') },
    { id: 'rps', label: 'rock paper scissors', ico: <IconScissors size={30} />, go: () => p.onGame('rps') },
    { id: 'tot', label: 'this or that', ico: <IconScales size={30} />, go: p.onTot },
  ]
  const quick: Tile[] = [
    { id: 'truth', label: 'truth', ico: <IconTruth size={26} />, go: () => p.onToy('truth') },
    { id: 'dare', label: 'dare', ico: <IconFlame size={26} />, go: () => p.onToy('dare') },
    { id: '8ball', label: '8 ball', ico: <IconEightBall size={26} />, go: p.on8ball },
    { id: 'dice', label: 'dice', ico: <IconDice size={26} />, go: () => p.onToy('dice') },
    { id: 'coin', label: 'coin', ico: <IconCoin size={26} />, go: () => p.onToy('coin') },
    { id: 'wish', label: 'wish', ico: <IconShootingStar size={26} />, go: p.onWish },
    { id: 'confetti', label: 'confetti', ico: <IconSparkle size={26} />, go: p.onConfetti },
  ]
  return (
    <div className="play">
      <div className="toy-grid">
        {send.map((t, i) => (
          <TileBtn key={t.id} t={t} i={i} />
        ))}
      </div>
      <h4 className="play-label">games</h4>
      <div className="toy-grid is-games">
        {games.map((t, i) => (
          <TileBtn key={t.id} t={t} i={i + 5} big />
        ))}
      </div>
      <h4 className="play-label">quick</h4>
      <div className="toy-grid">
        {quick.map((t, i) => (
          <TileBtn key={t.id} t={t} i={i + 8} />
        ))}
      </div>
    </div>
  )
}

type Pack = 'me' | 'us' | 'hate' | 'lust'

/** Sticker packs, shared by 1:1 chats and rooms. Long press a sticker to share it outside the app. */
export function StickerTray({ name, peerName, spicy, couples, onSend }: { name: string; peerName?: string; spicy: boolean; couples: boolean; onSend: (body: string) => void }) {
  const packs: { id: Pack; thumb: ReactNode }[] = [
    { id: 'me', thumb: <Sticker kind="hey" name={name} size={30} /> },
    ...(couples ? [{ id: 'us' as const, thumb: <CoupleSticker kind="c_hug" a={name} b={peerName ?? ''} size={34} /> }] : []),
    { id: 'hate', thumb: <Sticker kind="hate" name={name} size={30} /> },
    ...(spicy ? [{ id: 'lust' as const, thumb: <Sticker kind="lust" name={name} size={30} /> }] : []),
  ]
  const stored = load('gat.pack') as Pack | null
  const [pack, setPack] = useState<Pack>(packs.some((x) => x.id === stored) ? stored! : 'me')
  const lp = useRef<{ t?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false })
  return (
    <div className="stk-wrap">
      <div className={'stk-grid' + (pack === 'us' ? ' is-couple' : '')} key={pack}>
        {pack !== 'us'
          ? STICKERS.filter((st) => st.pack === pack).map((st, i) => (
              <motion.button
                key={st.id}
                type="button"
                className="stk-pick"
                aria-label={st.caption}
                initial={{ scale: 0.4, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.025 * i, type: 'spring', stiffness: 520, damping: 22 }}
                whileTap={{ scale: 0.82 }}
                onPointerDown={(e) => {
                  const el = e.currentTarget
                  lp.current.fired = false
                  lp.current.t = setTimeout(() => {
                    lp.current.fired = true
                    navigator.vibrate?.(14)
                    void shareSticker(el, st.caption)
                  }, 520)
                }}
                onPointerUp={() => clearTimeout(lp.current.t)}
                onPointerLeave={() => clearTimeout(lp.current.t)}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (lp.current.fired) return
                  navigator.vibrate?.(8)
                  onSend(stickerBody(st.id))
                }}
              >
                <Sticker kind={st.id} name={name} size={78} />
              </motion.button>
            ))
          : COUPLES.map((st, i) => (
              <motion.button
                key={st.id}
                type="button"
                className="stk-pick"
                aria-label={st.caption}
                initial={{ scale: 0.4, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i, type: 'spring', stiffness: 520, damping: 22 }}
                whileTap={{ scale: 0.82 }}
                onClick={() => {
                  navigator.vibrate?.(8)
                  onSend(stickerBody(st.id))
                }}
              >
                <CoupleSticker kind={st.id} a={name} b={peerName ?? ''} size={104} />
              </motion.button>
            ))}
      </div>
      {packs.length > 1 && (
        <div className="stk-packs" role="tablist" aria-label="sticker packs">
          {packs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={pack === x.id}
              aria-label={x.id === 'us' ? 'us two' : x.id}
              className={'stk-pack' + (pack === x.id ? ' is-on' : '')}
              onClick={() => {
                save('gat.pack', x.id)
                setPack(x.id)
              }}
            >
              {x.thumb}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Kaomoji by mood; a tap adds the face to whatever you're typing. */
export function FacesTray({ onPick }: { onPick: (k: string) => void }) {
  const stored = load('gat.faces')
  const [cat, setCat] = useState(KAOMOJI.some((c) => c.id === stored) ? stored! : KAOMOJI[0].id)
  const [hit, setHit] = useState<string | null>(null)
  const list = KAOMOJI.find((c) => c.id === cat)?.list ?? []
  return (
    <div className="faces-tray">
      <div className="faces-cats" role="tablist" aria-label="moods">
        {KAOMOJI.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={'faces-cat' + (cat === c.id ? ' is-on' : '')}
            onClick={() => {
              save('gat.faces', c.id)
              setCat(c.id)
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="faces-grid" key={cat}>
        {list.map((k, i) => (
          <motion.button
            key={k + i}
            type="button"
            className={'faces-k' + ([...k].length > 11 ? ' is-wide' : '') + (hit === k ? ' is-hit' : '')}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 14) * 0.015 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              navigator.vibrate?.(6)
              setHit(k)
              setTimeout(() => setHit(null), 350)
              onPick(k)
            }}
          >
            {k}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
