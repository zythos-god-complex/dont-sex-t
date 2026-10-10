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
