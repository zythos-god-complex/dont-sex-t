// Theme moments fired by the four-tap gesture (and the peer's), instead of confetti on some themes.
export type Fx = 'wish' | 'thunder' | 'bloom'
const subs = new Set<(f: Fx) => void>()
export const fireFx = (f: Fx) => {
  subs.forEach((s) => s(f))
  if (f === 'thunder' && typeof document !== 'undefined') {
    // the whole screen lights up once, the bolt itself is drawn in the scene
    const d = document.createElement('div')
    d.className = 'tp-strike'
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 950)
  }
}
export function onFx(s: (f: Fx) => void): () => void {
  subs.add(s)
  return () => {
    subs.delete(s)
  }
}
export const FX_BY_THEME: Partial<Record<string, Fx>> = { meteor: 'wish', temple: 'thunder', sakuranight: 'bloom' }
