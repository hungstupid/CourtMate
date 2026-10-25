export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

export async function checkHealth(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal })
  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}.`)
  }

  const data: unknown = await response.json()
  if (
    typeof data !== 'object' || data === null ||
    !('status' in data) || data.status !== 'ok' ||
    !('service' in data) || data.service !== 'courtmate-api'
  ) {
    throw new Error('Backend returned an unexpected health response.')
  }
}
