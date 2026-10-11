import { create } from 'zustand'

// One profile sheet for the whole app: header faces, your own card and the reward toast all open it here.
export type MeTab = 'me' | 'settings'
export const useMeSheet = create<{ open: boolean; tab: MeTab }>(() => ({ open: false, tab: 'me' }))
export const openMeSheet = (tab: MeTab = 'me') => useMeSheet.setState({ open: true, tab })
export const closeMeSheet = () => useMeSheet.setState({ open: false })
