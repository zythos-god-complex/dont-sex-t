// Full scenes for the signature themes. Each is a composed background (focal point + depth + weather),
// not just floating particles. Drawn in the app's ink style; cheap CSS animation only.
import type { CSSProperties, ReactNode } from 'react'
import { doodleTile } from './doodles'

const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const v = (o: Record<string, string | number>) => o as CSSProperties

// ------------------------------------------------------------------ batman: just the signal

// the classic emblem
const BAT_LOGO = (
  <svg viewBox="0 0 100 44" width="100%" height="100%">
    <path d="M50 10 L46.5 3 L45.5 11 C38 9 27 8.5 15 12 C23 15 25.5 21 22 26 C29 23 35.5 25 37.5 31.5 C41.5 27.5 46 28 50 36 C54 28 58.5 27.5 62.5 31.5 C64.5 25 71 23 78 26 C74.5 21 77 15 85 12 C73 8.5 62 9 54.5 11 L53.5 3 Z" />
  </svg>
)

/** A dark sky with one soft glow and the bat-signal drifting slowly through it. Two layers, transform only. */
export function BatmanScene() {
  return (
    <div className="amb sc-bat" aria-hidden="true">
      <span className="bm-glow" />
      <span className="bm-track">
        <span className="bm-signal">
          <span className="bm-logo">{BAT_LOGO}</span>
        </span>
      </span>
    </div>
  )
}

// ------------------------------------------------------------------ love: love letter

const HEART_D = 'M50 88 C50 88 8 62 8 32 C8 17 19 8 31 8 C40 8 46 13 50 20 C54 13 60 8 69 8 C81 8 92 17 92 32 C92 62 50 88 50 88 Z'
const WINE = '#5B0F25'

const InkHeart = ({ c }: { c: string }) => (
  <svg viewBox="0 0 100 96" width="100%" height="100%">
    <path d={HEART_D} fill={c} stroke={WINE} strokeWidth="7" strokeLinejoin="round" />
    <ellipse cx="30" cy="30" rx="9" ry="6" transform="rotate(-30 30 30)" fill="#FFFFFF" opacity="0.55" />
  </svg>
)
const Letter = () => (
  <svg viewBox="0 0 44 32" width="100%" height="100%">
    <rect x="2" y="2" width="40" height="28" rx="4" fill="#FFFFFF" stroke={WINE} strokeWidth="2.2" />
    <path d="M3 4 L22 18 L41 4" fill="none" stroke={WINE} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M22 23 C22 23 15 19 15 15 C15 13 16.6 11.8 18.3 11.8 C19.8 11.8 21 12.7 22 14 C23 12.7 24.2 11.8 25.7 11.8 C27.4 11.8 29 13 29 15 C29 19 22 23 22 23 Z" fill="#F0285A" stroke={WINE} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)
const LOVE_COLORS = ['#F0285A', '#FF6B91', '#FFB3C7', '#FFFFFF', '#C70F40']

export function LoveScene({ n }: { n: number }) {
  return (
    <div className="amb sc-love" aria-hidden="true">
      <span className="lv-paper" />
      <span className="lv-big">
        <svg viewBox="0 0 100 96" width="100%" height="100%">
          <defs>
            <radialGradient id="lvglow" cx="50%" cy="42%" r="60%">
              <stop offset="0%" stopColor="#FF5A87" stopOpacity="0.34" />
              <stop offset="70%" stopColor="#FF5A87" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#FF5A87" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <path d={HEART_D} className="lv-core" fill="url(#lvglow)" />
        </svg>
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 100 96" width="100%" height="100%" className="lv-ring" style={v({ '--i': i })}>
            <path d={HEART_D} />
          </svg>
        ))}
      </span>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          className="lv-h"
          style={v({
            '--x': `${Math.round(4 + rnd(i, 1) * 92)}%`,
            '--d': `${(11 + rnd(i, 2) * 9).toFixed(1)}s`,
            '--delay': `${(-rnd(i, 3) * 20).toFixed(1)}s`,
            '--sz': `${Math.round(9 + rnd(i, 4) * 9)}px`,
            '--drift': `${Math.round((rnd(i, 6) - 0.5) * 90)}px`,
            '--tilt': `${Math.round((rnd(i, 7) - 0.5) * 40)}deg`,
          })}
        >
          <InkHeart c={LOVE_COLORS[i % LOVE_COLORS.length]} />
        </i>
      ))}
      {[0, 1].map((i) => (
        <i key={'l' + i} className="lv-letter" style={v({ '--x': i ? '72%' : '18%', '--delay': `${-i * 11}s` })}>
          <Letter />
        </i>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ bff: scrapbook sticker sheet

const INK = '#2A1A4A'
const SK = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const Sticker = ({ children, box = '0 0 40 40' }: { children: ReactNode; box?: string }) => (
  <svg viewBox={box} width="100%" height="100%">
    {children}
  </svg>
)
const STICKERS: ReactNode[] = [
  <Sticker key="star"><path d="M20 3 L24.8 14.2 L37 15.2 L27.6 23.2 L30.6 35.4 L20 28.8 L9.4 35.4 L12.4 23.2 L3 15.2 L15.2 14.2 Z" fill="#FFC83D" {...SK} /></Sticker>,
  <Sticker key="heart"><path d="M20 35 C20 35 4 25 4 13.5 C4 8 8 4.5 12.5 4.5 C16 4.5 18.4 6.5 20 9.2 C21.6 6.5 24 4.5 27.5 4.5 C32 4.5 36 8 36 13.5 C36 25 20 35 20 35 Z" fill="#FF5CB8" {...SK} /></Sticker>,
  <Sticker key="smile">
    <circle cx="20" cy="20" r="16" fill="#FFE14D" {...SK} />
    <circle cx="14.5" cy="16.5" r="2.2" fill={INK} />
    <circle cx="25.5" cy="16.5" r="2.2" fill={INK} />
    <path d="M12.5 23 Q20 31 27.5 23" fill="none" {...SK} />
  </Sticker>,
  <Sticker key="flower">
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="20" cy="10.5" rx="6.5" ry="8.5" transform={`rotate(${a} 20 20)`} fill="#8A6BFF" {...SK} />
    ))}
    <circle cx="20" cy="20" r="6" fill="#FFC83D" {...SK} />
  </Sticker>,
  <Sticker key="bolt" box="0 0 30 40"><path d="M18 2 L4 23 H14 L11 38 L26 15 H16 Z" fill="#3DD6B5" {...SK} /></Sticker>,
  <Sticker key="rainbow" box="0 0 48 30">
    <path d="M4 26 A20 20 0 0 1 44 26" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
    <path d="M4 26 A20 20 0 0 1 44 26" fill="none" stroke="#FF5C7A" strokeWidth="8" strokeLinecap="round" />
    <path d="M11 26 A13 13 0 0 1 37 26" fill="none" stroke="#FFC83D" strokeWidth="6" strokeLinecap="round" />
    <path d="M17 26 A7 7 0 0 1 31 26" fill="none" stroke="#5BB5FF" strokeWidth="5" strokeLinecap="round" />
  </Sticker>,
  <Sticker key="bff" box="0 0 54 30">
    <rect x="2.5" y="2.5" width="49" height="25" rx="12.5" fill="#FF5CB8" {...SK} />
    <text x="27" y="20.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="14" fill="#FFFFFF" stroke={INK} strokeWidth="0.8" letterSpacing="1">BFF</text>
  </Sticker>,
  <Sticker key="spark"><path d="M20 3 L23 17 L37 20 L23 23 L20 37 L17 23 L3 20 L17 17 Z" fill="#5BB5FF" {...SK} /></Sticker>,
  <Sticker key="cherry" box="0 0 40 40">
    <path d="M14 26 Q16 12 26 6 M26 26 Q24 14 26 6" fill="none" {...SK} />
    <path d="M26 6 Q33 4 35 10 Q29 11 26 6 Z" fill="#7BD66B" {...SK} />
    <circle cx="13" cy="28" r="7" fill="#FF4D5E" {...SK} />
    <circle cx="27" cy="28" r="7" fill="#FF4D5E" {...SK} />
  </Sticker>,
]
// spots hug the edges so the sticker sheet frames the conversation instead of sitting under it
const SPOTS = [
  { x: 5, y: 12, s: 30, r: -12 },
  { x: 86, y: 9, s: 34, r: 10 },
  { x: 4, y: 44, s: 28, r: 8 },
  { x: 87, y: 40, s: 30, r: -8 },
  { x: 84, y: 70, s: 38, r: -8 },
  { x: 6, y: 78, s: 32, r: 12 },
]

