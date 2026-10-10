import { memo, type CSSProperties, type ReactNode } from 'react'
import { GoofyFace } from '../../ui/GoofyFace'
import { useAvatarFor } from '../../ui/avatars'
import { applyAvatar, faceTraits } from '../../ui/face'
import { STICKERS, type StickerKind } from './stickers'
import { Ban, Bin, Ghost, Padlock, Chili, ClownNose, Flame, Fly, Lips, Moon, Peach, Phone, Pitchfork, Point, Puff, ThumbDown, XMark } from './props'

export const Heart = ({ c = '#FF4F8B' }: { c?: string }) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z" fill={c} stroke="#17131F" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
)
const Hand = ({ c }: { c: string }) => (
  <svg viewBox="0 0 40 48" width="100%" height="100%">
    <path d="M10 30c-4-6-6-11-3.5-12.5S12 20 14 23l-2-15c-.4-3 1.5-4.6 3.4-4.6S18.6 5 19 8l.6 9 .4-12c.1-3 2-4.2 3.8-4s3.4 1.5 3.3 4.5L27 17l1.6-9c.5-2.8 2.5-3.8 4.2-3.3s2.8 2.2 2.3 5L33 24c-.6 9-2 14-9 18-6 3.4-11 0-14-12z" fill={c} stroke="#17131F" strokeWidth="2.4" strokeLinejoin="round" />
  </svg>
)
const Drop = () => (
  <svg viewBox="0 0 10 14" width="100%" height="100%">
    <path d="M5 1C3 5 1 7 1 9.4A4 4 0 0 0 9 9.4C9 7 7 5 5 1z" fill="#6CC6FF" stroke="#17131F" strokeWidth="1.3" />
  </svg>
)
const Spark = ({ c }: { c: string }) => (
  <svg viewBox="0 0 20 20" width="100%" height="100%">
    <path d="M10 1l2.2 6.8L19 10l-6.8 2.2L10 19l-2.2-6.8L1 10l6.8-2.2z" fill={c} stroke="#17131F" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)
const Cloud = () => (
  <svg viewBox="0 0 60 34" width="100%" height="100%">
    <path d="M14 30C6 30 3 25 4 20.5S10 13 14 14c1-6 7-11 14-10 6 .8 9 5 10 9 3-2 9-2 12 2 3 4 2 9-1 12-1.6 1.8-4 3-7 3z" fill="#B9C3D6" stroke="#17131F" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
)

const many = (n: number, f: (i: number) => ReactNode) => Array.from({ length: n }, (_, i) => f(i))
const At = ({ cls, i, children }: { cls: string; i?: number; children: ReactNode }) => (
  <i className={cls} style={{ '--i': i ?? 0 } as CSSProperties}>
    {children}
  </i>
)
const Stink = () => (
  <svg viewBox="0 0 12 40" width="100%" height="100%">
    <path d="M6 38 C1 31 11 25 6 19 C1 13 11 7 6 1" fill="none" stroke="#17131F" strokeWidth="5.4" strokeLinecap="round" />
    <path d="M6 38 C1 31 11 25 6 19 C1 13 11 7 6 1" fill="none" stroke="#8FD14F" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)
const Tail = () => (
  <svg viewBox="0 0 60 60" width="100%" height="100%">
    <path d="M6 54 C30 50 18 26 38 20" fill="none" stroke="#17131F" strokeWidth="7" strokeLinecap="round" />
    <path d="M6 54 C30 50 18 26 38 20" fill="none" stroke="#E5383B" strokeWidth="4" strokeLinecap="round" />
    <path d="M34 12 L52 10 L44 28 Z" fill="#E5383B" stroke="#17131F" strokeWidth="2.4" strokeLinejoin="round" />
  </svg>
)
const PUFFS = ['#FF5C7A', '#FFC83D', '#5BC0FF', '#B6E35A']

