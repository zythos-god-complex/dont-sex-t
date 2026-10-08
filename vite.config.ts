/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { buildManifest } from './api/manifest.ts'

// Serves /api/manifest in dev and preview (on Vercel it is a function).
function devManifest(): Plugin {
  const mw = (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(b: string): void }, next: () => void) => {
    if (!req.url || !req.url.startsWith('/api/manifest')) return next()
    const t = new URL(req.url, 'http://x').searchParams.get('t')
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(buildManifest(t)))
  }
  return {
    name: 'gat-dev-manifest',
    configureServer(server) {
      server.middlewares.use(mw)
    },
    configurePreviewServer(server) {
      server.middlewares.use(mw)
    },
  }
}

export default defineConfig({
  plugins: [react(), devManifest()],
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: false },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
