import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 11.2L19.3 4.6c.6-.3 1.2.3.9.9l-6.6 14.8c-.3.6-1.1.6-1.3-.1l-1.7-5.6c-.1-.3-.3-.5-.6-.6L4.4 12.4c-.6-.2-.6-1-.1-1.2z" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconDm = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M12 3.6c4.9 0 8.6 3.4 8.6 7.7s-3.7 7.7-8.6 7.7c-1 0-2-.1-2.9-.4L5 20.4l1-3.5C4.3 15.5 3.4 13.5 3.4 11.3 3.4 7 7.1 3.6 12 3.6z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
)
export const IconGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6 1.2-2.5-1.2-2.5 2.3-1.6.6-2.7 2.7.6z" />
  </Svg>
)
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.6 1.8H4.4z" />
    <path d="M10 20.6a2.2 2.2 0 004 0" />
  </Svg>
)
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
)
export const IconMale = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="14" r="5.5" />
    <path d="M14 10l6-6M14.5 4H20v5.5" />
  </Svg>
)
export const IconFemale = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M12 14.5V21M9 18h6" />
  </Svg>
)
export const IconLive = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    <path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4" />
    <path d="M5 5a10 10 0 000 14M19 5a10 10 0 010 14" />
  </Svg>
)
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.6v.1" />
  </Svg>
)

export function GenderIcon({ g, ...p }: P & { g: 'm' | 'f' }) {
  return g === 'm' ? <IconMale {...p} /> : <IconFemale {...p} />
}

export const IconDice = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconBrush = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5l4 4L10 18l-4.6.6.6-4.6z" />
    <path d="M12.5 7.5l4 4" />
  </Svg>
)
export const IconSmilePlus = (p: P) => (
  <Svg {...p}>
    <path d="M20.5 12A8.5 8.5 0 1 1 12 3.5" />
    <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 10h.01M15 10h.01M18.5 3v5M16 5.5h5" />
  </Svg>
)
export const IconReply = (p: P) => (
  <Svg {...p}>
    <path d="M10 6L4 12l6 6" />
    <path d="M4 12h9.5a6.5 6.5 0 0 1 6.5 6.5V20" />
  </Svg>
)
export const IconSticker = (p: P) => (
  <Svg {...p}>
    <path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5z" />
    <path d="M12.5 20c0-4.1 3.4-7.5 7.5-7.5" />
    <path d="M9 10h.01M15 10h.01M9 14.5c1 .8 2 1 3 1" />
  </Svg>
)
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="M20.5 15.5l-4.6-4.3-8.4 8.3" />
  </Svg>
)
export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </Svg>
)
export const IconRooms = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 4.5c3.6 0 6.3 2.4 6.3 5.5s-2.7 5.5-6.3 5.5c-.8 0-1.5-.1-2.2-.3L4 16.4l.8-2.7C3.8 12.7 3.2 11.4 3.2 10c0-3.1 2.7-5.5 6.3-5.5z" />
    <path d="M18.4 8.6c1.5 1 2.4 2.5 2.4 4.1 0 1.2-.5 2.3-1.3 3.2l.6 2.5-2.9-1.1c-.6.2-1.3.3-2 .3-1.4 0-2.7-.4-3.7-1.1" />
  </Svg>
)
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.8 19.5c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" />
    <path d="M15.5 5.2a3.4 3.4 0 010 6.6M17.6 14.8c2 .6 3.2 2.3 3.6 4.7" />
  </Svg>
)
export const IconPin = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M9.2 3.5h5.6l-.9 5.2 3.6 3.4v1.6H6.5v-1.6l3.6-3.4z" fill={filled ? 'currentColor' : 'none'} />
    <path d="M12 13.7v6.8" />
  </Svg>
)
