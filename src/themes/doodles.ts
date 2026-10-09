// Lust wallpaper: one static tile of line doodles, used as a CSS mask so the colour comes from CSS.
// Each doodle is drawn in a 32x32 box. Strokes only (plus a few solid dots), so it stays crisp at any size.

const serrated = (x: number, y: number, w: number, h: number, t = 1.5, step = 2.6) => {
  const pts: string[] = []
  const edge = (x0: number, y0: number, x1: number, y1: number, ox: number, oy: number) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let i = 0; i < n; i++) {
      const k = i / n
      const out = i % 2 ? 1 : 0
      pts.push(`${(x0 + (x1 - x0) * k + ox * t * out).toFixed(1)} ${(y0 + (y1 - y0) * k + oy * t * out).toFixed(1)}`)
    }
  }
  edge(x, y, x + w, y, 0, -1)
  edge(x + w, y, x + w, y + h, 1, 0)
  edge(x + w, y + h, x, y + h, 0, 1)
  edge(x, y + h, x, y, -1, 0)
  return `<path d="M${pts.join(' L')} Z"/>`
}
const dot = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" stroke="none"/>`

const D: Record<string, string> = {
  condom:
    serrated(5, 5, 22, 22) +
    `<circle cx="16" cy="16" r="7.2"/><circle cx="16" cy="16" r="4.6"/><path d="M22.5 5 L24.5 8.5"/>`,
  strip:
    serrated(7, 1, 18, 15, 1.3, 2.4) +
    serrated(7, 16, 18, 15, 1.3, 2.4) +
    `<circle cx="16" cy="8.5" r="4.6"/><circle cx="16" cy="23.5" r="4.6"/><path d="M8.5 16 H23.5" stroke-dasharray="1.2 2"/>`,
  peach:
    `<path d="M16 29.5 C8.5 29.5 4.5 23.5 5.5 17.5 C6.5 11.5 11.5 9 16 12.5 C20.5 9 25.5 11.5 26.5 17.5 C27.5 23.5 23.5 29.5 16 29.5 Z"/>` +
    `<path d="M16 12.5 C13.8 16.5 13.8 22 15.6 26"/><path d="M16 12.5 C16.5 8 19.5 5 24 5 C23.5 9 20.5 11.5 16 12.5 Z"/><path d="M15.8 12 C15.4 9.6 14.4 7.8 12.8 6.6"/>`,
  eggplant:
    `<path d="M10.5 9.6 C14 9.2 16.6 11.6 18.6 14.6 C20.6 17.6 24 19 26.2 21.6 C28.8 24.8 27.6 29.8 23 29.8 C19.4 29.8 16.4 27.8 13.6 24.8 C10.8 21.8 8 18.2 7.6 14.6 C7.3 12.1 8.4 10 10.5 9.6 Z"/>` +
    `<path d="M6.6 15.4 C6 11 9.4 7.8 13.6 8.6 C15.6 9 16.8 10.6 16.4 12.4 C14.6 11.4 12.6 11.6 11.6 13.2 C10 12.4 8 13.4 6.6 15.4 Z"/><path d="M12.2 8.8 C11.6 6.6 10.2 5 8.4 4"/>` +
    `<path d="M20.6 23.2 C21.6 25.2 23 26.6 24.6 27.2"/>`,
  cherries:
    `<circle cx="10.5" cy="23.5" r="5.2"/><circle cx="22" cy="24.5" r="5.2"/>` +
    `<path d="M10.8 18.3 C12 12 15 8 19 5"/><path d="M21.6 19.3 C21 13.5 20.2 9 19 5"/><path d="M19 5 C22 2.8 26.2 3.6 27.4 6.8 C24.4 8 21.4 7.4 19 5 Z"/>` +
    `<path d="M8.2 21.6 C8.6 20.6 9.4 20 10.2 19.8"/>`,
  lips:
    `<path d="M3 16 C7 10 11 8.2 14 10 C15 10.5 15.5 11 16 11.6 C16.5 11 17 10.5 18 10 C21 8.2 25 10 29 16"/>` +
    `<path d="M3 16 C8 24.5 24 24.5 29 16"/><path d="M3 16 C10 17.6 22 17.6 29 16"/><path d="M12 20.6 C14.6 21.4 17.4 21.4 20 20.6"/>`,
  cuffs:
    `<circle cx="8.6" cy="22" r="6"/><circle cx="23.4" cy="22" r="6"/><path d="M5 22 A3.6 3.6 0 0 1 8.6 18.4 M27 22 A3.6 3.6 0 0 0 23.4 18.4"/>` +
    `<rect x="5.6" y="12" width="6" height="4.4" rx="1"/><rect x="20.4" y="12" width="6" height="4.4" rx="1"/>` +
    `<ellipse cx="14.3" cy="12.6" rx="1.9" ry="1.2"/><ellipse cx="17.7" cy="12.6" rx="1.9" ry="1.2"/>`,
  drops:
    `<path d="M15 5 C11.5 11 9 14.5 9 18.5 A6 6 0 0 0 21 18.5 C21 14.5 18.5 11 15 5 Z"/><path d="M12.4 18.6 C12.4 16.8 13.2 15.2 14.2 14"/>` +
    `<path d="M25 13.5 C23.6 15.8 23 17 23 18.1 A2 2 0 0 0 27 18.1 C27 17 26.4 15.8 25 13.5 Z"/>` +
    `<path d="M6.5 23.5 C5.5 25.1 5 26 5 26.8 A1.5 1.5 0 0 0 8 26.8 C8 26 7.5 25.1 6.5 23.5 Z"/>`,
  tail:
    `<path d="M3.5 28 C12 29.5 13 20.5 16 15.5 C18.4 11.5 21.6 9.6 24 7.8"/>` +
    `<g transform="translate(26 5.6) rotate(-135) scale(.6) translate(-16 -16)"><path d="M16 25 C16 25 7 19.5 7 13.5 C7 10.5 9.3 8.5 11.8 8.5 C13.6 8.5 15 9.6 16 11.2 C17 9.6 18.4 8.5 20.2 8.5 C22.7 8.5 25 10.5 25 13.5 C25 19.5 16 25 16 25 Z" fill="#000"/></g>`,
  flame:
    `<path d="M16 29.5 C9.5 29.5 6 24 7.8 18 C9.4 13 13 11.6 13 6 C17 8.6 18.4 12 18 15.2 C19.8 13.8 20.8 12 21 10.2 C25 14 26.4 20 24.2 24.4 C22.4 28 19.4 29.5 16 29.5 Z"/>` +
    `<path d="M16 29.5 C13 29.5 11.6 27 12.4 24.4 C13.2 22 15 21.4 15.6 19 C18 21 19.6 23.6 19.2 26 C18.8 28.2 17.6 29.5 16 29.5 Z"/>`,
  lipstick:
    `<path d="M11 29.5 H21 V18 H11 Z"/><path d="M12.4 18 V14 H19.6 V18"/><path d="M13.4 14 V8.6 L18.6 5.2 V14"/><path d="M13.4 24 H18.6"/>`,
  xxx:
    `<path d="M3 12.5 L9.5 20.5 M9.5 12 L3.2 20.8"/><path d="M12.8 11.5 L19.2 20 M19.4 11.8 L12.6 20.4"/><path d="M22.6 12.6 L29 20.6 M29 12 L22.8 20.8"/>`,
  heart:
    `<path d="M16 25 C16 25 7 19.5 7 13.5 C7 10.5 9.3 8.5 11.8 8.5 C13.6 8.5 15 9.6 16 11.2 C17 9.6 18.4 8.5 20.2 8.5 C22.7 8.5 25 10.5 25 13.5 C25 19.5 16 25 16 25 Z"/>` +
    `<path d="M3.5 27.5 L28 6"/><path d="M28 6 L22.6 6.6 M28 6 L27.4 11.4"/><path d="M3.5 27.5 L3.8 23.8 M3.5 27.5 L7.2 27.2"/>`,
  moon: `<path d="M20 4.5 A11.5 11.5 0 1 0 27.5 22.5 A9.2 9.2 0 1 1 20 4.5 Z"/>` + dot(25, 7, 1.1) + dot(28.5, 12.5, 0.8),
  wine:
    `<path d="M9.5 4 H22.5 C22.5 12.2 20.4 16.4 16 16.4 C11.6 16.4 9.5 12.2 9.5 4 Z"/><path d="M10.2 9.4 H21.8"/><path d="M16 16.4 V27.4"/><path d="M10.8 28 H21.2"/>`,
  heart0: `<path d="M16 26 C16 26 5 19.5 5 12.5 C5 9 7.8 6.5 10.8 6.5 C13 6.5 14.8 7.8 16 9.8 C17.2 7.8 19 6.5 21.2 6.5 C24.2 6.5 27 9 27 12.5 C27 19.5 16 26 16 26 Z"/>`,
  spark: `<path d="M16 8 L17.6 14.4 L24 16 L17.6 17.6 L16 24 L14.4 17.6 L8 16 L14.4 14.4 Z"/>`,
  dots: dot(12, 14, 1.4) + dot(19, 11, 1) + dot(17.5, 19.5, 1.6) + dot(10.5, 21.5, 0.9),
}

