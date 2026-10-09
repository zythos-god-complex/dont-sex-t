// Sticker props, drawn in the house style: flat fills, 2.2px ink outline, no emoji.
const INK = '#17131F'
const S = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

/** A stroke with an ink outline: wide ink line under a thinner colored one. */
function Lined({ d, c, w = 3.6 }: { d: string; c: string; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

export const ThumbDown = ({ c }: { c: string }) => (
  <svg viewBox="0 0 40 50" width="100%" height="100%">
    <path d="M10 22 h9 v21 a4.5 4.5 0 0 1 -9 0 Z" fill={c} {...S} />
    <rect x="6" y="4" width="28" height="22" rx="9" fill={c} {...S} />
    <path d="M14 5 v9 M21 5 v10 M28 5 v9" {...S} fill="none" strokeWidth={1.8} />
  </svg>
)

export const Point = ({ c }: { c: string }) => (
  <svg viewBox="0 0 54 36" width="100%" height="100%">
    <rect x="22" y="7" width="27" height="24" rx="9" fill={c} {...S} />
    <rect x="2" y="9" width="30" height="10" rx="5" fill={c} {...S} />
    <path d="M30 23 h15 M31 27.5 h12" {...S} fill="none" strokeWidth={1.8} />
  </svg>
)

export const XMark = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%">
    <path d="M9 5 L20 16 L31 5 L35 9 L24 20 L35 31 L31 35 L20 24 L9 35 L5 31 L16 20 L5 9 Z" fill="#FF4D5E" {...S} strokeWidth={2.4} />
  </svg>
)

export const Bin = () => (
  <svg viewBox="0 0 40 50" width="100%" height="100%">
    <path d="M7 15 L10 45 Q10.3 47 12.5 47 H27.5 Q29.7 47 30 45 L33 15 Z" fill="#C7D0E0" {...S} />
    <path d="M15 20 L16 42 M20 20 V42 M25 20 L24 42" {...S} fill="none" strokeWidth={1.8} />
    <path d="M15 9 Q15 3.5 20 3.5 Q25 3.5 25 9" {...S} fill="none" />
    <rect x="4" y="9" width="32" height="6" rx="3" fill="#9AA6BD" {...S} />
  </svg>
)

export const Fly = () => (
  <svg viewBox="0 0 22 16" width="100%" height="100%">
    <ellipse cx="7" cy="6" rx="5.5" ry="3.6" transform="rotate(-25 7 6)" fill="#FFFFFF" fillOpacity={0.9} stroke={INK} strokeWidth={1.4} />
    <ellipse cx="15" cy="6" rx="5.5" ry="3.6" transform="rotate(25 15 6)" fill="#FFFFFF" fillOpacity={0.9} stroke={INK} strokeWidth={1.4} />
    <ellipse cx="11" cy="11" rx="4" ry="3.4" fill={INK} />
  </svg>
)

export const ClownNose = () => (
  <svg viewBox="0 0 30 30" width="100%" height="100%">
    <circle cx="15" cy="15" r="12" fill="#FF3B4E" {...S} strokeWidth={2.4} />
    <ellipse cx="11" cy="10.5" rx="4" ry="2.8" fill="#FFFFFF" opacity={0.75} />
  </svg>
)

export const Ban = () => (
  <svg viewBox="0 0 44 44" width="100%" height="100%">
    <circle cx="22" cy="22" r="16" fill="none" stroke={INK} strokeWidth={9.4} />
    <circle cx="22" cy="22" r="16" fill="none" stroke="#FF3B4E" strokeWidth={6} />
    <Lined d="M11 11 L33 33" c="#FF3B4E" w={6} />
  </svg>
)

export const Flame = ({ hot = '#FF5C39', core = '#FFC83D' }: { hot?: string; core?: string }) => (
  <svg viewBox="0 0 30 40" width="100%" height="100%">
    <path d="M15 2 C18 10 27 14 27 25 A12 12 0 0 1 3 25 C3 18 8 15 9 9 C11 13 12 15 13 15 C13 10 14 6 15 2 Z" fill={hot} {...S} />
    <path d="M15 18 C17 22 21 24 21 29 A6 6 0 0 1 9 29 C9 26 11 25 12 22 C13 24 14 24 15 18 Z" fill={core} />
  </svg>
)

export const Lips = ({ c = '#E5383B' }: { c?: string }) => (
  <svg viewBox="0 0 40 26" width="100%" height="100%">
    <path d="M2 12 C9 3 14 2 17 5 C18.6 6.6 21.4 6.6 23 5 C26 2 31 3 38 12 C30 24 10 24 2 12 Z" fill={c} {...S} />
    <path d="M3 12 Q20 16 37 12" {...S} fill="none" strokeWidth={1.8} />
    <ellipse cx="14" cy="17" rx="4" ry="1.6" fill="#FFFFFF" opacity={0.55} />
  </svg>
)

export const Phone = () => (
  <svg viewBox="0 0 28 44" width="100%" height="100%">
    <rect x="2" y="2" width="24" height="40" rx="6" fill="#2A2438" {...S} strokeWidth={2.4} />
    <rect x="5" y="7" width="18" height="29" rx="2.5" fill="#8FD9FF" />
    <rect x="7" y="11" width="14" height="8" rx="3.5" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
    <circle cx="11" cy="15" r="1" fill={INK} />
    <circle cx="14" cy="15" r="1" fill={INK} />
    <circle cx="17" cy="15" r="1" fill={INK} />
    <rect x="11" y="3.6" width="6" height="1.8" rx="0.9" fill="#4A425C" />
  </svg>
)

export const Moon = () => (
  <svg viewBox="0 0 30 30" width="100%" height="100%">
    <path d="M19 3 A13 13 0 1 0 27.5 21 A10 10 0 1 1 19 3 Z" fill="#FFE58A" {...S} />
  </svg>
)

export const Chili = () => (
  <svg viewBox="0 0 42 24" width="100%" height="100%">
    <path d="M8 8 C16 5 28 5 37 12 C39 14 36.5 17.5 33 16.5 C24 14 15 15 8 16.5 C3 17.5 2.5 9 8 8 Z" fill="#E5383B" {...S} />
    <path d="M11 10.5 C17 9 24 9 29 10.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />
    <path d="M5 9.5 Q8 6.2 11 9.5 Q8 13 5 9.5 Z" fill="#6FCB5C" {...S} strokeWidth={1.8} />
    <path d="M6 9 Q3.5 6 4.5 2.5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
  </svg>
)

export const Peach = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%">
    <path d="M20 9 C30 4 38.5 12 37.5 22 C36.5 32 28.5 38 20 37 C11.5 38 3.5 32 2.5 22 C1.5 12 10 4 20 9 Z" fill="#FF9E7A" {...S} strokeWidth={2.4} />
    <ellipse cx="11" cy="20" rx="4.5" ry="6.5" fill="#FFC6AE" opacity={0.85} />
    <path d="M20 11 C16.5 19 17.5 29 20 36" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    <path d="M20 9 C22 3 29 0.5 33 3 C30 8 24.5 9.5 20 9 Z" fill="#7BD66B" {...S} strokeWidth={2} />
  </svg>
)

