export type Opts = { amount: number; speed: number }
export const density = (a: number) => 0.6 + a * 1.6 // slider 0.25 -> 1x
export const pace = (s: number) => 0.7 + s // slider 0.3 -> 1x
