// Theme moments fired by the four-tap gesture (and the peer's), instead of confetti on some themes.
export type Fx = 'wish' | 'thunder'
const subs = new Set<(f: Fx) => void>()
export const fireFx = (f: Fx) => subs.forEach((s) => s(f))
export function onFx(s: (f: Fx) => void): () => void {
  subs.add(s)
  return () => {
    subs.delete(s)
  }
}
export const FX_BY_THEME: Partial<Record<string, Fx>> = { meteor: 'wish', temple: 'thunder' }
