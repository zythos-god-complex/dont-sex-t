// Graffiti: a doodle wall for a chat theme, bought per theme in the shop. One static tile of line
// doodles, used as a CSS mask so the colour comes from the theme. Each doodle sits in a 32x32 box.

const dot = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" stroke="none"/>`
const star = (cx: number, cy: number, ro: number, ri: number) => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? ri : ro
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1)
  }
  return `<path d="${d}Z"/>`
}

const G: Record<string, string> = {
  heart: `<path d="M16 26 C16 26 5 19.5 5 12.5 C5 9 7.8 6.5 10.8 6.5 C13 6.5 14.8 7.8 16 9.8 C17.2 7.8 19 6.5 21.2 6.5 C24.2 6.5 27 9 27 12.5 C27 19.5 16 26 16 26 Z"/>`,
  star: star(16, 16.5, 12, 5.2),
  spark: `<path d="M16 5 L18 14 L27 16 L18 18 L16 27 L14 18 L5 16 L14 14 Z"/>`,
  dots: dot(10, 12, 1.6) + dot(19, 9, 1.1) + dot(17, 19, 1.8) + dot(9, 22, 1),
  smiley: `<circle cx="16" cy="16" r="11.5"/><path d="M10.5 18.5 Q16 24 21.5 18.5"/>` + dot(12, 13, 1.5) + dot(20, 13, 1.5),
  squiggle: `<path d="M3 20 C6 12 9 12 11 18 C13 24 16 24 18 16 C20 8 23 8 25 14 C26 17 28 18 29 16"/>`,
  bolt: `<path d="M18.5 3.5 L8.5 18 H15.5 L13 28.5 L23.5 13.5 H16.5 Z"/>`,
  flower: `<circle cx="16" cy="16" r="3.4"/><path d="M16 12.6 C13 6 19 6 16 12.6 M19.2 14.9 C24.8 10.3 26.4 16 19.2 14.9 M18 18.7 C21.4 25 15.6 26 18 18.7 M14 18.7 C10.6 25 16.4 26 14 18.7 M12.8 14.9 C7.2 10.3 5.6 16 12.8 14.9"/>`,
  petal: `<path d="M16 4 C22 10 24 17 16 28 C8 17 10 10 16 4 Z"/><path d="M16 9 V22"/>`,
  bow: `<path d="M16 16 C12 8 4 9 5 15.5 C6 22 12 21 16 16 Z M16 16 C20 8 28 9 27 15.5 C26 22 20 21 16 16 Z"/><circle cx="16" cy="16" r="2.4"/><path d="M14.6 18 L12 26 M17.4 18 L20 26"/>`,
  moon: `<path d="M20 4.5 A11.5 11.5 0 1 0 27.5 22.5 A9.2 9.2 0 1 1 20 4.5 Z"/>` + dot(25, 8, 1.1),
  cloud: `<path d="M9 23 H24 A5 5 0 0 0 23.5 13 A7 7 0 0 0 10.5 12 A5.5 5.5 0 0 0 9 23 Z"/>`,
  planet: `<circle cx="16" cy="16" r="7.5"/><path d="M4.5 21 C2 18 12 12.5 20 10.5 C27 8.8 30 10.5 27.5 13.5"/><path d="M9 19.8 C5.2 21.2 3.2 22 4.5 21"/>`,
  leaf: `<path d="M6 26 C6 13 13 6 26 6 C26 19 19 26 6 26 Z"/><path d="M6 26 L19 13"/>`,
  sprout: `<path d="M16 28 V15"/><path d="M16 17 C16 10 10 8 5 9 C5 15 10 18 16 17 Z"/><path d="M16 14 C16 8 21 5 27 6 C27 12 22 15 16 14 Z"/>`,
  cup: `<path d="M7 11 H22 V19 A7.5 7.5 0 0 1 7 19 Z"/><path d="M22 13 H24.5 A3 3 0 0 1 24.5 19 H22"/><path d="M11 7 Q12.5 5 11 3 M15.5 7 Q17 5 15.5 3"/><path d="M6 28 H23"/>`,
  wave: `<path d="M3 13 C6.5 9 9.5 9 13 13 C16.5 17 19.5 17 23 13 C26 9.6 28 9.6 29 10.6"/><path d="M3 21 C6.5 17 9.5 17 13 21 C16.5 25 19.5 25 23 21 C26 17.6 28 17.6 29 18.6"/>`,
  fish: `<path d="M5 16 C9 9 17 8 23 16 C17 24 9 23 5 16 Z"/><path d="M23 16 L29 11 V21 Z"/>` + dot(10.5, 14.5, 1.3),
  bubble: `<circle cx="13" cy="18" r="7.5"/><circle cx="23" cy="9" r="3.5"/><path d="M9.5 15 A4.5 4.5 0 0 1 12 12.4"/>`,
  shell: `<path d="M16 27 L4.5 14 C6 8 11 5 16 5 C21 5 26 8 27.5 14 Z"/><path d="M16 27 L10 7 M16 27 V5 M16 27 L22 7"/>`,
  drop: `<path d="M16 4 C11.5 11.5 8.5 15.5 8.5 20 A7.5 7.5 0 0 0 23.5 20 C23.5 15.5 20.5 11.5 16 4 Z"/><path d="M12.5 20.5 C12.5 18.4 13.4 16.6 14.6 15.4"/>`,
  butterfly: `<path d="M16 10 V25"/><path d="M16 14 C11 5 3 6 4.5 13 C5.5 17 10.5 17.5 16 16 C10.5 17.5 6.5 21 9 25 C11.5 28 15 23.5 16 19 C17 23.5 20.5 28 23 25 C25.5 21 21.5 17.5 16 16 C21.5 17.5 26.5 17 27.5 13 C29 6 21 5 16 14 Z"/><path d="M16 10 L13 5 M16 10 L19 5"/>`,
  code: `<path d="M11 9 L4 16 L11 23 M21 9 L28 16 L21 23 M18.5 6.5 L13.5 25.5"/>`,
  cursor: `<path d="M5 9 L11 15 L5 21"/><path d="M14 22 H26"/>`,
  binary: `<path d="M7 7 V15 M5.5 8.5 L7 7 M13 7 H17 V15 H13 Z M23 7 V15 M21.5 8.5 L23 7"/><path d="M7 19 H11 V27 H7 Z M17 19 V27 M15.5 20.5 L17 19 M21 19 H25 V27 H21 Z"/>`,
  candy: `<circle cx="16" cy="16" r="6.5"/><path d="M9.8 13.8 L4 10 V22 L9.8 18.2 M22.2 13.8 L28 10 V22 L22.2 18.2"/><path d="M13 12 Q16 16 13.5 20.5 M18 11 Q20.5 15 18.5 21"/>`,
  lemon: `<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="8"/><path d="M16 8 V24 M8 16 H24 M10.3 10.3 L21.7 21.7 M21.7 10.3 L10.3 21.7"/>`,
  sun: `<circle cx="16" cy="16" r="6"/><path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M6.8 6.8 L9.6 9.6 M22.4 22.4 L25.2 25.2 M25.2 6.8 L22.4 9.6 M9.6 22.4 L6.8 25.2"/>`,
  mountain: `<path d="M2 26 L12 10 L17 18 L21 13 L30 26 Z"/><path d="M9.2 14.5 L12 16.8 L14.6 14.2"/>`,
  pine: `<path d="M16 3 L8 14 H12 L6 22 H26 L20 14 H24 Z"/><path d="M16 22 V28"/>`,
  mushroom: `<path d="M4.5 16 C4.5 9 9.5 5 16 5 C22.5 5 27.5 9 27.5 16 Z"/><path d="M12 16 V25 A4 4 0 0 0 20 25 V16"/>` + dot(11, 11, 1.6) + dot(19, 9.5, 1.3) + dot(22.5, 13, 1.1),
  disc: `<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="3"/><path d="M16 8 A8 8 0 0 1 24 16"/>`,
  bat: `<path d="M16 12 L14 9 L13.6 13 C10 10 5 10 2 13 C5 14 6 17 5.5 19 C8 17.5 11 18 12 20 C13 18.5 14.5 18 16 19 C17.5 18 19 18.5 20 20 C21 18 24 17.5 26.5 19 C26 17 27 14 30 13 C27 10 22 10 18.4 13 L18 9 Z"/>`,
  pow: `<path d="M16 3 L18.5 10 L26 7 L22 13.5 L29 17 L21.5 19 L23.5 27 L16.5 22 L11 28.5 L10.5 20.5 L3 20 L9 15 L4.5 8.5 L12 10 Z"/>`,
  arrow: `<path d="M4 28 L26 6"/><path d="M26 6 L19 7 M26 6 L25 13"/><path d="M4 28 L4.5 23 M4 28 L9 27.5 M7 25 L7.4 21 M7 25 L11 24.6"/>`,
  letter: `<rect x="4" y="8" width="24" height="17" rx="2"/><path d="M4 9.5 L16 18 L28 9.5"/>`,
  rose: `<path d="M16 15 C12 15 10 12 11 9 C12 6 15 5.5 16 7 C17 5.5 20 6 21 9 C22 12 20 15 16 15 Z"/><path d="M16 15 V28 M16 22 C12 21 10 19 10 17 C13 17 15 19 16 22 Z"/><path d="M14 10.5 C15 12 17 12 18 10"/>`,
  note: `<path d="M12 23 V7 L25 4.5 V20"/><ellipse cx="9" cy="23" rx="3.5" ry="2.8"/><ellipse cx="22" cy="20" rx="3.5" ry="2.8"/><path d="M12 11 L25 8.5"/>`,
  peace: `<circle cx="16" cy="16" r="11.5"/><path d="M16 4.5 V27.5 M16 16 L7.8 24 M16 16 L24.2 24"/>`,
  comet: `<circle cx="22" cy="10" r="4.5"/><path d="M18.5 12.5 L4 27 M19.5 14.5 L9 26 M17 11 L5 21"/>`,
  lantern: `<path d="M16 3 V6 M11 6 H21 M10 26 H22 M16 26 V29"/><path d="M11 6 C6 10 6 22 11 26 H21 C26 22 26 10 21 6 Z"/><path d="M16 6 C13 10 13 22 16 26"/>`,
  palm: `<path d="M17 28 C17 21 16 15 14 10"/><path d="M14 10 C10 6 5 7 3 10 C7 9 10 10 14 10 C12 6 13 3 16 2 C15 5 15 8 14 10 C18 6 23 6 26 9 C22 9 18 9 14 10 C19 10 22 13 23 17 C19 14 17 12 14 10 Z"/>`,
  tri: `<path d="M16 5 L28 26 H4 Z"/><path d="M16 12 L23 24 H9 Z"/>`,
  anchor: `<circle cx="16" cy="7" r="3"/><path d="M16 10 V28 M10 14 H22 M5 19 C5 25 10 28 16 28 C22 28 27 25 27 19 M5 19 L3 21 M27 19 L29 21"/>`,
  ufo: `<path d="M3 18 C3 14 9 12 16 12 C23 12 29 14 29 18 C29 21 23 22.5 16 22.5 C9 22.5 3 21 3 18 Z"/><path d="M10 13 C10 8 13 6 16 6 C19 6 22 8 22 13"/>` + dot(9, 18, 1.2) + dot(16, 19, 1.2) + dot(23, 18, 1.2),
  bird: `<path d="M3 14 C6 10 10 10 16 15 C22 10 26 10 29 14"/><path d="M9 22 C11 20 13 20 16 22.5 C19 20 21 20 23 22"/>`,
  umbrella: `<path d="M3 16 C3 9 9 4 16 4 C23 4 29 9 29 16 C27 14 24.5 14 22.5 16 C20.5 14 18 14 16 16 C14 14 11.5 14 9.5 16 C7.5 14 5 14 3 16 Z"/><path d="M16 16 V25 A3 3 0 0 1 10 25"/>`,
  cat: `<path d="M6 27 V12 L9 5 L13 10 H19 L23 5 L26 12 V27 Z"/>` + dot(12, 16, 1.4) + dot(20, 16, 1.4) + `<path d="M14 21 Q16 23 18 21 M3 19 H9 M23 19 H29"/>`,
  pad: `<path d="M9 9 H23 C27.5 9 29.5 13 29 18 C28.5 23 26 25 23.5 23 L20 19.5 H12 L8.5 23 C6 25 3.5 23 3 18 C2.5 13 4.5 9 9 9 Z"/><path d="M10 13 V18 M7.5 15.5 H12.5"/>` + dot(21, 14, 1.3) + dot(24, 17, 1.3),
  ghost: `<path d="M7 28 V14 C7 8 11 4 16 4 C21 4 25 8 25 14 V28 L22 25 L19 28 L16 25 L13 28 L10 25 Z"/>` + dot(12.5, 14, 1.6) + dot(19.5, 14, 1.6),
  coin: `<circle cx="16" cy="16" r="11.5"/><circle cx="16" cy="16" r="8"/><path d="M16 11 V21"/>`,
  pixel: `<path d="M8 8 H12 V10 H14 V12 H18 V10 H20 V8 H24 V10 H26 V16 H24 V18 H22 V20 H20 V22 H18 V24 H14 V22 H12 V20 H10 V18 H8 V16 H6 V10 H8 Z"/>`,
  crown: `<path d="M4 24 L5 10 L11 16 L16 7 L21 16 L27 10 L28 24 Z"/><path d="M4.5 20 H27.5"/>`,
  skull: `<path d="M8 21 C4 18 4.5 9 9 6.5 C13 4 19 4 23 6.5 C27.5 9 28 18 24 21 V26 H8 Z"/><circle cx="12" cy="15" r="2.8"/><circle cx="20" cy="15" r="2.8"/><path d="M13 26 V23 M16 26 V23 M19 26 V23"/>`,
  eye: `<path d="M3 16 C7 9 11 7 16 7 C21 7 25 9 29 16 C25 23 21 25 16 25 C11 25 7 23 3 16 Z"/><circle cx="16" cy="16" r="4.5"/>` + dot(16, 16, 1.8),
  dice: `<rect x="5" y="5" width="22" height="22" rx="4"/>` + dot(11, 11, 1.8) + dot(21, 11, 1.8) + dot(16, 16, 1.8) + dot(11, 21, 1.8) + dot(21, 21, 1.8),
  bone: `<path d="M9 13 L19 23"/><path d="M9 13 A3 3 0 1 1 6 8 A3 3 0 1 1 11 6 Z M19 23 A3 3 0 1 0 22 28 A3 3 0 1 0 27 26 Z"/>`,
  rain: `<path d="M8 4 L5 12 M17 6 L14 14 M26 4 L23 12 M12 17 L9 25 M22 18 L19 26"/>`,
  zz: `<path d="M5 8 H13 L5 16 H13 M17 16 H23 L17 22 H23 M25 4 H29 L25 8 H29"/>`,
}

