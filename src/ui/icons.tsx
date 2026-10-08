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
