// Tap a name or face anywhere: one profile card sheet for the whole app.
import { create } from 'zustand'

export const usePeek = create<{ name: string | null; id: string | null }>(() => ({ name: null, id: null }))
export const peek = (name: string, id?: string | null) => usePeek.setState({ name, id: id ?? null })
export const closePeek = () => usePeek.setState({ name: null })
