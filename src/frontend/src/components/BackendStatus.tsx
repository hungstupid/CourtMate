import { useEffect, useState } from 'react'
import { API_BASE_URL, checkHealth } from '../lib/api'

type Connection =
  | { status: 'loading' }
  | { status: 'connected' }
  | { status: 'error'; message: string }

export function BackendStatus() {
  const [connection, setConnection] = useState<Connection>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), import.meta.env.PROD ? 75000 : 8000)

    checkHealth(controller.signal)
      .then(() => {
        if (active) setConnection({ status: 'connected' })
      })
      .catch((error: unknown) => {
        if (active) {
          setConnection({
            status: 'error',
            message: controller.signal.aborted
              ? 'Connection timed out. Check that the backend is running.'
              : error instanceof Error ? error.message : 'Unable to reach the backend.',
          })
        }
      })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  function retry() {
    setConnection({ status: 'loading' })
    setAttempt((value) => value + 1)
  }

  return (
    <section className="connection" aria-labelledby="connection-title">
      <div className="connection-heading">
        <h2 id="connection-title">Backend connection</h2>
        <span className={`badge ${connection.status}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {connection.status === 'loading' ? 'Connecting…' :
            connection.status === 'connected' ? 'Connected' : 'Connection error'}
        </span>
      </div>
      <p className="endpoint">{API_BASE_URL}/health</p>
      {connection.status === 'connected' && <p>The CourtMate API is ready for development.</p>}
      {connection.status === 'loading' && <p>Checking the CourtMate API… The first connection may take a minute.</p>}
      {connection.status === 'error' && (
        <div>
          <p role="alert">{connection.message}</p>
          <p>Start the backend and check your API URL, then try again.</p>
          <button type="button" onClick={retry}>Retry connection</button>
        </div>
      )}
    </section>
  )
}
