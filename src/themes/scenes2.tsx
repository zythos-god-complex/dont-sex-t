// Night scenes from Ember's list: meteor shower, rain temple, sakura night, blue butterflies.
// Transform + opacity only, counts follow the ambient amount slider.
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { onFx } from './fx'

function rnd(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function Stars({ n, salt }: { n: number; salt: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          className="nx-star"
          style={{ left: `${rnd(i, salt) * 100}%`, top: `${rnd(i, salt + 3) * 62}%`, '--d': `${2 + rnd(i, salt + 5) * 4}s`, '--s': `${1 + rnd(i, salt + 7) * 1.6}px` } as CSSProperties}
        />
      ))}
    </>
  )
}

/** shows its children for `ms` every time the fx fires */
function useFx(kind: 'wish' | 'thunder', ms: number) {
  const [k, setK] = useState(0)
  useEffect(() => onFx((f) => f === kind && setK((v) => v + 1)), [kind])
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!k) return
    setOn(true)
    const t = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(t)
  }, [k, ms])
  return on ? k : 0
}

/* ---------------------------------------------------------------- meteor shower */
export function MeteorScene({ n }: { n: number }) {
  const wish = useFx('wish', 3800)
  return (
    <div className="amb sc-meteor" aria-hidden="true">
      <span className="mt-glow" />
      <Stars n={46} salt={1} />
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="mt-fall"
          style={{ left: `${30 + rnd(i, 11) * 80}%`, top: `${-4 + rnd(i, 13) * 30}%`, '--d': `${9 + rnd(i, 17) * 9}s`, '--w': `-${rnd(i, 19) * 14}s` } as CSSProperties}
        >
          <i />
        </span>
      ))}
      {wish > 0 &&
        createPortal(
          <div className="mt-wish" key={wish} aria-live="polite">
            <span className="mt-big">
              <i />
            </span>
            <p className="mt-text">ohh you caught a star... make a wish ✨</p>
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ---------------------------------------------------------------- rain temple */
export function TempleScene({ n }: { n: number }) {
  const strike = useFx('thunder', 900)
  return (
    <div className="amb sc-temple" aria-hidden="true">
      <svg className="tp-land" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
        <path className="tp-far" d="M0 170 L40 120 L70 150 L120 90 L160 140 L210 100 L250 150 L300 95 L350 140 L400 110 V300 H0 Z" />
        <g className="tp-near">
          <path d="M226 172 Q290 160 354 172 Q330 170 322 178 H258 Q250 170 226 172 Z M240 146 Q290 136 340 146 Q322 145 314 152 H266 Q258 145 240 146 Z M254 122 Q290 114 326 122 Q312 121 306 127 H274 Q268 121 254 122 Z" />
          <rect x="258" y="178" width="64" height="34" />
          <rect x="266" y="152" width="48" height="20" />
          <rect x="274" y="127" width="32" height="19" />
          <rect x="288" y="98" width="4" height="26" />
          <circle cx="290" cy="97" r="3.5" />
          <path d="M30 140 Q90 128 150 140 L146 148 Q90 138 34 148 Z" />
          <rect x="46" y="156" width="88" height="6" />
          <rect x="56" y="146" width="8" height="66" />
          <rect x="116" y="146" width="8" height="66" />
          <path d="M184 212 v-10 h12 v10 Z M180 202 h20 l-4 -6 h-12 Z M186 196 h8 v-6 h-8 Z M182 190 h16 l-8 -6 Z" />
          <path d="M0 212 H400 V300 H0 Z" />
        </g>
        <ellipse className="tp-lamp" cx="190" cy="200" rx="30" ry="14" />
      </svg>
      <span className="tp-mist" />
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="tp-drop" style={{ left: `${rnd(i, 21) * 104 - 2}%`, '--d': `${0.55 + rnd(i, 23) * 0.4}s`, '--w': `-${rnd(i, 25) * 1.2}s`, '--h': `${14 + rnd(i, 27) * 16}px` } as CSSProperties} />
      ))}
      {strike > 0 &&
        createPortal(
          <div className="tp-strike" key={strike}>
            <svg className="tp-bolt" viewBox="0 0 60 200" style={{ left: `${18 + (strike * 37) % 60}%` }}>
              <path d="M34 0 L14 86 L30 86 L10 200 L50 70 L32 70 L48 0 Z" />
            </svg>
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ---------------------------------------------------------------- sakura night */
export function SakuraNightScene({ n }: { n: number }) {
  return (
    <div className="amb sc-sknight" aria-hidden="true">
      <span className="sk-moon" />
      <Stars n={26} salt={31} />
      <svg className="sk-tree" viewBox="0 0 220 200">
        <path d="M0 40 C40 50 70 70 96 96 C110 110 128 116 150 114 M60 64 C70 40 92 28 120 26 M96 96 C100 120 98 150 86 200 M30 46 C26 30 30 18 40 8" fill="none" stroke="#140C22" strokeWidth="7" strokeLinecap="round" />
        {Array.from({ length: 34 }, (_, i) => (
          <circle key={i} cx={20 + rnd(i, 41) * 150} cy={6 + rnd(i, 43) * 110} r={7 + rnd(i, 45) * 11} fill={i % 3 ? '#E9A3C8' : '#C97BAA'} opacity={0.55 + rnd(i, 47) * 0.35} />
        ))}
      </svg>
      <span className="sk-lampglow" />
      <svg className="sk-street" viewBox="0 0 200 260" preserveAspectRatio="xMaxYMax meet">
                <path d="M148 250 V78 M148 78 h-10 l-6 -14 h32 l-6 14 Z" stroke="#0E0A1C" strokeWidth="5" fill="#0E0A1C" />
        <circle cx="148" cy="74" r="6" fill="#FFD9A0" />
        <path d="M40 220 h76 v6 h-76 Z M40 208 h76 v5 h-76 Z M46 226 v18 M110 226 v18" stroke="#0E0A1C" strokeWidth="5" />
      </svg>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="sk-petal" style={{ left: `${rnd(i, 51) * 100}%`, '--d': `${8 + rnd(i, 53) * 7}s`, '--w': `-${rnd(i, 55) * 14}s`, '--x': `${-30 - rnd(i, 57) * 60}px` } as CSSProperties} />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- blue butterflies */
const WING = 'M0 0 C-6 -14 -24 -20 -28 -8 C-30 2 -16 6 0 2 Z M0 2 C-12 6 -20 16 -14 22 C-8 26 -2 14 0 4 Z'

export function ButterflyScene({ n }: { n: number }) {
  return (
    <div className="amb sc-bfly" aria-hidden="true">
      <span className="bf-lamp" />
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} className="bf-orb" style={{ left: `${rnd(i, 61) * 100}%`, top: `${rnd(i, 63) * 100}%`, '--s': `${10 + rnd(i, 65) * 26}px`, '--d': `${6 + rnd(i, 67) * 6}s` } as CSSProperties} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="bf-path" style={{ left: `${8 + rnd(i, 71) * 70}%`, top: `${12 + rnd(i, 73) * 60}%`, '--d': `${12 + rnd(i, 75) * 8}s`, '--w': `-${rnd(i, 77) * 10}s` } as CSSProperties}>
          <svg className="bf" viewBox="-32 -24 64 50" width={30 + (i % 3) * 8}>
            <g>
              <path d={WING} />
              <animateTransform attributeName="transform" type="scale" values="1 1;0.28 1;1 1" dur={`${0.32 + (i % 3) * 0.06}s`} repeatCount="indefinite" />
            </g>
            <g transform="scale(-1 1)">
              <g>
                <path d={WING} />
                <animateTransform attributeName="transform" type="scale" values="1 1;0.28 1;1 1" dur={`${0.32 + (i % 3) * 0.06}s`} repeatCount="indefinite" />
              </g>
            </g>
            <path d="M0 -6 V14" stroke="#06223A" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  )
}
