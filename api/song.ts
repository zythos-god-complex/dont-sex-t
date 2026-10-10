import type { VercelRequest, VercelResponse } from '@vercel/node'

// Song search for the profile song card: iTunes catalog (free, no key), India storefront first.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = String(req.query.q || '').trim().slice(0, 80)
  if (q.length < 2) return res.status(200).json([])
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=12&country=IN&term=${encodeURIComponent(q)}`
  try {
    const r = await fetch(url)
    if (!r.ok) return res.status(200).json([])
    const j = (await r.json()) as { results?: { trackId: number; trackName: string; artistName: string; artworkUrl100?: string }[] }
    const out = (j.results || [])
      .filter((x) => x.trackId && x.trackName && x.artworkUrl100)
      .map((x) => ({ id: String(x.trackId), t: x.trackName, by: x.artistName, img: x.artworkUrl100!.replace(/\/\d+x\d+bb\./, '/600x600bb.') }))
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json(out)
  } catch {
    return res.status(200).json([])
  }
}
