import type { VercelRequest, VercelResponse } from '@vercel/node'

const TOKEN_RE = /^[A-Za-z0-9_-]{1,64}$/

/** Web app manifest. With ?t=<token> the start_url carries identity into an iOS home screen install. */
export function buildManifest(t?: string | null) {
  const token = t && TOKEN_RE.test(t) ? t : null
  return {
    name: 'GoofyAhhTalk',
    short_name: 'GoofyAhhTalk',
    id: '/',
    scope: '/',
    start_url: token ? `/?t=${token}` : '/',
    display: 'standalone',
    background_color: '#FBF5EC',
    theme_color: '#FBF5EC',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query?.t
  const t = Array.isArray(raw) ? raw[0] : raw
  const manifest = buildManifest(typeof t === 'string' ? t : null)
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', manifest.start_url !== '/' ? 'no-store' : 'public, max-age=3600')
  res.status(200).send(JSON.stringify(manifest))
}
