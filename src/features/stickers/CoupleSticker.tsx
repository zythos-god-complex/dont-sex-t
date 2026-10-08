import { memo, type CSSProperties } from 'react'
import { GoofyFace } from '../../ui/GoofyFace'
import { useAvatarFor } from '../../ui/avatars'
import { applyAvatar, faceTraits } from '../../ui/face'
import { Heart } from './Sticker'
import { COUPLES, type CoupleKind } from './stickers'

function useColor(name: string) {
  const custom = useAvatarFor(name)
  return applyAvatar(faceTraits(name), custom).color
}

/** Two characters together: a = sender (left), b = the other person (right, facing left). */
function CoupleImpl({ kind, a, b, size = 168 }: { kind: CoupleKind; a: string; b: string; size?: number }) {
  const meta = COUPLES.find((c) => c.id === kind) ?? COUPLES[0]
  const ca = useColor(a)
  const cb = useColor(b)
  const face = Math.round(size * 0.4)
  return (
    <span className={'cpl cpl-k-' + kind.slice(2)} style={{ width: size, height: size * 0.66, '--ca': ca, '--cb': cb } as CSSProperties}>
      <span className="stk-fx cpl-back">
        {kind === 'c_heart' && (
          <svg className="cpl-bigheart" viewBox="0 0 24 24">
            <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z" fill="#FF4F8B" stroke="#17131F" strokeWidth="1.4" strokeLinejoin="round" pathLength={100} />
          </svg>
        )}
        {kind === 'c_hands' && (
          <svg className="cpl-handline" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M8 4 Q50 34 92 4" fill="none" stroke="#17131F" strokeWidth="5" strokeLinecap="round" />
            <path d="M8 4 Q50 34 92 4" fill="none" stroke="var(--ca)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="cpl-a">
        <GoofyFace name={a} size={face} mood={meta.a} blink={meta.a !== 'sleepy'} />
      </span>
      <span className="cpl-b">
        <span className="cpl-flip">
          <GoofyFace name={b} size={face} mood={meta.b} blink={meta.b !== 'sleepy'} />
        </span>
      </span>
      <span className="stk-fx cpl-front">
        {(kind === 'c_kiss' || kind === 'c_hug' || kind === 'c_cuddle' || kind === 'c_forehead' || kind === 'c_missyou') &&
          [0, 1, 2].map((i) => (
            <i key={i} className="cpl-heart" style={{ '--i': i } as CSSProperties}>
              <Heart c={i === 1 ? '#FF9ECF' : '#FF4F8B'} />
            </i>
          ))}
        {kind === 'c_cheek' && (
          <i className="cpl-peck">
            <Heart />
          </i>
        )}
        {kind === 'c_boop' && <i className="cpl-word">boop!</i>}
        {kind === 'c_highfive' &&
          [0, 1, 2, 3, 4].map((i) => <i key={i} className="cpl-spark" style={{ '--i': i } as CSSProperties} />)}
        {kind === 'c_dance' &&
          ['♪', '♫', '♪'].map((n, i) => (
            <i key={i} className="cpl-note" style={{ '--i': i } as CSSProperties}>
              {n}
            </i>
          ))}
        {kind === 'c_pillow' && (
          <>
            <i className="cpl-pillow" />
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className="cpl-feather" style={{ '--i': i } as CSSProperties} />
            ))}
          </>
        )}
        {kind === 'c_forehead' && <i className="cpl-glow" />}
      </span>
      <span className="stk-cap cpl-cap">{meta.caption}</span>
    </span>
  )
}

export const CoupleSticker = memo(CoupleImpl)
