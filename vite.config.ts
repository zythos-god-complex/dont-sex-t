import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Every build gets an id; open tabs poll /version.json and offer a refresh when it changes.
// a silent release (release.json { silent: true, keep: <live id> }) keeps the live id, so no update popup anywhere
const REL = (() => {
  try {
    return JSON.parse(readFileSync('release.json', 'utf8')) as { silent?: boolean; keep?: string }
  } catch {
    return {}
  }
})()
const BUILD_ID = REL.silent && REL.keep ? REL.keep : Date.now().toString(36)

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
  build: {
    // older iPhones (iOS 14+) and Android WebViews (Chrome 87+) still run the app
    target: ['es2020', 'safari14', 'chrome87', 'firefox78'],
    sourcemap: false,
    rolldownOptions: {
      output: {
        // libraries rarely change; keep them in their own cached files so a deploy only re-downloads app code
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
})
