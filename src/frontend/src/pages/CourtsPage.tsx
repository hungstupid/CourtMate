import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Badge,
  CourtImage,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
} from '../components/ui'
import type { FormSubmit } from '../components/ui'
import { SportSelect } from '../components/SportSelect'
import { useResource } from '../lib/use-resource'
import type { Court, Slot } from '../lib/types'
import { interval, localDay, money, toInstant } from '../lib/format'

function SlotPreview({
  court,
  bounds,
  onClose,
}: {
  court: Court
  bounds: URLSearchParams
  onClose: () => void
}) {
  const query = new URLSearchParams()
  for (const key of ['start', 'end'])
    if (bounds.get(key)) query.set(key, toInstant(bounds.get(key)!))
  const resource = useResource<{ slots: Slot[] }>(
    `/api/courts/${court.id}/preview?${query}`,
    false
  )
  return (
    <Modal title={`Slot · ${court.name}`} onClose={onClose}>
      <p className="muted">
        {query.size
          ? 'Các slot trống trong khoảng đã lọc.'
          : 'Các slot trống sắp tới, theo thứ tự thời gian.'}{' '}
        Chỉ giữ sân khi xác nhận thành công.
      </p>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : resource.data?.slots.length ? (
        <div className="slot-preview-list">
          {resource.data.slots.map((slot) => (
            <Link
              className="slot-preview-row"
              key={slot.id}
              to={`/courts/${court.id}/slots?date=${localDay(new Date(slot.start_at))}&slot=${slot.id}`}
            >
              <span>
                {interval(slot.start_at, slot.end_at)}
                <Badge status="AVAILABLE" />
              </span>
              <strong>{money(slot.price_vnd)} →</strong>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Không có slot trống phù hợp">
          Thử một ngày khác hoặc mở toàn bộ lịch sân.
        </Empty>
      )}
      <Link className="button secondary full" to={`/courts/${court.id}/slots`}>
        Xem lịch sân đầy đủ
      </Link>
    </Modal>
  )
}

export function CourtsPage() {
  const [params, setParams] = useSearchParams()
  const [name, setName] = useState(params.get('q') || '')
  const [sport, setSport] = useState(params.get('sport') || '')
  const [area, setArea] = useState(params.get('area') || '')
  const [start, setStart] = useState(params.get('start') || '')
  const [end, setEnd] = useState(params.get('end') || '')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Court | null>(null)
  useEffect(() => {
    const restore = () => {
      const next = new URLSearchParams(window.location.search)
      setName(next.get('q') || '')
      setSport(next.get('sport') || '')
      setArea(next.get('area') || '')
      setStart(next.get('start') || '')
      setEnd(next.get('end') || '')
      setError('')
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const apiParams = new URLSearchParams(params)
  for (const key of ['start', 'end'])
    if (apiParams.get(key)) apiParams.set(key, toInstant(apiParams.get(key)!))
  const resource = useResource<Court[]>(`/api/courts?${apiParams}`, false)
  const sports = useResource<Court[]>('/api/courts', false)
  function apply(event?: FormSubmit) {
    event?.preventDefault()
    if (start && end && end <= start) {
      setError('Thời điểm kết thúc phải sau bắt đầu.')
      return
    }
    setError('')
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries({
      q: name.trim(),
      sport,
      area: area.trim(),
      start,
      end,
    }))
      if (value) next.set(key, value)
    setParams(next)
  }
  function clear(all: boolean) {
    setError('')
    setStart('')
    setEnd('')
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries({
      q: name.trim(),
      sport,
      area: area.trim(),
    }))
      if (value) next.set(key, value)
    if (all) {
      setName('')
      setSport('')
      setArea('')
      setParams({})
    } else setParams(next)
  }
  return (
    <>
      <section className="search-hero" data-figma-node="43:136">
        <div>
          <span className="hero-kicker">RA SÂN CÙNG NHAU</span>
          <h1>
            <span className="desktop-heading">
              Tìm sân.
              <br />
              Hẹn trận mới.
            </span>
            <span className="mobile-heading">Tìm sân cho trận mới</span>
          </h1>
          <p className="hero-copy-desktop">
            Từ một khung giờ trống đến một trận đấu đáng nhớ.
            <br />
            Chọn sân phù hợp, xem giờ rõ ràng, đặt lịch dễ dàng.
          </p>
          <p className="hero-copy-mobile">
            Kết hợp tên sân, môn, địa chỉ hoặc khu vực và thời gian.
          </p>
          <Link className="button secondary" to="/deals">
            Xem ưu đãi giờ gần
          </Link>
        </div>
        <img src="/images/hero-court.svg" width="376" height="236" alt="" />
      </section>
      <form className="panel search-form" onSubmit={apply}>
        <div className="form-grid">
          <Field label="Tên sân" hint="Nhập tên sân trực tiếp.">
            <input
              name="q"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên sân"
              maxLength={150}
            />
          </Field>
          <SportSelect
            value={sport}
            onChange={setSport}
            sports={[
              ...new Set((sports.data || []).map((court) => court.sport)),
            ].sort()}
          />
          <Field
            label="Địa chỉ hoặc khu vực"
            hint="Nhập địa chỉ hoặc khu vực; không cần GPS."
          >
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Nhập địa chỉ hoặc khu vực"
              maxLength={300}
            />
          </Field>
          <div className="form-grid time-fields">
            <Field label="Bắt đầu · tùy chọn" hint="Ngày và giờ · UTC+7">
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field
              label="Kết thúc · tùy chọn"
              hint="Có thể bỏ trống một hoặc cả hai mốc."
            >
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'time-error' : undefined}
              />
              {error && (
                <small id="time-error" className="field-error" role="alert">
                  {error}
                </small>
              )}
            </Field>
          </div>
        </div>
        <div className="actions">
          <button type="submit">Tìm sân</button>
          <button
            type="button"
            className="secondary"
            onClick={() => clear(true)}
          >
            Xóa tất cả
          </button>
        </div>
        <button type="button" className="ghost" onClick={() => clear(false)}>
          Chỉ xóa thời gian
        </button>
      </form>
      <div className="section-heading">
        <h2>Khám phá sân chơi</h2>
        {resource.data && (
          <span className="muted">{resource.data.length} sân phù hợp</span>
        )}
      </div>
      {resource.loading ? (
        <Loading>Đang tải sân…</Loading>
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <Empty title="Không có sân phù hợp">
          <p>Đổi hoặc xóa bộ lọc để tìm sân khác.</p>
          <button className="secondary" onClick={() => clear(true)}>
            Xóa tất cả
          </button>
        </Empty>
      ) : (
        <div className="court-grid">
          {resource.data.map((court) => (
            <article className="court-card" key={court.id}>
              <CourtImage
                urls={court.photo_urls}
                name={court.name}
                sport={court.sport}
              />
              <div className="court-card-content">
                <Badge status={court.sport} />
                <h3>{court.name}</h3>
                <p className="muted">
                  {court.area} · {court.address}
                </p>
                <strong className="price">
                  {money(court.base_price_vnd)} <small>/ giờ cơ bản</small>
                </strong>
                <Link
                  className="button ghost full"
                  to={`/courts/${court.id}`}
                  state={{ search: `/?${params}` }}
                >
                  Xem sân →
                </Link>
                <button
                  className="secondary full"
                  onClick={() => setPreview(court)}
                >
                  Xem slot ↗
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {preview && (
        <SlotPreview
          court={preview}
          bounds={params}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
