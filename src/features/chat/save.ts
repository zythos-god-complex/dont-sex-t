// Saving someone else's voice note or photo needs their ok. The ask and the answer are messages:
// [[save:<msg id>|voice]] from the one asking, [[saveok:<msg id>]] or [[saveno:<msg id>]] from the owner.
// Your own media saves straight away. View once photos never save.
import { useStore } from '../../lib/store'
import { mediaSrc } from '../../lib/archive'
import type { Message } from '../../lib/types'

export type SaveKind = 'voice' | 'photo'
export type SaveState = 'none' | 'asked' | 'ok' | 'no'

const ASK = /^\[\[save:([0-9a-f-]{36})\|(voice|photo)\]\]$/
const ANS = /^\[\[save(ok|no):([0-9a-f-]{36})\]\]$/

export const saveAsk = (id: string, kind: SaveKind) => `[[save:${id}|${kind}]]`
export const saveAnswer = (id: string, ok: boolean) => `[[save${ok ? 'ok' : 'no'}:${id}]]`
export function askOf(body: string): { id: string; kind: SaveKind } | null {
  const m = ASK.exec(body)
  return m ? { id: m[1], kind: m[2] as SaveKind } : null
}
export function answerOf(body: string): { id: string; ok: boolean } | null {
  const m = ANS.exec(body)
  return m ? { id: m[2], ok: m[1] === 'ok' } : null
}
export const isSaveMsg = (body: string) => ASK.test(body) || ANS.test(body)

/** where an ask for this media stands; only the media's owner can answer it */
export function saveStateIn(msgs: Message[] | undefined, mediaId: string, owner: string): SaveState {
  let st: SaveState = 'none'
  for (const m of msgs ?? []) {
    if (m.body.length > 60 || m.body.charCodeAt(0) !== 91) continue
    const a = answerOf(m.body)
    if (a && a.id === mediaId && m.sender_id === owner) return a.ok ? 'ok' : 'no'
    const q = st === 'none' && askOf(m.body)
    if (q && q.id === mediaId && m.sender_id !== owner) st = 'asked'
  }
  return st
}

export function useSaveState(convId: string, mediaId: string, owner: string, on: boolean): SaveState {
  return useStore((s) => (on ? saveStateIn(s.messages[convId], mediaId, owner) : 'none'))
}

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/** saves the file: the share sheet on phones (so photos can go to the camera roll), a download elsewhere */
export async function saveFile(url: string, kind: SaveKind): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const fromUrl = (url.split('?')[0].split('.').pop() ?? '').toLowerCase()
  try {
    // this phone's own copy first: the server lets files go after a few hours
    const src = await mediaSrc(url)
    if (!src) return
    const blob = await (await fetch(src)).blob()
    const ext = EXT[blob.type.split(';')[0]] ?? (fromUrl.length <= 4 ? fromUrl : kind === 'voice' ? 'm4a' : 'jpg')
    const name = `strangers-cafe-${kind === 'voice' ? 'voice' : 'photo'}-${stamp}.${ext}`
    const file = new File([blob], name, { type: blob.type || (kind === 'voice' ? 'audio/mp4' : 'image/jpeg') })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (window.matchMedia('(pointer: coarse)').matches && nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return
      }
    }
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 4000)
  } catch {
    /* the file is gone or we are offline */
  }
}
