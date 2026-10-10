// Doodle: draw something quick and it goes out as a photo.
import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../../ui/kit'

const INKS = ['#17131F', '#FF5C7A', '#FFC83D', '#3DD6B5', '#5BB5FF', '#8A6BFF']
type Stroke = { c: string; w: number; pts: [number, number][] }

export function DoodleSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (f: File) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const cur = useRef<Stroke | null>(null)
  const [ink, setInk] = useState(INKS[0])
  const [thick, setThick] = useState(false)
  const [n, setN] = useState(0)
  const size = typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 48) : 320

  const paint = () => {
    const c = cv.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    g.setTransform(2, 0, 0, 2, 0, 0)
    g.fillStyle = '#FFFDF8'
    g.fillRect(0, 0, size, size)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const s of strokes.current) {
      g.strokeStyle = s.c
      g.lineWidth = s.w
      g.beginPath()
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1])
      g.stroke()
    }
  }
  useEffect(() => {
    if (!open) return
    strokes.current = []
    setN(0)
    requestAnimationFrame(paint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const at = (e: React.PointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const down = (e: React.PointerEvent) => {
    cv.current?.setPointerCapture(e.pointerId)
    cur.current = { c: ink, w: thick ? 10 : 4, pts: [at(e)] }
    strokes.current.push(cur.current)
    paint()
  }
  const move = (e: React.PointerEvent) => {
    if (!cur.current) return
    cur.current.pts.push(at(e))
    paint()
  }
  const up = () => {
    if (cur.current) setN(strokes.current.length)
    cur.current = null
  }
  const send = () => cv.current?.toBlob((b) => b && onSend(new File([b], 'doodle.png', { type: 'image/png' })), 'image/png')

  return (
    <Sheet open={open} onClose={onClose} label="doodle">
      <div className="doodle">
        <canvas ref={cv} width={size * 2} height={size * 2} style={{ width: size, height: size }} className="doodle-cv" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <div className="doodle-inks">
          {INKS.map((c) => (
            <button key={c} type="button" className={'doodle-ink' + (ink === c ? ' is-on' : '')} style={{ background: c }} aria-label={c} onClick={() => setInk(c)} />
          ))}
          <button type="button" className={'doodle-ink is-size' + (thick ? ' is-on' : '')} aria-label="brush size" onClick={() => setThick((v) => !v)}>
            <i style={{ width: thick ? 12 : 6, height: thick ? 12 : 6 }} />
          </button>
        </div>
        <div className="doodle-acts">
          <button type="button" className="acc-btn" disabled={!n} onClick={() => (strokes.current.pop(), setN(strokes.current.length), paint())}>
            undo
          </button>
          <button type="button" className="acc-btn" disabled={!n} onClick={() => ((strokes.current = []), setN(0), paint())}>
            clear
          </button>
          <button type="button" className="wish-send doodle-send" disabled={!n} onClick={send}>
            send
          </button>
        </div>
      </div>
    </Sheet>
  )
}