export function BffScene({ n }: { n: number }) {
  return (
    <div className="amb sc-bff" aria-hidden="true">
      <span className="bf-grid" />
      <span className="bf-tape t1" />
      <span className="bf-tape t2" />
      {SPOTS.map((p, i) => (
        <i key={i} className="bf-stk" style={v({ '--x': `${p.x}%`, '--y': `${p.y}%`, '--sz': `${p.s}px`, '--r': `${p.r}deg`, '--i': i })}>
          {STICKERS[i % STICKERS.length]}
        </i>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <b
          key={i}
          className="bf-cf"
          style={v({
            '--x': `${Math.round(rnd(i, 1) * 100)}%`,
            '--d': `${(10 + rnd(i, 2) * 8).toFixed(1)}s`,
            '--delay': `${(-rnd(i, 3) * 18).toFixed(1)}s`,
            '--drift': `${Math.round((rnd(i, 6) - 0.5) * 120)}px`,
            '--r': `${Math.round(rnd(i, 7) * 360)}deg`,
          })}
        />
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ lust: doodle wallpaper

/** A static line-doodle wallpaper (spicy set only when both people have nsfw on), a low glow, a few embers. */
export function LustScene({ n, spicy }: { n: number; spicy: boolean }) {
  const tile = doodleTile(spicy)
  return (
    <div className="amb sc-lust" aria-hidden="true">
      <span className="ls-lamp" />
      <span className="ls-doodles" style={{ WebkitMaskImage: tile, maskImage: tile }} />
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          className="ls-ember"
          style={v({
            '--x': `${Math.round(rnd(i, 1) * 100)}%`,
            '--d': `${(14 + rnd(i, 2) * 10).toFixed(1)}s`,
            '--delay': `${(-rnd(i, 3) * 20).toFixed(1)}s`,
            '--drift': `${Math.round((rnd(i, 6) - 0.5) * 60)}px`,
          })}
        />
      ))}
    </div>
  )
}