/** Hate + lust packs: pieces behind the face, on the face, and in front. Everything drawn, no emoji. */
function packFx(kind: StickerKind, color: string): { back?: ReactNode; body?: ReactNode; front?: ReactNode } {
  switch (kind) {
    case 'hate':
      return {
        back: (
          <>
            <span className="stk-hateburst" />
            {['#', '@', '$', '%', '!', '&'].map((c, i) => (
              <i key={i} className="stk-curse" style={{ '--i': i } as CSSProperties}>
                {c}
              </i>
            ))}
          </>
        ),
        front: (
          <>
            <At cls="fx-thumb">
              <ThumbDown c={color} />
            </At>
          </>
        ),
      }
    case 'nope':
      return { front: many(3, (i) => <At key={i} cls="fx-x" i={i}><XMark /></At>) }
    case 'ew':
      return {
        back: <span className="fx-ewglow" />,
        front: many(3, (i) => <At key={i} cls="fx-stink" i={i}><Stink /></At>),
      }
    case 'talkhand':
      return { front: <At cls="fx-palm"><Hand c={color} /></At> }
    case 'trash':
      return {
        front: (
          <>
            <At cls="fx-bin"><Bin /></At>
            {many(2, (i) => <At key={i} cls="fx-fly" i={i}><Fly /></At>)}
          </>
        ),
      }
    case 'clown':
      return {
        back: many(4, (i) => <At key={i} cls="fx-puff" i={i}><Puff c={PUFFS[i]} /></At>),
        front: <At cls="fx-nosegift"><ClownNose /></At>,
      }
    case 'blocked':
      return { front: <At cls="fx-stamp"><Ban /></At> }
    case 'loser':
      return { body: <i className="fx-L">L</i>, front: <At cls="fx-point"><Point c={color} /></At> }
    case 'lust':
      return {
        back: (
          <>
            <span className="stk-heat" />
            {many(4, (i) => <At key={i} cls="fx-flame" i={i}><Flame /></At>)}
          </>
        ),
        front: many(2, (i) => <At key={i} cls="fx-lipsfly" i={i}><Lips /></At>),
      }
    case 'uup':
      return {
        back: <span className="fx-night">{many(5, (i) => <b key={i} style={{ '--i': i } as CSSProperties} />)}</span>,
        front: (
          <>
            <At cls="fx-moon"><Moon /></At>
            <At cls="fx-buzz"><Phone /></At>
          </>
        ),
      }
    case 'kissme':
      return { front: many(4, (i) => <At key={i} cls="fx-smooch" i={i}><Lips /></At>) }
    case 'thirsty':
      return { front: many(4, (i) => <At key={i} cls="fx-splash" i={i}><Drop /></At>) }
    case 'spicy':
      return {
        back: <span className="stk-heat" />,
        front: (
          <>
            {many(3, (i) => <At key={i} cls="fx-orbit" i={i}><Chili /></At>)}
            <i className="stk-steam s0" />
            <i className="stk-steam s1" />
          </>
        ),
      }
    case 'peach':
      return {
        front: (
          <>
            <At cls="fx-jiggle"><Peach /></At>
            {many(3, (i) => <At key={i} cls="fx-twinkle" i={i}><Spark c="#FFE14D" /></At>)}
          </>
        ),
      }
    case 'downbad':
      return {
        body: (
          <>
            <i className="fx-heye l"><Heart c="#FF2D55" /></i>
            <i className="fx-heye r"><Heart c="#FF2D55" /></i>
            <i className="fx-drool"><Drop /></i>
          </>
        ),
        front: many(3, (i) => <At key={i} cls="fx-lovefloat" i={i}><Heart /></At>),
      }
    case 'naughty':
      return {
        back: (
          <>
            <span className="fx-devilglow" />
            <At cls="fx-tail"><Tail /></At>
          </>
        ),
        front: <At cls="fx-fork"><Pitchfork /></At>,
      }
    default:
      return {}
  }
}

