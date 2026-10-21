import { useEffect, useState } from 'react'
import { mediaSrc, peekMedia } from './archive'

// the message can show up a beat before its file can be read, so a miss tries again a few times
const TRIES = [0, 800, 2000, 4500, 9000, 15000]

/**
 * A voice note or photo, ready to play or show. Voice notes and photos are private, so this fetches them with the
 * account's token (or reads this device's saved copy). Empty until it's there. keep=false for view once photos.
 */
export function useMediaSrc(url: string, keep = true): string {
  const [src, setSrc] = useState(() => peekMedia(url) ?? '')
  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const hit = peekMedia(url)
    setSrc(hit ?? '')
    const go = (i: number) => {
      void mediaSrc(url, keep).then((u) => {
        if (!live) return
        if (u) return setSrc(u)
        if (i + 1 < TRIES.length) timer = setTimeout(() => go(i + 1), TRIES[i + 1])
      })
    }
    if (!hit) go(0)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [url, keep])
  return src
}
