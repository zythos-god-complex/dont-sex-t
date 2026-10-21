// Last line of defence: if anything in the app throws while drawing, show this instead of a blank page.
// Kept free of stores and the face renderer on purpose, so it still works when those are what broke.
import { Component, type ReactNode } from 'react'

const FLAG = 'gat.crash.reload'
const STALE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i

/** an open tab asking for a file the newest version replaced: one quiet reload fixes it */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(FLAG)) return false
    sessionStorage.setItem(FLAG, '1')
  } catch {
    return false
  }
  location.reload()
  return true
}
/** called once the app has been up a while, so a later stale file can reload again */
export const clearCrashFlag = () => {
  try {
    sessionStorage.removeItem(FLAG)
  } catch {
    /* blocked */
  }
}

export class CrashBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
    if (STALE.test(String(error?.message ?? error))) reloadOnce()
  }
  render() {
    return this.state.error ? <Crash /> : this.props.children
  }
}

function Crash() {
  return (
    <main className="crash" role="alert">
      <svg className="crash-face" viewBox="0 0 100 100" width="132" height="132" aria-hidden="true">
        <g transform="rotate(-6 50 55)">
          <path d="M50 17 C74 17 89 30 89 54 C89 79 74 93 50 93 C26 93 11 79 11 54 C11 30 26 17 50 17 Z" fill="#FF8A3D" stroke="#17131F" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <g stroke="#17131F" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <path d="M28 44 L42 58 M42 44 L28 58" />
          <path d="M58 44 L72 58 M72 44 L58 58" />
          <path d="M38 74 q3 -5 6 0 t6 0 t6 0 t6 0" />
        </g>
        <path d="M60 66 v7 a3.4 3.4 0 0 0 6.8 0 v-7" fill="#FF6F91" stroke="#17131F" strokeWidth="2" />
      </svg>
      <h1 className="crash-title">that crashed</h1>
      <p className="crash-sub">something broke on our side</p>
      <button type="button" className="crash-btn" onClick={() => location.reload()}>
        reload
      </button>
    </main>
  )
}