const AWAY: Partial<Record<StickerKind, { x: number; y: number }>> = { talkhand: { x: -1, y: -0.2 }, blocked: { x: 1, y: -0.3 }, uup: { x: 0.7, y: 0.9 }, trash: { x: 0.8, y: 0.4 } }
const HORNED: readonly StickerKind[] = ['lust', 'naughty']

function StickerImpl({ kind, name, size = 132 }: { kind: StickerKind; name: string; size?: number }) {
  const meta = STICKERS.find((s) => s.id === kind) ?? STICKERS[0]
  const custom = useAvatarFor(name)
  const color = applyAvatar(faceTraits(name), custom).color
  const face = Math.round(size * 0.66)
  const fx = packFx(kind, color)
  return (
    <span className={'stk stk-' + kind} style={{ width: size, height: size, '--c': color } as CSSProperties}>
      <span className="stk-fx stk-back">
        {kind === 'love' && (
          <span className="stk-orbit">
            {[0, 1, 2].map((i) => (
              <i key={i} style={{ '--i': i } as CSSProperties}>
                <Heart c={i === 1 ? '#FF9ECF' : '#FF4F8B'} />
              </i>
            ))}
          </span>
        )}
        {kind === 'hype' &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} className="stk-spark" style={{ '--i': i } as CSSProperties}>
              <Spark c={['#FFC83D', '#5BC0FF', '#FF5C7A', '#B6E35A', '#C69CFF', '#FF8A3D'][i]} />
            </i>
          ))}
        {kind === 'sad' && (
          <span className="stk-cloud">
            <Cloud />
            {[0, 1, 2].map((i) => (
              <i key={i} className="stk-rain" style={{ '--i': i } as CSSProperties}>
                <Drop />
              </i>
            ))}
          </span>
        )}
        {kind === 'angry' && <span className="stk-rage" />}
        {fx.back}
      </span>
      <span className="stk-body">
        <GoofyFace name={name} size={face} mood={meta.mood} blink={kind !== 'gn' && kind !== 'sad' && kind !== 'hate'} horns={HORNED.includes(kind) ? true : undefined} look={AWAY[kind]} />
        {fx.body}
        {kind === 'hugs' && (
          <>
            <i className="stk-arm l" />
            <i className="stk-arm r" />
          </>
        )}
      </span>
      <span className="stk-fx stk-front">
        {(kind === 'hey' || kind === 'bye') && (
          <i className="stk-hand">
            <Hand c={color} />
          </i>
        )}
        {kind === 'shy' && (
          <i className="stk-hand shy">
            <Hand c={color} />
          </i>
        )}
        {kind === 'kiss' &&
          [0, 1, 2].map((i) => (
            <i key={i} className="stk-kiss" style={{ '--i': i } as CSSProperties}>
              <Heart />
            </i>
          ))}
        {kind === 'lol' &&
          [0, 1].map((i) => (
            <i key={i} className={'stk-tear t' + i}>
              <Drop />
            </i>
          ))}
        {kind === 'angry' &&
          [0, 1].map((i) => (
            <i key={i} className={'stk-steam s' + i} />
          ))}
        {kind === 'gn' &&
          [0, 1, 2].map((i) => (
            <i key={i} className="stk-z" style={{ '--i': i } as CSSProperties}>
              z
            </i>
          ))}
        {kind === 'dead' && (
          <i className="stk-ghost">
            <Ghost />
          </i>
        )}
        {fx.front}
      </span>
      <span className="stk-cap">{meta.caption}</span>
    </span>
  )
}

export const Sticker = memo(StickerImpl)

/** What people without nsfw (on both sides) see instead of a spicy sticker. */
export function LockedSticker({ size = 132 }: { size?: number }) {
  return (
    <span className="stk stk-locked" style={{ width: size, height: size }}>
      <span className="stk-locked-in">
        <i>
          <Padlock />
        </i>
      </span>
    </span>
  )
}