export const Pitchfork = () => (
  <svg viewBox="0 0 30 52" width="100%" height="100%">
    <Lined d="M15 19 V49" c="#E5383B" />
    <Lined d="M5 4 V12 Q5 19 15 19 Q25 19 25 12 V4 M15 4 V19" c="#E5383B" />
  </svg>
)

export const Puff = ({ c }: { c: string }) => (
  <svg viewBox="0 0 30 30" width="100%" height="100%">
    <path d="M8 22 A7 7 0 0 1 6 9 A8 8 0 0 1 19 5 A7 7 0 0 1 26 15 A6.5 6.5 0 0 1 19 25 A7.5 7.5 0 0 1 8 22 Z" fill={c} {...S} />
  </svg>
)

export const Burst = ({ c = '#FFE14D' }: { c?: string }) => (
  <svg viewBox="0 0 60 44" width="100%" height="100%">
    <path d="M30 2 L35 12 L47 6 L44 17 L58 18 L47 25 L55 35 L42 33 L39 43 L30 35 L21 43 L18 33 L5 35 L13 25 L2 18 L16 17 L13 6 L25 12 Z" fill={c} {...S} strokeWidth={2.4} />
  </svg>
)

export const Ghost = () => (
  <svg viewBox="0 0 30 34" width="100%" height="100%">
    <path d="M4 30 V14 A11 11 0 0 1 26 14 V30 L22 27 L18.5 30.5 L15 27 L11.5 30.5 L8 27 Z" fill="#FFFFFF" {...S} />
    <ellipse cx="11" cy="14" rx="2" ry="2.8" fill={INK} />
    <ellipse cx="19" cy="14" rx="2" ry="2.8" fill={INK} />
    <ellipse cx="15" cy="21" rx="2.2" ry="1.6" fill={INK} />
  </svg>
)

export const Padlock = () => (
  <svg viewBox="0 0 40 46" width="100%" height="100%">
    <path d="M11 20 V13 A9 9 0 0 1 29 13 V20" fill="none" stroke={INK} strokeWidth={6.4} strokeLinecap="round" />
    <path d="M11 20 V13 A9 9 0 0 1 29 13 V20" fill="none" stroke="#C7D0E0" strokeWidth={3.2} strokeLinecap="round" />
    <rect x="4" y="19" width="32" height="24" rx="7" fill="#FF4D5E" {...S} strokeWidth={2.4} />
    <text x="20" y="35.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="12" fill="#FFFFFF">18+</text>
  </svg>
)
