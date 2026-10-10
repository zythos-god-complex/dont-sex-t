// Seasonal drops: live inside their window, gone after it. Valentines runs on the same switch.
export type Season = 'spooky' | 'valentines'

const WINDOWS: Record<Season, (d: Date) => boolean> = {
  spooky: (d) => d.getMonth() === 9, // all of October, gone Nov 1
  valentines: (d) => d.getMonth() === 1 && d.getDate() <= 15,
}

export function seasonOn(s: Season, now: Date = new Date()): boolean {
  return WINDOWS[s](now)
}

export const SPOOKY_HATS = ['pumpkin', 'witch', 'ghost'] as const
export type SeasonHat = (typeof SPOOKY_HATS)[number]
