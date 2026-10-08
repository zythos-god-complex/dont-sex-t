import { useEffect, useState } from 'react'
import { mediaSrc } from './archive'

/** Prefer this device's saved copy of a voice note or photo; the server deletes files after 24h. */
export function useMediaSrc(url: string): string {
  const [src, setSrc] = useState(url)
  useEffect(() => {
    let live = true
    setSrc(url)
    void mediaSrc(url).then((u) => live && setSrc(u))
    return () => {
      live = false
    }
  }, [url])
  return src
}
