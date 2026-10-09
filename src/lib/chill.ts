// Server said "slow down": the send button turns into a sweating face until the window passes.
import { create } from 'zustand'

export const useChill = create<{ until: number }>(() => ({ until: 0 }))
let timer: ReturnType<typeof setTimeout> | undefined
export function setChill(ms = 8000): void {
  useChill.setState({ until: Date.now() + ms })
  clearTimeout(timer)
  timer = setTimeout(() => useChill.setState({ until: 0 }), ms)
}
