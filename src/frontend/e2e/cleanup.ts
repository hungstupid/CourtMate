import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default function teardown() {
  const marker = process.env.COURTMATE_E2E_MARKER
  if (!marker || process.env.E2E_BASE_URL) return
  try {
    const result = execFileSync(
      'uv',
      ['run', 'python', '../../scripts/cleanup_e2e.py', '--marker', marker],
      {
        cwd: fileURLToPath(new URL('../../backend', import.meta.url)),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    process.stdout.write(result)
  } catch {
    throw new Error(
      'Targeted local E2E fixture cleanup failed. No database reset was attempted.'
    )
  }
}