// 4x4 slots on a 240px tile, spicy name first, the tame stand-in second
const SLOTS: [string, string, number][] = [
  ['condom', 'heart', -14], ['peach', 'moon', 8], ['spark', 'spark', 0], ['eggplant', 'wine', 18],
  ['lips', 'lips', 6], ['dots', 'dots', 0], ['cherries', 'cherries', -10], ['cuffs', 'heart', 20],
  ['drops', 'spark', -6], ['strip', 'cherries', 14], ['lipstick', 'lipstick', -18], ['spark', 'dots', 0],
  ['tail', 'tail', 10], ['xxx', 'xxx', -8], ['dots', 'spark', 0], ['flame', 'flame', 16],
]
const JITTER = [[0, 0], [4, -3], [0, 0], [-3, 4], [3, 2], [0, 0], [-4, -2], [2, 4], [-2, 3], [3, -4], [0, 2], [0, 0], [4, 1], [-3, -3], [0, 0], [-2, 2]]

function tile(spicy: boolean): string {
  const items = SLOTS.map(([a, b, r], i) => {
    const name = spicy ? a : b
    const small = name === 'spark' || name === 'dots'
    const s = small ? 0.7 : 1
    const cx = 30 + (i % 4) * 60 + JITTER[i][0]
    const cy = 30 + Math.floor(i / 4) * 60 + JITTER[i][1]
    return `<g transform="translate(${cx} ${cy}) rotate(${r}) scale(${s}) translate(-16 -16)">${D[name]}</g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${items}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const cache: Record<string, string> = {}
export function doodleTile(spicy: boolean): string {
  const k = spicy ? 's' : 't'
  return (cache[k] ??= tile(spicy))
}

// the same drawings as tiny floating particles: one icon per data URI, thicker line so they read at 14px
export const FLOATS = { spicy: ['heart0', 'condom', 'lips', 'drops', 'spark', 'cherries'], tame: ['heart0', 'lips', 'spark', 'cherries'] }
export function doodleIcon(name: string): string {
  return (cache['i:' + name] ??= `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${D[name]}</g></svg>`,
  )}")`)
}
