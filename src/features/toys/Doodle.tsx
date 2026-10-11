// Doodle: draw something quick and it goes out as a photo.
import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../../ui/kit'
import { IconEraser } from '../../ui/icons'

const PAPER = '#FFFDF8'
const INKS = ['#17131F', '#FF5C7A', '#FFC83D', '#3DD6B5', '#5BB5FF', '#8A6BFF']
type Stroke = { c: string; w: number; pts: [number, number][] }

export function DoodleSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (f: File) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const cur = useRef<Stroke | null>(null)
  const [ink, setInk] = useState(INKS[0])
  const [thick, setThick] = useState(false)
  const [erase, setErase] = useState(false)
  const [n, setN] = useState(0)
  const size = typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 48) : 320

  const paint = () => {
    const c = cv.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    g.setTransform(2, 0, 0, 2, 0, 0)
    g.fillStyle = PAPER
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
  // closing the sheet keeps the drawing; only send or clear wipes it
  useEffect(() => {
    if (!open) return
    setN(strokes.current.length)
    requestAnimationFrame(paint)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const at = (e: React.PointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const down = (e: React.PointerEvent) => {
    cv.current?.setPointerCapture(e.pointerId)
    cur.current = { c: erase ? PAPER : ink, w: erase ? (thick ? 22 : 12) : thick ? 10 : 4, pts: [at(e)] }
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
  const send = () =>
    cv.current?.toBlob((b) => {
      if (!b) return
      onSend(new File([b], 'doodle.png', { type: 'image/png' }))
      strokes.current = []
      setN(0)
    }, 'image/png')

  return (
    <Sheet open={open} onClose={onClose} label="doodle">
      <div className="doodle">
        <canvas ref={cv} width={size * 2} height={size * 2} style={{ width: size, height: size }} className="doodle-cv" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <div className="doodle-inks">
          {INKS.map((c) => (
            <button key={c} type="button" className={'doodle-ink' + (!erase && ink === c ? ' is-on' : '')} style={{ background: c }} aria-label={c} onClick={() => (setInk(c), setErase(false))} />
          ))}
        </div>
        <div className="doodle-inks">
          <button type="button" className={'doodle-tool' + (erase ? ' is-on' : '')} aria-label="eraser" aria-pressed={erase} onClick={() => setErase((v) => !v)}>
            <IconEraser size={20} />
          </button>
          {[false, true].map((t) => (
            <button key={String(t)} type="button" className={'doodle-tool' + (thick === t ? ' is-on' : '')} aria-label={t ? 'thick' : 'thin'} aria-pressed={thick === t} onClick={() => setThick(t)}>
              <i style={{ width: t ? 12 : 5, height: t ? 12 : 5 }} />
            </button>
          ))}
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
