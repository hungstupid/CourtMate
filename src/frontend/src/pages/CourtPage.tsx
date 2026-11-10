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
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import { apiRequest } from '../lib/api'
import { useResource } from '../lib/use-resource'
import { useSession } from '../lib/session-context'
import { interval, localDay, money, timeLabel } from '../lib/format'
import type { Availability, Booking, Court, Review, Slot } from '../lib/types'

export function CourtPage() {
  const { courtId } = useParams()
  const location = useLocation()
  const court = useResource<Court>(`/api/courts/${courtId}`, false)
  const [origin, setOrigin] = useState('')
  const [showMap, setShowMap] = useState(false)
  if (court.loading) return <Loading />
  if (court.error)
    return <ErrorNotice message={court.error} retry={court.reload} />
  if (!court.data) return null
  const c = court.data
  const search = (location.state as { search?: string } | null)?.search
  return (
    <>
      <BackLink to={search || '/'}>Danh sách sân</BackLink>
      <div className="court-detail">
        <section>
          <div className="detail-image">
            {c.photo_urls[0] ? (
              <img src={c.photo_urls[0]} alt={c.name} />
            ) : (
              <img
                src="/images/court-detail.svg"
                width="680"
                height="300"
                alt="Hình minh họa sân; chủ sân chưa cung cấp ảnh thực tế"
              />
            )}
          </div>
          <Badge status={c.sport} />
          <h1>{c.name}</h1>
          <p className="muted">
            {c.address} · {c.area}
          </p>
          <p>{c.description}</p>
          <dl className="detail-list">
            <div>
              <dt>Liên hệ sân</dt>
              <dd>{c.contact || 'Chưa cung cấp'}</dd>
            </div>
            <div>
              <dt>Người chơi đồng thời</dt>
              <dd>{c.max_players} người</dd>
            </div>
          </dl>
          {c.photo_urls.length > 1 && (
            <div className="photo-gallery">
              {c.photo_urls.slice(1).map((url) => (
                <img key={url} src={url} alt={`Ảnh ${c.name}`} loading="lazy" />
              ))}
            </div>
          )}
        </section>
        <aside className="panel booking-sidebar">
          <strong className="large-price">{money(c.base_price_vnd)}</strong>
          <p className="muted">Giá cơ bản / giờ</p>
          <Link className="button full" to={`/courts/${c.id}/slots`}>
            Xem giờ trống
          </Link>
          <div className="notice info">
            <strong>Lịch cập nhật theo sân</strong>
            <p>
              Chọn giờ chỉ để xem trước. Sân được giữ khi xác nhận thành công.
            </p>
          </div>
          <details onToggle={(e) => setShowMap(e.currentTarget.open)}>
            <summary>Vị trí & chỉ đường</summary>
            {showMap && (
              <iframe
                className="court-map"
                title={`Bản đồ ${c.name}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(c.address)}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
            <p className="muted">
              {c.address}. Bạn có thể nhập điểm đi; không cần quyền GPS.
            </p>
            <Field label="Điểm xuất phát">
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Địa chỉ xuất phát"
              />
            </Field>
            <a
              className="button ghost full"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}${origin.trim() ? `&origin=${encodeURIComponent(origin.trim())}` : ''}`}
              target="_blank"
              rel="noreferrer"
            >
              Mở chỉ đường ↗
            </a>
            <a
              className="text-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              Xem vị trí trên bản đồ ↗
            </a>
          </details>
        </aside>
      </div>
    </>
  )
}

export function SlotsPage() {
  const { courtId } = useParams()
  const [params, setParams] = useSearchParams()
  const day = params.get('date') || localDay()
  const court = useResource<Court>(`/api/courts/${courtId}`, false)
  const availability = useResource<Availability>(
    `/api/courts/${courtId}/availability?date=${day}`,
    false
  )
  const [selected, setSelected] = useState<string[]>(
    params.get('slot') ? [params.get('slot')!] : []
  )
  const [error, setError] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const session = useSession()
  const navigate = useNavigate()
  const chosen = (availability.data?.slots || [])
    .filter((slot) => selected.includes(slot.id))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
  function toggle(slot: Slot) {
    setError('')
    const next = selected.includes(slot.id)
      ? selected.filter((id) => id !== slot.id)
      : [...selected, slot.id]
    const rows = (availability.data?.slots || [])
      .filter((row) => next.includes(row.id))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
    if (
      rows.length &&
      (rows.some(
        (row, index) =>
          index > 0 &&
          new Date(rows[index - 1].end_at).getTime() !==
            new Date(row.start_at).getTime()
      ) ||
        new Date(rows.at(-1)!.end_at).getTime() -
          new Date(rows[0].start_at).getTime() >
          240 * 60000)
    ) {
      setError(
        'Chọn các slot liền nhau trong cùng ngày, tổng từ 60 đến 240 phút. Xóa lựa chọn để bắt đầu lại.'
      )
      return
    }
    setSelected(next)
  }
  async function getReview() {
    setBusy(true)
    setError('')
    try {
      setReview(
        await apiRequest<Review>('/api/bookings/review', {
          method: 'POST',
          body: { slot_ids: chosen.map((slot) => slot.id) },
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xem lại booking.')
      availability.reload()
      setSelected([])
    } finally {
      setBusy(false)
    }
  }
  async function confirm() {
    if (!review) return
    setBusy(true)
    setError('')
    try {
      const booking = await apiRequest<Booking>('/api/bookings', {
        method: 'POST',
        body: { slot_ids: review.slot_ids, quote: review.quote },
      })
      navigate(`/bookings/${booking.id}`, {
        state: { created: true },
        replace: true,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể xác nhận booking.')
      setReview(null)
      setSelected([])
      availability.reload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <BackLink to={`/courts/${courtId}`}>Thông tin sân</BackLink>
      <PageHeading
        title={`Chọn slot${court.data ? ` · ${court.data.name}` : ''}`}
      >
        Các slot được Chủ sân công bố. Giờ Việt Nam · UTC+7.
      </PageHeading>
      <div className="form-grid">
        <Field label="Sân đang xem">
          <input readOnly value={court.data?.name || 'Đang tải…'} />
        </Field>
        <Field label="Ngày xem lịch">
          <input
            type="date"
            required
            value={day}
            onChange={(e) => {
              if (e.target.value) {
                setSelected([])
                setError('')
                setParams({ date: e.target.value })
              }
            }}
          />
        </Field>
      </div>
      <div className="notice success">
        <h2>Chọn một hoặc nhiều slot liên tiếp</h2>
        <p>
          Chọn tối đa 240 phút trong cùng ngày. Slot đã đặt hoặc bảo trì không
          thể chọn.
        </p>
      </div>
      {error && <ErrorNotice message={error} />}
      {court.error && (
        <ErrorNotice message={court.error} retry={court.reload} />
      )}
      {availability.loading ? (
        <Loading />
      ) : availability.error ? (
        <ErrorNotice message={availability.error} retry={availability.reload} />
      ) : !availability.data?.slots.length ? (
        <Empty title="Chưa có slot được công bố">
          Chọn ngày khác để xem lịch sân.
        </Empty>
      ) : (
        <div className="slot-list">
          {availability.data.slots.map((slot) => (
            <button
              key={slot.id}
              className={`slot-row ${selected.includes(slot.id) ? 'selected' : ''}`}
              aria-pressed={selected.includes(slot.id)}
              disabled={slot.status !== 'AVAILABLE'}
              onClick={() => toggle(slot)}
            >
              <span>
                <strong>
                  {timeLabel(slot.start_at)}–{timeLabel(slot.end_at)}
                </strong>
                <Badge status={slot.status} />
              </span>
              <span>
                {slot.regular_price_vnd &&
                  slot.regular_price_vnd !== slot.price_vnd && (
                    <del>{money(slot.regular_price_vnd)}</del>
                  )}
                <strong>{money(slot.price_vnd)}</strong>
                {selected.includes(slot.id) && <span>✓ Đã chọn</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {!!availability.data?.maintenance.length && (
        <section className="notice warning">
          <h2>Bảo trì</h2>
          {availability.data.maintenance.map((block) => (
            <p key={block.id}>
              {interval(block.start_at, block.end_at)} · Không thể đặt
            </p>
          ))}
        </section>
      )}
      <div className="selection-summary panel">
        <div>
          <h2>
            {chosen.length ? `${chosen.length} slot đã chọn` : 'Chưa chọn slot'}
          </h2>
          <p className="muted">
            {chosen.length
              ? `${interval(chosen[0].start_at, chosen.at(-1)!.end_at)} · ${money(chosen.reduce((sum, row) => sum + row.price_vnd, 0))}`
              : 'Chọn slot trống để xem giá và đặt sân.'}
          </p>
        </div>
        <div className="actions">
          <button
            className="ghost"
            disabled={!chosen.length || busy}
            onClick={() => {
              setSelected([])
              setError('')
            }}
          >
            Xóa lựa chọn
          </button>
          {session.status !== 'ready' ? (
            <Link
              className="button"
              to="/login"
              state={{ from: `/courts/${courtId}/slots?${params}` }}
            >
              Đăng nhập để đặt sân
            </Link>
          ) : session.identity?.role === 'owner' ? (
            <p className="muted">Đặt sân dành cho tài khoản Người chơi.</p>
          ) : (
            <button
              disabled={!chosen.length || busy}
              onClick={() => void getReview()}
            >
              {busy ? 'Đang kiểm tra…' : 'Xem lại đặt sân'}
            </button>
          )}
        </div>
      </div>
      {review && (
        <Modal
          title="Xem lại các slot đã chọn"
          onClose={() => {
            if (!busy) setReview(null)
          }}
        >
          <p>{court.data?.name}</p>
          <strong>
            {interval(review.start_at, review.end_at)} ·{' '}
            {review.duration_minutes} phút
          </strong>
          <div className="review-slots">
            {review.slots.map((slot) => (
              <div key={slot.id}>
                <span>
                  {timeLabel(slot.start_at)}–{timeLabel(slot.end_at)}
                </span>
                <strong>{money(slot.price_vnd)}</strong>
              </div>
            ))}
          </div>
          <div className="total">
            <span>Tổng một booking</span>
            <strong>{money(review.total_price_vnd)}</strong>
          </div>
          <p className="muted">
            Chưa giữ sân. Giá và toàn bộ slot được kiểm tra lại khi xác nhận.
          </p>
          <div className="actions">
            <button
              className="ghost"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Đổi lựa chọn
            </button>
            <button disabled={busy} onClick={() => void confirm()}>
              {busy ? 'Đang xác nhận…' : 'Xác nhận đặt sân'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
