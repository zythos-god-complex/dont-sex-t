// Timeout state: set when the server answers 'banned'. until is an ISO time, 'infinity', or 'soon' while we ask.
import { create } from 'zustand'

export const useBan = create<{ until: string | null; token: string | null; appealed: boolean }>(() => ({ until: null, token: null, appealed: false }))
