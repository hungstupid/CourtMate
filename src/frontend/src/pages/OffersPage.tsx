import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Badge,
  ConfirmDialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
} from '../components/ui'
import { apiRequest } from '../lib/api'
import { useDraftGuard } from '../lib/draft-context'
import { offerMessage } from '../lib/messages'
import { interval, localDay, money } from '../lib/format'
import { useResource } from '../lib/use-resource'
import type { Court, Offer, Slot } from '../lib/types'

function OfferManager({ slot, court }: { slot: Slot; court: Court }) {
  const history = useResource<Offer[]>(`/api/owner/slots/${slot.id}/offers`)
  const [mode, setMode] = useState<'manual' | 'automatic'>('automatic')
  const [price, setPrice] = useState('')
  const [lead, setLead] = useState('3')
  const [confirm, setConfirm] = useState<{
    type: 'create' | 'cancel' | 'deactivate'
    offer?: Offer
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useDraftGuard(busy)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const regular = slot.regular_price_vnd ?? slot.price_vnd
  const application = new Date(
    new Date(slot.start_at).getTime() - Number(lead) * 3600000
  )
  async function save() {
    if (!confirm) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest(
        confirm.type === 'create'
          ? `/api/owner/slots/${slot.id}/offers`
          : `/api/owner/offers/${confirm.offer?.id}/${confirm.type}`,
        {
          method: 'POST',
          ...(confirm.type === 'create'
            ? {
                body: {
                  mode,
                  price_vnd: Number(price),
                  lead_hours: mode === 'manual' ? 24 : Number(lead),
                },
              }
            : {}),
        }
      )
      setConfirm(null)
      guard.markClean()
      setMessage('Ưu đãi đã cập nhật. Giá booking đã xác nhận được giữ nguyên.')
      history.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật ưu đãi.')
      history.reload()
    } finally {
      setBusy(false)
    }
  }
  const nonterminal = history.data?.some((offer) =>
    ['SCHEDULED', 'ACTIVE'].includes(offer.status)
  )
  return (
    <section>
      {error && !confirm && <ErrorNotice message={error} />}
      <div className="notice info">
        <h2>
          {court.name} · {interval(slot.start_at, slot.end_at)}
        </h2>
        <p>
          Giá thường {money(regular)} · <Badge status={slot.status} />. Ưu đãi
          chỉ áp dụng cho slot đã chọn.
        </p>
      </div>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {history.loading ? (
        <Loading />
      ) : history.error ? (
        <ErrorNotice message={history.error} retry={history.reload} />
      ) : (
        <>
          {history.data?.map((offer) => (
            <article className="panel offer-record" key={offer.id}>
              <div className="section-heading">
                <h3>
                  {offer.mode === 'automatic' ? 'Tự động' : 'Thủ công'} ·{' '}
                  {money(offer.price_vnd)}
                </h3>
                <Badge status={offer.status} />
              </div>
              <p>
                Tự áp từ{' '}
                {interval(offer.applies_at, offer.applies_at).split('–')[0]} ·
                Ngưỡng {Number(offer.lead_hours)} giờ
              </p>
              <p className="muted">{offerMessage(offer)}</p>
              {['SCHEDULED', 'ACTIVE'].includes(offer.status) && (
                <button
                  className="ghost"
                  onClick={() => {
                    setError('')
                    setConfirm({
                      type:
                        offer.status === 'SCHEDULED' ? 'cancel' : 'deactivate',
                      offer,
                    })
                  }}
                >
                  {offer.status === 'SCHEDULED'
                    ? 'Hủy lịch ưu đãi'
                    : 'Tắt ưu đãi'}
                </button>
              )}
            </article>
          ))}
          {!nonterminal && (
            <form
              onChangeCapture={guard.markDirty}
              className="offer-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (
                  mode === 'automatic' &&
                  (!Number.isFinite(Number(lead)) ||
                    Number(lead) <= 0 ||
                    Number(lead) > 24)
                ) {
                  setError('Ngưỡng tự áp phải lớn hơn 0 và không quá 24 giờ.')
                  return
                }
                setError('')
                setConfirm({ type: 'create' })
              }}
            >
              <div className="actions">
                <button
                  type="button"
                  className={mode === 'manual' ? 'secondary' : 'ghost'}
                  aria-pressed={mode === 'manual'}
                  onClick={() => {
                    if (mode !== 'manual') guard.markDirty()
                    setMode('manual')
                  }}
                >
                  Thủ công
                </button>
                <button
                  type="button"
                  className={mode === 'automatic' ? 'secondary' : 'ghost'}
                  aria-pressed={mode === 'automatic'}
                  onClick={() => {
                    if (mode !== 'automatic') guard.markDirty()
                    setMode('automatic')
                  }}
                >
                  Tự động
                </button>
              </div>
              <div className="form-grid">
                <Field
                  label="Giá ưu đãi cho cả slot (₫)"
                  hint={`Số nguyên > 0, thấp hơn ${money(regular)}.`}
                >
                  <input
                    type="number"
                    min={1}
                    max={regular - 1}
                    step={1}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Field>
                {mode === 'automatic' && (
                  <Field
                    label="Tự áp trước giờ chơi (giờ)"
                    hint="Lớn hơn 0 và không quá 24 giờ; cho phép số lẻ."
                  >
                    <input
                      type="number"
                      min="0"
                      max={24}
                      step="any"
                      required
                      value={lead}
                      onChange={(e) => setLead(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              {mode === 'automatic' ? (
                <>
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        if (lead !== '3') guard.markDirty()
                        setLead('3')
                      }}
                    >
                      3 giờ
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        if (lead !== '24') guard.markDirty()
                        setLead('24')
                      }}
                    >
                      24 giờ
                    </button>
                  </div>
                  {Number.isFinite(application.getTime()) && (
                    <div className="panel">
                      <h3>
                        Dự kiến tự áp từ{' '}
                        {
                          interval(
                            application.toISOString(),
                            application.toISOString()
                          ).split('–')[0]
                        }
                      </h3>
                      <p>
                        Trước mốc vẫn dùng giá thường. Đến giờ chỉ áp nếu slot
                        trống, không bị chặn và giá còn hợp lệ.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">
                  Thủ công chỉ dành cho slot trống bắt đầu trong 24 giờ tới.
                  Dùng Tự động để đặt lịch sớm hơn.
                </p>
              )}
              <button className="full" disabled={busy || !history.data}>
                {mode === 'automatic'
                  ? 'Xem lại lịch tự động'
                  : 'Xem lại ưu đãi thủ công'}
              </button>
            </form>
          )}
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.type === 'create'
              ? 'Xác nhận ưu đãi cho slot?'
              : confirm.type === 'cancel'
                ? 'Hủy lịch ưu đãi này?'
                : 'Tắt ưu đãi này?'
          }
          confirm={
            confirm.type === 'create'
              ? mode === 'automatic'
                ? 'Lưu lịch tự động'
                : 'Tạo ưu đãi thủ công'
              : confirm.type === 'cancel'
                ? 'Xác nhận hủy lịch'
                : 'Xác nhận tắt'
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => void save()}
          busy={busy}
          error={error}
        >
          <p>
            {confirm.type === 'create'
              ? `${money(Number(price))} · ${mode === 'automatic' ? `Tự áp trước ${lead} giờ` : 'Áp dụng thủ công nếu đủ điều kiện'}.`
              : 'Cấu hình cũ sẽ không tự bật lại. Slot và booking đã xác nhận giữ nguyên.'}
          </p>
          <p>{interval(slot.start_at, slot.end_at)}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}

function OfferSlots({
  court,
  day,
  selected,
}: {
  court: Court
  day: string
  selected: string | null
}) {
  const slots = useResource<Slot[]>(
    `/api/owner/courts/${court.id}/slots?date=${day}`
  )
  const [params, setParams] = useSearchParams()
  const slot = slots.data?.find((row) => row.id === selected)
  return slots.loading ? (
    <Loading />
  ) : slots.error ? (
    <ErrorNotice message={slots.error} retry={slots.reload} />
  ) : (
    <>
      <Field label="Slot đang quản lý">
        <select
          value={selected || ''}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            next.set('slot', e.target.value)
            setParams(next)
          }}
        >
          <option value="">Chọn một slot</option>
          {slots.data?.map((row) => (
            <option key={row.id} value={row.id}>
              {interval(row.start_at, row.end_at)} ·{' '}
              {money(row.regular_price_vnd ?? row.price_vnd)}
            </option>
          ))}
        </select>
      </Field>
      {slot ? (
        <OfferManager key={slot.id} slot={slot} court={court} />
      ) : (
        <Empty title="Chọn slot để quản lý ưu đãi">
          <Link
            className="button secondary"
            to={`/owner/schedule?court=${court.id}&date=${day}`}
          >
            Mở lịch sân
          </Link>
        </Empty>
      )}
    </>
  )
}

