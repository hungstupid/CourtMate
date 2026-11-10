import { firebaseAuth } from './firebase'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

export class ApiError extends Error {
  code?: string
  status: number
  kind: 'http' | 'network' | 'timeout' | 'cancelled'
  constructor(
    status: number,
    message: string,
    kind: ApiError['kind'] = 'http'
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  authenticated?: boolean
  timeoutMs?: number
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  signal.throwIfAborted()
  let abort: (() => void) | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
      }),
    ])
  } finally {
    if (abort) signal.removeEventListener('abort', abort)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('API path must be relative.')
  const {
    body,
    authenticated = true,
    timeoutMs = 75000,
    signal,
    ...init
  } = options
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
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
    })
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'Your session expired. Sign in again.',
        403: 'You do not have permission for this action.',
        409: 'This information changed. Refresh and try again.',
        422: 'Check the information you entered.',
      }
      const payload: unknown = await response.json().catch(() => null)
      const detail =
        payload && typeof payload === 'object' && 'detail' in payload
          ? payload.detail
          : null
      const code =
        detail &&
        typeof detail === 'object' &&
        'code' in detail &&
        typeof detail.code === 'string'
          ? detail.code
          : undefined
      const business: Record<string, string> = {
        ACCOUNT_UNREGISTERED: 'Complete your account registration to continue.',
        QUOTE_CHANGED:
          'The price changed. Review the current slots and total before confirming again.',
        SLOT_UNAVAILABLE:
          'A selected slot is no longer available. Refresh and choose another time.',
        BOOKING_CONFLICT:
          'Someone booked this interval. Refresh and choose another time.',
        INVALID_SELECTION:
          'Select consecutive available slots on one day, totalling 60–240 minutes.',
        ROOM_CLOSED:
          'This room is closed. Joining and leaving are no longer available.',
        ROOM_FULL:
          'The final place was taken. Refresh to see the current room.',
        ALREADY_MEMBER: 'You already joined this room.',
        ROOM_ALREADY_EXISTS: 'This booking already has an Open Play room.',
        INVALID_CAPACITY:
          'Check the allowed capacity shown for this court or room.',
        ROOM_CAPACITY_CONFLICT:
          'This capacity would invalidate an existing Open Play room.',
        BOOKING_PROTECTED:
          'An existing confirmed booking protects this interval and regular price.',
        BATCH_OVERLAP:
          'Draft rows overlap. Correct the times; nothing was published.',
        SLOT_OVERLAP:
          'A slot overlaps the published schedule. Nothing was published.',
        OUTSIDE_HOURS: 'The slot must fit the court’s operating hours.',
        MAINTENANCE_CONFLICT:
          'A slot overlaps maintenance. Choose another interval.',
        SCHEDULE_CONFLICT: 'These hours would invalidate a published slot.',
        MANUAL_WINDOW:
          'Manual offers require a slot starting within 24 hours. Choose automatic for a later slot.',
        OFFER_EXISTS: 'This slot already has a scheduled or active offer.',
        OFFER_STATE_CHANGED:
          'The offer state changed. Refresh and confirm the appropriate action.',
        INVALID_OFFER_PRICE:
          'Offer price must be a positive whole-VND amount below the regular quote.',
        CANCELLATION_NOT_ALLOWED:
          'Cancellation requires a confirmed booking at least six hours before play.',
      }
      const error = new ApiError(
        response.status,
        (code && business[code]) ||
          messages[response.status] ||
          (response.status >= 500
            ? 'The service is temporarily unavailable. Please retry.'
            : 'The request could not be completed.')
      )
      error.code = code
      throw error
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T)
  } catch (error) {
    if (error instanceof ApiError) {
      if (authenticated && error.status === 401)
        window.dispatchEvent(new Event('courtmate:session-expired'))
      throw error
    }
    if (signal?.aborted)
      throw new ApiError(0, 'Request cancelled.', 'cancelled')
    if (timeout.aborted)
      throw new ApiError(0, 'The request timed out. Please retry.', 'timeout')
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      [
        'auth/user-token-expired',
        'auth/invalid-user-token',
        'auth/user-disabled',
        'auth/user-not-found',
      ].includes(error.code)
    ) {
      window.dispatchEvent(new Event('courtmate:session-expired'))
      throw new ApiError(401, 'Your session expired. Sign in again.')
    }
    throw new ApiError(
      0,
      'Unable to connect. Check your connection and retry.',
      'network'
    )
  }
}

export async function checkHealth(signal: AbortSignal): Promise<void> {
  const data = await apiRequest<unknown>('/health', {
    signal,
    authenticated: false,
  })
  if (
    typeof data !== 'object' ||
    data === null ||
    !('status' in data) ||
    data.status !== 'ok' ||
    !('service' in data) ||
    data.service !== 'courtmate-api'
  ) {
    throw new Error('Backend returned an unexpected health response.')
  }
}
