import { firebaseAuth } from './firebase'
import type { Review } from './types'

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '')

export class ApiError extends Error {
  code?: string
  review?: Review
  fieldErrors: Record<string, string> = {}
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
      if (!user) throw new ApiError(401, 'Vui lòng đăng nhập để tiếp tục.')
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
        401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        403: 'Bạn không có quyền thực hiện thao tác này.',
        409: 'Dữ liệu đã thay đổi. Vui lòng làm mới và thử lại.',
        422: 'Vui lòng kiểm tra thông tin đã nhập.',
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
        ACCOUNT_UNREGISTERED: 'Hoàn tất đăng ký tài khoản để tiếp tục.',
        QUOTE_CHANGED:
          'Giá đã thay đổi. Xem lại từng slot và tổng mới trước khi xác nhận lại.',
        SLOT_UNAVAILABLE:
          'Một khung giờ đã chọn không còn trống. Lịch đã được kiểm tra lại; hãy chọn giờ phù hợp.',
        BOOKING_CONFLICT:
          'Khung giờ vừa được người khác đặt. Hãy kiểm tra lịch và chọn lại.',
        INVALID_SELECTION:
          'Chọn các slot trống liền nhau trong cùng ngày, tổng từ 60 đến 240 phút.',
        ROOM_CLOSED: 'Phòng đã đóng, không thể tham gia hoặc rời phòng.',
        ROOM_FULL:
          'Chỗ cuối cùng vừa được nhận. Làm mới để xem trạng thái phòng.',
        ALREADY_MEMBER: 'Bạn đã tham gia phòng này.',
        ROOM_ALREADY_EXISTS: 'Lượt đặt này đã có một phòng Open Play.',
        INVALID_CAPACITY: 'Kiểm tra giới hạn số người của sân hoặc phòng.',
        ROOM_CAPACITY_CONFLICT:
          'Số người mới không đáp ứng sức chứa của một phòng Open Play hiện có.',
        BOOKING_PROTECTED:
          'Khung giờ đã có lượt đặt xác nhận; không thể thay đổi giờ và giá đã được bảo vệ.',
        BATCH_OVERLAP:
          'Các dòng nháp bị trùng giờ. Chỉnh lại thời gian; chưa có slot nào được công bố.',
        SLOT_OVERLAP:
          'Khung giờ trùng với lịch đã công bố. Chưa có slot nào được công bố thêm.',
        OUTSIDE_HOURS: 'Khung giờ phải nằm trong giờ hoạt động của sân.',
        MAINTENANCE_CONFLICT:
          'Khung giờ trùng với lịch bảo trì. Vui lòng chọn khoảng khác.',
        SCHEDULE_CONFLICT:
          'Giờ hoạt động mới không bao phủ lịch đã công bố. Vui lòng kiểm tra lại.',
        MANUAL_WINDOW:
          'Ưu đãi thủ công chỉ áp dụng cho slot bắt đầu trong 24 giờ tới. Chọn tự động để đặt lịch sớm hơn.',
        OFFER_EXISTS: 'Slot này đã có ưu đãi được hẹn hoặc đang áp dụng.',
        OFFER_STATE_CHANGED:
          'Trạng thái ưu đãi đã thay đổi. Làm mới và xác nhận thao tác phù hợp.',
        INVALID_OFFER_PRICE:
          'Giá ưu đãi phải là số nguyên dương và thấp hơn giá thường.',
        CANCELLATION_NOT_ALLOWED:
          'Chỉ có thể hủy lượt đặt đã xác nhận trước giờ chơi ít nhất 6 giờ.',
      }
      const error = new ApiError(
        response.status,
        (code && business[code]) ||
          messages[response.status] ||
          (response.status >= 500
            ? 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.'
            : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
      )
      error.code = code
      if (Array.isArray(detail))
        for (const item of detail) {
          if (
            item &&
            Array.isArray(item.loc) &&
            item.loc[0] === 'body' &&
            typeof item.loc[1] === 'string'
          )
            error.fieldErrors[item.loc[1]] = [
              'string_too_short',
              'missing',
            ].includes(item.type)
              ? 'Vui lòng điền thông tin, không để trống hoặc chỉ nhập khoảng trắng.'
              : 'Giá trị không hợp lệ. Kiểm tra định dạng và giới hạn của trường.'
        }
      if (
        code === 'QUOTE_CHANGED' &&
        detail &&
        typeof detail === 'object' &&
        'review' in detail
      ) {
        const review = detail.review as Review
        if (
          review &&
          Array.isArray(review.slot_ids) &&
          Array.isArray(review.slots) &&
          typeof review.quote === 'string' &&
          Number.isSafeInteger(review.total_price_vnd)
        )
          error.review = review
      }
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
      throw new ApiError(0, 'Yêu cầu đã được dừng.', 'cancelled')
    if (timeout.aborted)
      throw new ApiError(
        0,
        'Yêu cầu quá thời gian chờ. Vui lòng thử lại.',
        'timeout'
      )
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
      throw new ApiError(
        401,
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      )
    }
    throw new ApiError(
      0,
      'Không thể kết nối. Kiểm tra mạng và thử lại.',
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
