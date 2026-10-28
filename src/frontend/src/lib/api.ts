import { firebaseAuth } from './firebase'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  kind: 'http' | 'network' | 'timeout' | 'cancelled'
  constructor(status: number, message: string, kind: ApiError['kind'] = 'http') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; authenticated?: boolean; timeoutMs?: number }

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let abort: (() => void) | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
    })])
  } finally {
    if (abort) signal.removeEventListener('abort', abort)
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API path must be relative.')
  const { body, authenticated = true, timeoutMs = 75000, signal, ...init } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  const headers = new Headers(init.headers)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  try {
    if (authenticated) {
      const user = firebaseAuth?.currentUser
      if (!user) throw new ApiError(401, 'Sign in to continue.')
      const token = await abortable(user.getIdToken(), combined)
      headers.set('Authorization', `Bearer ${token}`)
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: combined,
    })
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'Your session expired. Sign in again.',
        403: 'You do not have permission for this action.',
        409: 'This information changed. Refresh and try again.',
        422: 'Check the information you entered.',
      }
      throw new ApiError(response.status, messages[response.status] || (response.status >= 500
        ? 'The service is temporarily unavailable. Please retry.' : 'The request could not be completed.'))
    }
    return response.status === 204 ? undefined as T : await response.json() as T
  } catch (error) {
    if (error instanceof ApiError) {
      if (authenticated && error.status === 401) window.dispatchEvent(new Event('courtmate:session-expired'))
      throw error
    }
    if (signal?.aborted) throw new ApiError(0, 'Request cancelled.', 'cancelled')
    if (timeout.aborted) throw new ApiError(0, 'The request timed out. Please retry.', 'timeout')
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' &&
      ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled', 'auth/user-not-found'].includes(error.code)) {
      window.dispatchEvent(new Event('courtmate:session-expired'))
      throw new ApiError(401, 'Your session expired. Sign in again.')
    }
    throw new ApiError(0, 'Unable to connect. Check your connection and retry.', 'network')
  }
}

export async function checkHealth(signal: AbortSignal): Promise<void> {
  const data = await apiRequest<unknown>('/health', { signal, authenticated: false })
  if (
    typeof data !== 'object' || data === null ||
    !('status' in data) || data.status !== 'ok' ||
    !('service' in data) || data.service !== 'courtmate-api'
  ) {
    throw new Error('Backend returned an unexpected health response.')
  }
}
