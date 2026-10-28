import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'build-identity',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit }) })
    },
  }],
})