export function OffersPage() {
  const [params, setParams] = useSearchParams()
  const courts = useResource<Court[]>('/api/owner/courts')
  const courtId = params.get('court') || courts.data?.[0]?.id
  const day = params.get('date') || localDay()
  const court = courts.data?.find((value) => value.id === courtId)
  return (
    <>
      <PageHeading title="Ưu đãi theo slot">
        Chọn slot, giá và thời điểm áp dụng. Không thay đổi tổng giá booking đã
        xác nhận.
      </PageHeading>
      {courts.loading ? (
        <Loading />
      ) : courts.error ? (
        <ErrorNotice message={courts.error} retry={courts.reload} />
      ) : !court ? (
        <Empty title="Chưa có sân được chọn">
          <Link className="button" to="/owner">
            Sân của tôi
          </Link>
        </Empty>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Sân">
              <select
                value={courtId}
                onChange={(e) =>
                  setParams({ court: e.target.value, date: day })
                }
              >
                {courts.data?.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ngày chơi">
              <input
                type="date"
                required
                value={day}
                onChange={(e) => {
                  if (e.target.value)
                    setParams({ court: court.id, date: e.target.value })
                }}
              />
            </Field>
          </div>
          <OfferSlots
            key={`${court.id}-${day}`}
            court={court}
            day={day}
            selected={params.get('slot')}
          />
        </>
      )}
    </>
  )
}

export function DealsPage() {
  const resource = useResource<{ court: Court; slot: Slot }[]>(
    '/api/deals',
    false
  )
  return (
    <>
      <PageHeading
        title="Ưu đãi giờ gần"
        action={
          <button className="ghost" onClick={resource.reload}>
            Làm mới
          </button>
        }
      >
        Giá ưu đãi hiện có cho từng slot. Xem lại giá trước khi xác nhận
        booking.
      </PageHeading>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <Empty title="Chưa có ưu đãi khả dụng">
          <Link className="button secondary" to="/">
            Tìm tất cả sân
          </Link>
        </Empty>
      ) : (
        <div className="record-list">
          {resource.data.map(({ court, slot }) => (
            <article className="panel" key={slot.id}>
              <Badge status="ACTIVE" />
              <h2>{court.name}</h2>
              <p className="muted">
                {court.address} · {court.area}
              </p>
              <p>{interval(slot.start_at, slot.end_at)}</p>
              <p>
                <del>{money(slot.regular_price_vnd ?? slot.price_vnd)}</del>{' '}
                <strong className="price">{money(slot.price_vnd)}</strong>
              </p>
              <Link
                className="button"
                to={`/courts/${court.id}/slots?date=${localDay(new Date(slot.start_at))}&slot=${slot.id}`}
              >
                Xem slot ưu đãi
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
