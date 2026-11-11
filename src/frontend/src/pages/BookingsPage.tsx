import { useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  BackLink,
  Badge,
  ConfirmDialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import type { FormSubmit } from '../components/ui'
import { apiRequest } from '../lib/api'
import { cancellationMessage } from '../lib/messages'
import { interval, localDay, money } from '../lib/format'
import { useResource } from '../lib/use-resource'
import type { Booking, Room } from '../lib/types'

export function BookingsPage({ owner = false }: { owner?: boolean }) {
  const [params, setParams] = useSearchParams()
  const resource = useResource<Booking[]>(
    owner ? '/api/owner/bookings' : '/api/bookings'
  )
  const prefix = owner ? '/owner/bookings' : '/bookings'
  const query = params.get('q') || ''
  const status = params.get('status') || ''
  const date = params.get('date') || ''
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const rows = resource.data?.filter(
    (booking) =>
      (!query ||
        `${booking.id} ${booking.court_name}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())) &&
      (!status || booking.status === status) &&
      (!date || localDay(new Date(booking.start_at)) === date) &&
      (!params.get('court') || booking.court_id === params.get('court'))
  )
  return (
    <>
      <PageHeading
        title={owner ? 'Booking của sân' : 'Lịch đặt của tôi'}
        action={
          <button className="ghost" onClick={resource.reload}>
            Làm mới
          </button>
        }
      >
        {owner
          ? 'Chỉ hiển thị booking thuộc sân của bạn.'
          : '10 booking gần nhất. Mỗi lượt đặt nhiều slot được lưu thành một booking.'}
      </PageHeading>
      {owner && (
        <div className="panel form-grid owner-filters">
          <Field label="Mã booking hoặc tên sân">
            <input
              value={query}
              onChange={(e) => change('q', e.target.value)}
            />
          </Field>
          <Field label="Trạng thái">
            <select
              value={status}
              onChange={(e) => change('status', e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </Field>
          <Field label="Ngày chơi">
            <input
              type="date"
              value={date}
              onChange={(e) => change('date', e.target.value)}
            />
          </Field>
          <button className="ghost" onClick={() => setParams({})}>
            Xóa bộ lọc
          </button>
        </div>
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !rows?.length ? (
        <Empty
          title={owner ? 'Không có booking phù hợp' : 'Bạn chưa có lịch đặt'}
        >
          <Link className="button secondary" to={owner ? '/owner' : '/'}>
            {owner ? 'Sân của tôi' : 'Tìm sân cho trận mới'}
          </Link>
        </Empty>
      ) : (
        <div className="record-list">
          {rows.map((booking) => (
            <article className="panel booking-card" key={booking.id}>
              <div className="section-heading">
                <h2>{booking.court_name}</h2>
                <Badge status={booking.status} />
              </div>
              <p>{interval(booking.start_at, booking.end_at)}</p>
              <p className="muted record-id">Mã booking · {booking.id}</p>
              <strong className="price">
                {money(booking.total_price_vnd)} · {booking.slots.length} slot
              </strong>
              {!owner && (
                <p className="muted">
                  {booking.can_cancel
                    ? 'Có thể hủy toàn bộ booking (trước giờ chơi ít nhất 6 giờ).'
                    : cancellationMessage(booking)}
                </p>
              )}
              <div className="actions">
                <Link
                  className="button secondary"
                  to={`${prefix}/${booking.id}`}
                  state={{
                    search: `${prefix}${params.size ? `?${params}` : ''}`,
                  }}
                >
                  Xem chi tiết
                </Link>
                {booking.room_id && (
                  <Link
                    className="button ghost"
                    to={`/rooms/${booking.room_id}`}
                  >
                    Xem phòng
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export function BookingPage({ owner = false }: { owner?: boolean }) {
  const { bookingId } = useParams()
  const resource = useResource<Booking>(
    `${owner ? '/api/owner/bookings' : '/api/bookings'}/${bookingId}`
  )
  const location = useLocation()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'cancel' | 'room' | null>(null)
  const [capacity, setCapacity] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function cancel() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
      setDialog(null)
      resource.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể hủy booking.')
      resource.reload()
    } finally {
      setBusy(false)
    }
  }
  async function createRoom(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const room = await apiRequest<Room>(`/api/bookings/${bookingId}/room`, {
        method: 'POST',
        body: { capacity: Number(data.get('capacity')) },
      })
      navigate(`/rooms/${room.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo phòng.')
      resource.reload()
    } finally {
      setBusy(false)
    }
  }
  if (resource.loading) return <Loading />
  if (resource.error && !resource.data)
    return <ErrorNotice message={resource.error} retry={resource.reload} />
  if (!resource.data) return null
  const booking = resource.data
  return (
    <>
      <BackLink
        to={
          (location.state as { search?: string } | null)?.search ||
          (owner ? '/owner/bookings' : '/bookings')
        }
      >
        Danh sách booking
      </BackLink>
      <PageHeading
        title={
          (location.state as { created?: boolean } | null)?.created
            ? 'Đặt sân thành công'
            : 'Chi tiết booking'
        }
      >
        {booking.court_name}
      </PageHeading>
      <section className="panel booking-details">
        <div className="section-heading">
          <h2>{interval(booking.start_at, booking.end_at)}</h2>
          <Badge status={booking.status} />
        </div>
        <dl className="detail-list">
          <div>
            <dt>Mã booking</dt>
            <dd className="record-id">{booking.id}</dd>
          </div>
          <div>
            <dt>Ngày tạo</dt>
            <dd>
              {interval(booking.created_at, booking.created_at).split('–')[0]}
            </dd>
          </div>
          {owner && booking.player_contact && (
            <>
              <div>
                <dt>Email Người chơi</dt>
                <dd>
                  {booking.player_contact.registration_email ||
                    'Email chưa đồng bộ; Người chơi cần đăng nhập lại.'}
                </dd>
              </div>
              {booking.player_contact.display_name && (
                <div>
                  <dt>Tên hiển thị</dt>
                  <dd>{booking.player_contact.display_name}</dd>
                </div>
              )}
            </>
          )}
        </dl>
        <h3>Các slot trong booking</h3>
        <div className="review-slots">
          {booking.slots.map((slot) => (
            <div key={slot.slot_id}>
              <span>{interval(slot.start_at, slot.end_at)}</span>
              <strong>{money(slot.price_vnd)}</strong>
            </div>
          ))}
        </div>
        <div className="total">
          <span>Tổng đã chấp nhận</span>
          <strong>{money(booking.total_price_vnd)}</strong>
        </div>
        {!owner && (
          <>
            <p className="muted">
              {booking.can_cancel
                ? 'Bạn có thể hủy toàn bộ lượt đặt trước giờ chơi ít nhất 6 giờ. Điều kiện được kiểm tra lại khi nhận yêu cầu.'
                : cancellationMessage(booking)}
            </p>
            <div className="actions">
              <button
                className="danger"
                disabled={!booking.can_cancel}
                onClick={() => {
                  setError('')
                  setDialog('cancel')
                }}
              >
                Hủy toàn bộ booking
              </button>
              {booking.room_id ? (
                <Link
                  className="button secondary"
                  to={`/rooms/${booking.room_id}`}
                >
                  Xem phòng Open Play
                </Link>
              ) : (
                <button
                  className="secondary"
                  disabled={!booking.can_create_room}
                  onClick={() => {
                    setError('')
                    setDialog('room')
                  }}
                >
                  Tạo phòng Open Play
                </button>
              )}
            </div>
          </>
        )}
      </section>
      {dialog === 'cancel' && (
        <ConfirmDialog
          title="Hủy toàn bộ lịch đặt?"
          confirm="Xác nhận hủy booking"
          danger
          busy={busy}
          error={error}
          onClose={() => setDialog(null)}
          onConfirm={() => void cancel()}
        >
          <p>
            Toàn bộ {booking.slots.length} slot sẽ được giải phóng. Phòng Open
            Play liên kết sẽ đóng và giữ lịch sử thành viên.
          </p>
          <p>
            {interval(booking.start_at, booking.end_at)} ·{' '}
            {money(booking.total_price_vnd)}
          </p>
        </ConfirmDialog>
      )}
      {dialog === 'room' && (
        <Modal
          title={
            booking.room_id ? 'Phòng Open Play đã có' : 'Tạo phòng từ booking'
          }
          onClose={() => {
            if (!busy) setDialog(null)
          }}
        >
          <p>
            {booking.court_name} · {interval(booking.start_at, booking.end_at)}
          </p>
          {booking.room_id ? (
            <div className="notice success" role="status">
              <p>
                Phòng đã được lưu cho booking này. Mở phòng để kiểm tra thông
                tin.
              </p>
              <Link className="button" to={`/rooms/${booking.room_id}`}>
                Mở phòng Open Play
              </Link>
            </div>
          ) : (
            <form aria-busy={busy} onSubmit={(e) => void createRoom(e)}>
              <Field
                label="Sức chứa phòng"
                hint={`Từ 2 đến ${2 * booking.court_max_players} người, gồm bạn là người tổ chức. Sân chơi đồng thời tối đa ${booking.court_max_players} người.`}
              >
                <input
                  name="capacity"
                  disabled={busy}
                  type="number"
                  min={2}
                  max={2 * booking.court_max_players}
                  step={1}
                  required
                  value={
                    capacity ??
                    String(Math.min(4, 2 * booking.court_max_players))
                  }
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </Field>
              <p className="muted">
                Mỗi booking chỉ tạo một phòng. Chi phí theo người chỉ là ước
                tính, không thu tiền.
              </p>
              {error && <ErrorNotice message={error} />}
              <div className="actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Hủy, chưa tạo
                </button>
                <button disabled={busy}>
                  {busy ? 'Đang tạo…' : 'Tạo phòng'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
