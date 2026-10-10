// With nsfw off, swears hide under an ink scribble.
import { Fragment } from 'react'
import { useStore } from '../lib/store'

const SWEAR = /\b(f+u+c*k+\w*|f+k+|wtf|stfu|sh+i+t+\w*|b+i+t+c+h+\w*|a+s+s+h+o+l+e+s?|d+i+c+k+s?|p+u+s+s+y+|c+u+n+t+s?|c+o+c+k+s?|bastards?|sluts?|whores?|motherf\w*|bkl|chut\w*|madarch\w*|behench\w*|bhench\w*|bhosd\w*|gand(u|oo)\w*|lund\w*|lawd\w*|rand(i|ii)\w*|harami\w*|kutt[ae]\w*)\b/gi

export function Ink({ text }: { text: string }) {
  const clean = useStore((s) => s.me?.nsfw !== true)
  if (!clean || !SWEAR.test(text)) return <>{text}</>
  SWEAR.lastIndex = 0
  const out: (string | { w: string })[] = []
  let at = 0
  for (const m of text.matchAll(SWEAR)) {
    if (m.index > at) out.push(text.slice(at, m.index))
    out.push({ w: m[0] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return (
    <>
      {out.map((p, i) => (typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <span key={i} className="scrib">{p.w}</span>))}
    </>
  )
}