/** which doodles cover the walls in each theme (no graffiti for matrix, lust already has its own) */
export const GRAFFITI: Record<string, string[]> = {
  goofy: ['smiley', 'squiggle', 'bolt', 'heart', 'star', 'dots', 'dice', 'spark'],
  cherry: ['flower', 'petal', 'heart', 'bow', 'spark', 'dots', 'petal', 'flower'],
  midnight: ['moon', 'star', 'cloud', 'planet', 'spark', 'zz', 'dots', 'star'],
  matcha: ['leaf', 'cup', 'sprout', 'dots', 'flower', 'leaf', 'cloud', 'spark'],
  lagoon: ['wave', 'fish', 'bubble', 'shell', 'drop', 'sun', 'bubble', 'dots'],
  lavender: ['flower', 'butterfly', 'spark', 'moon', 'petal', 'dots', 'heart', 'spark'],
  terminal: ['code', 'cursor', 'binary', 'eye', 'bolt', 'cursor', 'code', 'dots'],
  bubblegum: ['heart', 'candy', 'star', 'bubble', 'smiley', 'bow', 'spark', 'dots'],
  citrus: ['lemon', 'sun', 'drop', 'leaf', 'spark', 'smiley', 'lemon', 'dots'],
  aurora: ['star', 'mountain', 'moon', 'spark', 'pine', 'dots', 'comet', 'star'],
  forest: ['pine', 'leaf', 'mushroom', 'sprout', 'moon', 'pine', 'dots', 'flower'],
  y2k: ['spark', 'butterfly', 'heart', 'disc', 'smiley', 'star', 'bow', 'dots'],
  batman: ['bat', 'pow', 'bolt', 'star', 'moon', 'bat', 'skull', 'dots'],
  love: ['heart', 'arrow', 'letter', 'rose', 'heart', 'spark', 'bow', 'dots'],
  bff: ['star', 'heart', 'smiley', 'note', 'peace', 'spark', 'dice', 'dots'],
  meteor: ['comet', 'star', 'planet', 'spark', 'ufo', 'moon', 'dots', 'star'],
  temple: ['lantern', 'cloud', 'rain', 'drop', 'moon', 'lantern', 'dots', 'flower'],
  sakuranight: ['flower', 'petal', 'moon', 'lantern', 'spark', 'petal', 'dots', 'flower'],
  butterfly: ['butterfly', 'flower', 'spark', 'leaf', 'butterfly', 'petal', 'dots', 'heart'],
  vapor: ['palm', 'sun', 'tri', 'disc', 'spark', 'wave', 'eye', 'dots'],
  ocean: ['fish', 'wave', 'anchor', 'shell', 'bubble', 'fish', 'drop', 'dots'],
  galaxy: ['planet', 'star', 'ufo', 'comet', 'moon', 'spark', 'eye', 'dots'],
  sunset: ['sun', 'palm', 'bird', 'cloud', 'wave', 'spark', 'heart', 'dots'],
  noir: ['umbrella', 'rain', 'moon', 'cat', 'eye', 'skull', 'drop', 'dots'],
  arcade: ['pad', 'pixel', 'ghost', 'coin', 'star', 'crown', 'bolt', 'dots'],
}

