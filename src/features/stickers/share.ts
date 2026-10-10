// Share a sticker as a crisp PNG: the face svg, its caption pill and a tiny goofyahhtalk tag.
export async function shareSticker(el: Element | null, caption: string): Promise<void> {
  const svg = el?.querySelector('svg')
  if (!svg) return
  const clone = svg.cloneNode(true) as SVGSVGElement
  const vb = svg.viewBox.baseVal
  const w0 = vb?.width || svg.clientWidth || 100
  const h0 = vb?.height || svg.clientHeight || 100
  // hats and brims poke outside the face box: give them room
  clone.setAttribute('viewBox', `${(vb?.x ?? 0) - w0 * 0.18} ${(vb?.y ?? 0) - h0 * 0.32} ${w0 * 1.36} ${h0 * 1.36}`)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', '440')
  clone.setAttribute('height', String(Math.round((440 * h0) / w0)))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const W = 600
    const c = document.createElement('canvas')
    c.width = W
    c.height = 660
    const g = c.getContext('2d')
    if (!g) return
    const ih = (440 * img.height) / img.width
    g.drawImage(img, (W - 440) / 2, 16, 440, ih)
    g.font = '800 52px "Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif'
    const pw = g.measureText(caption).width + 64
    const ph = 84
    const px = (W - pw) / 2
    const py = Math.min(16 + ih - 10, 660 - ph - 48)
    g.beginPath()
    if (g.roundRect) g.roundRect(px, py, pw, ph, 26)
    else g.rect(px, py, pw, ph)
    g.fillStyle = '#FFFFFF'
    g.fill()
    g.lineWidth = 7
    g.strokeStyle = '#17131F'
    g.stroke()
    g.fillStyle = '#17131F'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(caption, W / 2, py + ph / 2 + 2)
    g.font = '700 22px system-ui, sans-serif'
    g.fillStyle = 'rgba(23,19,31,.55)'
    g.textAlign = 'right'
    g.fillText('goofyahhtalk', W - 18, 640)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    if (!blob) return
    const file = new File([blob], (caption.replace(/[^a-z0-9]+/gi, '-') || 'sticker') + '.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  } finally {
    URL.revokeObjectURL(url)
  }
}
