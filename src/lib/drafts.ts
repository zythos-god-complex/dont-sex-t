// Unsent composer text per chat/room, so leaving a chat never eats what you were typing.
const mem = new Map<string, string>()
const KEY = 'gat.draft.'

export function getDraft(id: string): string {
  const m = mem.get(id)
  if (m !== undefined) return m
  try {
    return localStorage.getItem(KEY + id) ?? ''
  } catch {
    return ''
  }
}

export function setDraft(id: string, text: string): void {
  if ((mem.get(id) ?? '') === text) return
  mem.set(id, text)
  try {
    if (text) localStorage.setItem(KEY + id, text.slice(0, 2000))
    else localStorage.removeItem(KEY + id)
  } catch {
    /* blocked */
  }
}

const ICE = [
  'rate my vibe 1 to 10, be honest',
  'pineapple on pizza: yes or crime?',
  "what's the most unhinged thing you did this week",
  "you get one superpower but it's useless. what is it",
  'describe your day in 3 emojis',
  'unpopular opinion, go',
  'cats or dogs, defend your answer',
  "what song is stuck in your head rn",
  "who's your comfort character",
  'worst pickup line you know',
  'chai, coffee or chaos?',
  'what would your villain name be',
  'teleport anywhere rn. where',
  'last thing you googled, be honest',
  "tell me a fun fact i didn't ask for",
  'beach, mountains or bed?',
  "what's your goofiest habit",
  'night owl or early bird',
  'you have to delete one app forever. which',
  'whats the best snack ever made',
]
export const icebreaker = (): string => ICE[Math.floor(Math.random() * ICE.length)]

const ice = new Map<string, { text: string; auto: boolean }>()
/** Prefill (or with auto, send) a line the next time a DM with this person opens. */
export function setIce(name: string, text: string, auto = false): void {
  ice.set(name.toLowerCase(), { text, auto })
}
export function takeIce(name: string): { text: string; auto: boolean } | null {
  const k = name.toLowerCase()
  const v = ice.get(k) ?? null
  ice.delete(k)
  return v
}