// 4x4 slots on a 240px tile with a little jitter and tilt so it reads hand drawn
const TILT = [-14, 8, 0, 18, 6, -10, -18, 12, -6, 14, 20, -8, 10, -16, 0, 16]
const JITTER = [[0, 0], [4, -3], [0, 0], [-3, 4], [3, 2], [0, 0], [-4, -2], [2, 4], [-2, 3], [3, -4], [0, 2], [0, 0], [4, 1], [-3, -3], [0, 0], [-2, 2]]

const cache: Record<string, string> = {}

/** the mask tile for a theme's graffiti, or null when that theme has none */
export function graffitiTile(theme: string): string | null {
  const set = GRAFFITI[theme]
  if (!set) return null
  if (cache[theme]) return cache[theme]
  const items = TILT.map((r, i) => {
    // walk the set in a shuffled stride so neighbours differ
    const name = set[(i + Math.floor(i / 4) * 3) % set.length]
    const small = name === 'dots' || name === 'spark'
    const s = small ? 0.72 : 0.92
    const cx = 30 + (i % 4) * 60 + JITTER[i][0]
    const cy = 30 + Math.floor(i / 4) * 60 + JITTER[i][1]
    return `<g transform="translate(${cx} ${cy}) rotate(${r}) scale(${s}) translate(-16 -16)">${G[name]}</g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${items}</g></svg>`
  return (cache[theme] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
}

/** one doodle on its own, for shop tiles */
export function graffitiIcon(name: string): string {
  return (cache['i:' + name] ??= `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${G[name]}</g></svg>`,
  )}")`)
}
