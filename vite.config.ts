import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Every build gets an id; open tabs poll /version.json and offer a refresh when it changes.
const BUILD_ID = Date.now().toString(36)

function versionFile(): Plugin {
  return {
    name: 'gat-version',
    generateBundle() {
      let notes = ''
      try {
        notes = JSON.parse(readFileSync('release.json', 'utf8')).notes ?? ''
      } catch {
        /* no notes */
      }
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, notes }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: false },
})
