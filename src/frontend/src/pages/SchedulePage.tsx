import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import type { FormSubmit } from '../components/ui'
import { apiRequest } from '../lib/api'
import { useDraftGuard } from '../lib/draft-context'
import {
  formValue,
  interval,
  localDay,
  localInput,
  minuteTime,
  money,
  timeLabel,
  toInstant,
} from '../lib/format'
import { useResource } from '../lib/use-resource'
import type { Booking, Court, Hours, Maintenance, Slot } from '../lib/types'

type Draft = {
  key: number
  start_at: string
  end_at: string
  price_vnd: number
}
const weekdays = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
]
function parseMinutes(value: string) {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}
function datetimeAt(day: string, minutes: number) {
  return localInput(
    new Date(
      new Date(`${day}T00:00:00+07:00`).getTime() + minutes * 60000
    ).toISOString()
  )
}

function HoursEditor({
  court,
  initial,
  onClose,
  onSave,
}: {
  court: Court
  initial: Hours[]
  onClose: () => void
  onSave: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const guard = useDraftGuard(busy)
  const [enabled, setEnabled] = useState(initial.map((row) => row.weekday))
  async function submit(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const windows = weekdays.flatMap((_, weekday) =>
      data.get(`day-${weekday}`)
        ? [
            {
              weekday,
              opens_minute: parseMinutes(formValue(data, `open-${weekday}`)),
              closes_minute: parseMinutes(formValue(data, `close-${weekday}`)),
            },
          ]
        : []
    )
    if (
      windows.some(
        (row) =>
          !Number.isFinite(row.opens_minute) ||
          !Number.isFinite(row.closes_minute) ||
          row.opens_minute >= row.closes_minute ||
          row.closes_minute > 1440
      )
    ) {
      setError('Giờ đóng phải sau giờ mở, muộn nhất 24:00.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/owner/courts/${court.id}/hours`, {
        method: 'PUT',
        body: { windows },
      })
      guard.markClean()
      onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu giờ hoạt động.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Giờ hoạt động của sân"
      onClose={() => {
        if (!busy) guard.protect(onClose)
      }}
    >
      <p className="muted">
        Giờ Việt Nam · HH:mm; có thể đóng lúc 24:00. Không thay đổi giờ làm mất
        hiệu lực booking đã xác nhận.
      </p>
      <form onChangeCapture={guard.markDirty} onSubmit={(e) => void submit(e)}>
        {weekdays.map((name, weekday) => {
          const row = initial.find((value) => value.weekday === weekday)
          return (
            <div className="hours-row" key={name}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name={`day-${weekday}`}
                  checked={enabled.includes(weekday)}
                  onChange={(event) =>
                    setEnabled((days) =>
                      event.target.checked
                        ? [...days, weekday]
                        : days.filter((day) => day !== weekday)
                    )
                  }
                />
                {name}
              </label>
              <Field label={`Mở cửa ${name}`}>
                <input
                  name={`open-${weekday}`}
                  disabled={!enabled.includes(weekday)}
                  pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
                  defaultValue={minuteTime(row?.opens_minute ?? 360)}
                  required
                />
              </Field>
              <Field label={`Đóng cửa ${name}`}>
                <input
                  name={`close-${weekday}`}
                  disabled={!enabled.includes(weekday)}
                  pattern="(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                  defaultValue={minuteTime(row?.closes_minute ?? 1320)}
                  required
                />
              </Field>
            </div>
          )
        })}
        {error && <ErrorNotice message={error} />}
        <div className="actions">
          <button disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu giờ hoạt động'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => guard.protect(onClose)}
          >
            Hủy, chưa lưu
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SlotEditor({
  court,
  day,
  slot,
  onClose,
  onSave,
}: {
  court: Court
  day: string
  slot?: Slot
  onClose: () => void
  onSave: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const guard = useDraftGuard(busy)
  async function submit(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const start = formValue(data, 'start')
    const end = formValue(data, 'end')
    if (end <= start || start.slice(0, 10) !== day) {
      setError('Kiểm tra ngày đang chọn; giờ kết thúc phải sau bắt đầu.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiRequest(
        slot
          ? `/api/owner/slots/${slot.id}`
          : `/api/owner/courts/${court.id}/slots`,
        {
          method: slot ? 'PATCH' : 'POST',
          body: {
            start_at: toInstant(start),
            end_at: toInstant(end),
            price_vnd: Number(data.get('price')),
            published: data.get('published') === 'on',
            blocked: data.get('blocked') === 'on',
          },
        }
      )
      guard.markClean()
      onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu slot.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={slot ? 'Sửa slot' : 'Thêm một slot'}
      onClose={() => {
        if (!busy) guard.protect(onClose)
      }}
    >
      <p>
        {court.name} · {day}
      </p>
      <form onChangeCapture={guard.markDirty} onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          <Field label="Bắt đầu">
            <input
              name="start"
              type="datetime-local"
              step={1800}
              defaultValue={slot ? localInput(slot.start_at) : `${day}T06:00`}
              required
            />
          </Field>
          <Field label="Kết thúc">
            <input
              name="end"
              type="datetime-local"
              step={1800}
              defaultValue={slot ? localInput(slot.end_at) : `${day}T07:00`}
              required
            />
          </Field>
        </div>
        <Field
          label="Giá cả slot (₫)"
          hint="Số nguyên dương; slot dài 60–240 phút, theo lưới 30 phút."
        >
          <input
            name="price"
            type="number"
            min={1}
            step={1}
            max={Number.MAX_SAFE_INTEGER}
            defaultValue={
              slot?.regular_price_vnd ?? slot?.price_vnd ?? court.base_price_vnd
            }
            required
          />
        </Field>
        <label className="checkbox">
          <input
            name="published"
            type="checkbox"
            defaultChecked={slot?.published ?? true}
          />
          Công bố cho Người chơi
        </label>
        <label className="checkbox">
          <input
            name="blocked"
            type="checkbox"
            defaultChecked={slot?.blocked ?? false}
          />
          Chặn nhận booking cho slot này
        </label>
        {error && <ErrorNotice message={error} />}
        <div className="actions">
          <button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu slot'}</button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => guard.protect(onClose)}
          >
            Hủy
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MaintenanceEditor({
  court,
  day,
  slots,
  onClose,
  onSave,
}: {
  court: Court
  day: string
  slots: Slot[]
  onClose: () => void
  onSave: () => void
}) {
  const [range, setRange] = useState<{ start: string; end: string } | null>(
    null
  )
  const [draft, setDraft] = useState({
    start: `${day}T10:00`,
    end: `${day}T12:00`,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const guard = useDraftGuard(busy)
  async function save() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/owner/courts/${court.id}/maintenance`, {
        method: 'POST',
        body: {
          start_at: toInstant(range!.start),
          end_at: toInstant(range!.end),
        },
      })
      guard.markClean()
      onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể thêm bảo trì.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={range ? 'Xem trước ảnh hưởng bảo trì' : 'Thêm bảo trì'}
      onClose={() => {
        if (!busy) guard.protect(onClose)
      }}
    >
      {!range ? (
        <form
          onChangeCapture={guard.markDirty}
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            const start = formValue(data, 'start')
            const end = formValue(data, 'end')
            if (end <= start) setError('Kết thúc phải sau bắt đầu.')
            else {
              setError('')
              guard.markDirty()
              setRange({ start, end })
            }
          }}
        >
          <Field label="Bắt đầu bảo trì">
            <input
              name="start"
              type="datetime-local"
              value={draft.start}
              onChange={(event) =>
                setDraft((old) => ({ ...old, start: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Kết thúc bảo trì">
            <input
              name="end"
              type="datetime-local"
              value={draft.end}
              onChange={(event) =>
                setDraft((old) => ({ ...old, end: event.target.value }))
              }
              required
            />
          </Field>
          {error && <ErrorNotice message={error} />}
          <button>Xem trước ảnh hưởng</button>
        </form>
      ) : (
        <>
          <p>
            {court.name} ·{' '}
            {interval(toInstant(range.start), toInstant(range.end))}
          </p>
          <p>Slot bị ảnh hưởng:</p>
          <ul>
            {slots
              .filter(
                (slot) =>
                  new Date(slot.start_at) < new Date(toInstant(range.end)) &&
                  new Date(slot.end_at) > new Date(toInstant(range.start))
              )
              .map((slot) => (
                <li key={slot.id}>
                  {interval(slot.start_at, slot.end_at)} ·{' '}
                  <Badge status={slot.status} />
                </li>
              ))}
          </ul>
          <p className="muted">
            Không thể tạo bảo trì giao với lượt đặt đã xác nhận. Lịch cũ được
            giữ nguyên nếu thao tác không thành công.
          </p>
          {error && <ErrorNotice message={error} />}
          <div className="actions">
            <button disabled={busy} onClick={() => void save()}>
              {busy ? 'Đang lưu…' : 'Xác nhận bảo trì'}
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => setRange(null)}
            >
              Chỉnh khoảng thời gian
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function BatchEditor({
  court,
  day,
  onClose,
  onSave,
}: {
  court: Court
  day: string
  onClose: () => void
  onSave: () => void
}) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const guard = useDraftGuard(busy)
  const [config, setConfig] = useState({
    start: '06:00',
    end: '14:00',
    duration: '60',
    price: String(court.base_price_vnd),
  })
  function generate(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const start = parseMinutes(formValue(data, 'start'))
    const end = parseMinutes(formValue(data, 'end'))
    const duration = Number(data.get('duration'))
    const price = Number(data.get('price'))
    if (
      end <= start ||
      start % 30 ||
      end % 30 ||
      duration < 60 ||
      duration > 240 ||
      duration % 30
    ) {
      setError(
        'Dùng mốc 30 phút, kết thúc sau bắt đầu, mỗi slot dài 60–240 phút.'
      )
      return
    }
    const rows: Draft[] = []
    for (let minute = start; minute + duration <= end; minute += duration)
      rows.push({
        key: minute,
        start_at: datetimeAt(day, minute),
        end_at: datetimeAt(day, minute + duration),
        price_vnd: price,
      })
    if (!rows.length) {
      setError('Khoảng đã chọn không đủ một slot.')
      return
    }
    setError('')
    guard.markDirty()
    setDrafts(rows)
  }
  function update(key: number, patch: Partial<Draft>) {
    setDrafts((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }
  async function publish() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/owner/courts/${court.id}/slots/batch`, {
        method: 'POST',
        body: {
          slots: drafts.map((row) => ({
            start_at: toInstant(row.start_at),
            end_at: toInstant(row.end_at),
            price_vnd: row.price_vnd,
          })),
        },
      })
      guard.markClean()
      onSave()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Không thể công bố. Toàn bộ lịch trước đó được giữ nguyên.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel batch-editor">
      <PageHeading
        title={preview ? 'Xem trước khi công bố' : 'Tạo nhanh nhiều slot'}
      >
        {court.name} · {day}. Chưa nhận booking cho các slot nháp.
      </PageHeading>
      {!preview && (
        <form
          onChangeCapture={guard.markDirty}
          className="form-grid"
          onSubmit={generate}
        >
          <Field label="Từ giờ">
            <input
              name="start"
              type="time"
              step={1800}
              value={config.start}
              onChange={(event) =>
                setConfig((old) => ({ ...old, start: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Đến giờ" hint="HH:mm, muộn nhất 24:00">
            <input
              name="end"
              pattern="(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
              value={config.end}
              onChange={(event) =>
                setConfig((old) => ({ ...old, end: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Độ dài mỗi slot (phút)">
            <input
              name="duration"
              type="number"
              min={60}
              max={240}
              step={30}
              value={config.duration}
              onChange={(event) =>
                setConfig((old) => ({ ...old, duration: event.target.value }))
              }
              required
            />
          </Field>
          <Field label="Giá cả slot (₫)">
            <input
              name="price"
              type="number"
              min={1}
              step={1}
              max={Number.MAX_SAFE_INTEGER}
              value={config.price}
              onChange={(event) =>
                setConfig((old) => ({ ...old, price: event.target.value }))
              }
              required
            />
          </Field>
          <button>Tạo / thay danh sách nháp</button>
        </form>
      )}
      {!!drafts.length && (
        <form
          onChangeCapture={guard.markDirty}
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            setPreview(true)
          }}
        >
          <h2>{drafts.length} slot nháp</h2>
          <p className="muted">
            Giờ Việt Nam · UTC+7. Sửa/thêm/xóa dòng trước khi xem lại; Hủy không
            công bố dữ liệu.
          </p>
          <div className="draft-list">
            {drafts.map((row, index) => (
              <div className="draft-row" key={row.key}>
                {preview ? (
                  <>
                    <span>
                      {interval(toInstant(row.start_at), toInstant(row.end_at))}
                    </span>
                    <strong>{money(row.price_vnd)}</strong>
                  </>
                ) : (
                  <>
                    <Field label={`Bắt đầu dòng ${index + 1}`}>
                      <input
                        type="datetime-local"
                        step={1800}
                        value={row.start_at}
                        required
                        onChange={(e) =>
                          update(row.key, { start_at: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={`Kết thúc dòng ${index + 1}`}>
                      <input
                        type="datetime-local"
                        step={1800}
                        value={row.end_at}
                        required
                        onChange={(e) =>
                          update(row.key, { end_at: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={`Giá dòng ${index + 1}`}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        max={Number.MAX_SAFE_INTEGER}
                        required
                        value={row.price_vnd || ''}
                        onChange={(e) =>
                          update(row.key, { price_vnd: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() =>
                        setDrafts((rows) =>
                          rows.filter((value) => value.key !== row.key)
                        )
                      }
                    >
                      Xóa dòng {index + 1}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {!preview && (
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const last = drafts.at(-1)!
                  const key = Math.max(...drafts.map((row) => row.key)) + 1
                  setDrafts([
                    ...drafts,
                    {
                      key,
                      start_at: last.end_at,
                      end_at: localInput(
                        new Date(
                          new Date(toInstant(last.end_at)).getTime() + 3600000
                        ).toISOString()
                      ),
                      price_vnd: last.price_vnd,
                    },
                  ])
                }}
              >
                + Thêm dòng nháp
              </button>
              <button>Xem trước toàn bộ</button>
            </div>
          )}
        </form>
      )}
      {error && <ErrorNotice message={error} />}
      {preview && (
        <div className="actions">
          <button
            disabled={busy || !drafts.length}
            onClick={() => void publish()}
          >
            {busy ? 'Đang công bố…' : `Xác nhận công bố ${drafts.length} slot`}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setPreview(false)}
          >
            Quay lại chỉnh nháp
          </button>
        </div>
      )}
      <button
        className="ghost"
        disabled={busy}
        onClick={() => guard.protect(onClose)}
      >
        Hủy nháp, không công bố
      </button>
    </section>
  )
}

function DailySchedule({ court, day }: { court: Court; day: string }) {
  const slots = useResource<Slot[]>(
    `/api/owner/courts/${court.id}/slots?date=${day}`
  )
  const hours = useResource<Hours[]>(`/api/owner/courts/${court.id}/hours`)
  const maintenance = useResource<Maintenance[]>(
    `/api/owner/courts/${court.id}/maintenance?date=${day}`
  )
  const bookings = useResource<Booking[]>('/api/owner/bookings')
  const [editor, setEditor] = useState<
    'hours' | 'slot' | 'maintenance' | 'batch' | null
  >(null)
  const [editingSlot, setEditingSlot] = useState<Slot | undefined>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const guard = useDraftGuard(busy)
  function refresh() {
    setEditor(null)
    slots.reload()
    hours.reload()
    maintenance.reload()
    bookings.reload()
  }
  const weekday = (new Date(`${day}T12:00:00+07:00`).getUTCDay() + 6) % 7
  const window = hours.data?.find((row) => row.weekday === weekday)
  const gaps: { start_at: string; end_at: string }[] = []
  if (window) {
    let cursor = new Date(
      toInstant(datetimeAt(day, window.opens_minute))
    ).getTime()
    const end = new Date(
      toInstant(datetimeAt(day, window.closes_minute))
    ).getTime()
    const occupied = [
      ...(slots.data || []).filter((slot) => slot.published),
      ...(maintenance.data || []),
    ].sort((a, b) => a.start_at.localeCompare(b.start_at))
    for (const row of occupied) {
      const start = Math.min(end, new Date(row.start_at).getTime())
      if (start > cursor)
        gaps.push({
          start_at: new Date(cursor).toISOString(),
          end_at: new Date(start).toISOString(),
        })
      cursor = Math.max(cursor, new Date(row.end_at).getTime())
    }
    if (cursor < end)
      gaps.push({
        start_at: new Date(cursor).toISOString(),
        end_at: new Date(end).toISOString(),
      })
  }
  async function removeMaintenance(id: string) {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/owner/maintenance/${id}`, { method: 'DELETE' })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể gỡ bảo trì.')
    } finally {
      setBusy(false)
    }
  }
  const rows: (
    (Slot & { kind: 'slot' }) | (Maintenance & { kind: 'maintenance' | 'gap' })
  )[] = [
    ...(slots.data || []).map((slot) => ({ ...slot, kind: 'slot' as const })),
    ...(maintenance.data || []).map((row) => ({
      ...row,
      kind: 'maintenance' as const,
    })),
    ...gaps.map((row) => ({
      ...row,
      id: `gap-${row.start_at}`,
      kind: 'gap' as const,
    })),
  ].sort((a, b) => a.start_at.localeCompare(b.start_at))
  return (
    <>
      <div className="actions schedule-actions">
        <button
          onClick={() => {
            setEditingSlot(undefined)
            guard.protect(() => setEditor('slot'))
          }}
        >
          + Thêm slot
        </button>
        <button
          className="secondary"
          onClick={() => guard.protect(() => setEditor('batch'))}
        >
          Tạo nhanh nhiều slot
        </button>
        <button
          className="secondary"
          onClick={() => guard.protect(() => setEditor('maintenance'))}
        >
          Thêm bảo trì
        </button>
        <button
          className="ghost"
          disabled={!hours.data}
          onClick={() => guard.protect(() => setEditor('hours'))}
        >
          Giờ hoạt động
        </button>
        <button className="ghost" onClick={() => guard.protect(refresh)}>
          Làm mới
        </button>
      </div>
      {error && <ErrorNotice message={error} />}
      {editor === 'batch' && (
        <BatchEditor
          court={court}
          day={day}
          onClose={() => setEditor(null)}
          onSave={refresh}
        />
      )}
      {slots.loading || hours.loading || maintenance.loading ? (
        <Loading />
      ) : slots.error || hours.error || maintenance.error ? (
        <ErrorNotice
          message={slots.error || hours.error || maintenance.error}
          retry={refresh}
        />
      ) : (
        <>
          <p className="muted">
            {window
              ? `Giờ hoạt động ${minuteTime(window.opens_minute)}–${minuteTime(window.closes_minute)}`
              : 'Sân chưa có giờ hoạt động cho ngày này.'}{' '}
            · Lịch của {court.name}. Nháp chưa lưu được giữ cho đến khi bạn xác
            nhận bỏ thay đổi.
          </p>
          {!rows.length ? (
            <Empty title="Chưa công bố slot">
              Thiết lập giờ hoạt động rồi thêm slot hoặc tạo nhanh nhiều slot.
            </Empty>
          ) : (
            <div
              className="daily-calendar"
              role="list"
              aria-label="Lịch sân cả ngày"
            >
              {rows.map((row) => {
                const slot = row.kind === 'slot' ? row : null
                const booking =
                  slot &&
                  bookings.data?.find(
                    (booking) =>
                      booking.status === 'CONFIRMED' &&
                      booking.slots.some((value) => value.slot_id === slot.id)
                  )
                return (
                  <div
                    className={`calendar-row ${row.kind}`}
                    role="listitem"
                    key={`${row.kind}-${row.id}`}
                  >
                    <strong>
                      {timeLabel(row.start_at)}–{timeLabel(row.end_at)}
                    </strong>
                    <Badge
                      status={
                        slot
                          ? !slot.published
                            ? 'UNPUBLISHED'
                            : slot.status
                          : row.kind === 'gap'
                            ? 'UNPUBLISHED'
                            : 'BLOCKED'
                      }
                    />
                    <span>{slot ? money(slot.price_vnd) : '—'}</span>
                    <span className="muted">
                      {booking
                        ? 'Booking đã xác nhận · Khóa giờ và giá'
                        : row.kind === 'maintenance'
                          ? 'Bảo trì · Không nhận booking'
                          : row.kind === 'gap'
                            ? 'Chưa công bố'
                            : 'Slot của sân'}
                    </span>
                    <div className="actions">
                      {booking ? (
                        <Link
                          className="button ghost"
                          to={`/owner/bookings/${booking.id}`}
                        >
                          Xem booking
                        </Link>
                      ) : slot && slot.status !== 'BOOKED' ? (
                        <>
                          <button
                            className="ghost"
                            onClick={() => {
                              setEditingSlot(slot)
                              guard.protect(() => setEditor('slot'))
                            }}
                          >
                            Sửa
                          </button>
                          <Link
                            className="button secondary"
                            to={`/owner/offers?court=${court.id}&date=${day}&slot=${slot.id}`}
                          >
                            Ưu đãi
                          </Link>
                        </>
                      ) : row.kind === 'maintenance' ? (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() => void removeMaintenance(row.id)}
                        >
                          Gỡ bảo trì
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      {editor === 'hours' && hours.data && (
        <HoursEditor
          court={court}
          initial={hours.data}
          onClose={() => setEditor(null)}
          onSave={refresh}
        />
      )}
      {editor === 'slot' && (
        <SlotEditor
          court={court}
          day={day}
          slot={editingSlot}
          onClose={() => setEditor(null)}
          onSave={refresh}
        />
      )}
      {editor === 'maintenance' && (
        <MaintenanceEditor
          court={court}
          day={day}
          slots={slots.data || []}
          onClose={() => setEditor(null)}
          onSave={refresh}
        />
      )}
    </>
  )
}

export function SchedulePage() {
  const [params, setParams] = useSearchParams()
  const courts = useResource<Court[]>('/api/owner/courts')
  const courtId = params.get('court') || courts.data?.[0]?.id
  const day = params.get('date') || localDay()
  const court = courts.data?.find((value) => value.id === courtId)
  function select(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next)
  }
  return (
    <>
      <PageHeading title="Lịch sân">
        Chọn sân và ngày để quản lý toàn bộ lịch. Giờ Việt Nam · UTC+7.
      </PageHeading>
      {courts.loading ? (
        <Loading />
      ) : courts.error ? (
        <ErrorNotice message={courts.error} retry={courts.reload} />
      ) : !courts.data?.length ? (
        <Empty title="Bạn chưa có sân">
          <Link className="button" to="/owner/courts/new">
            + Thêm sân
          </Link>
        </Empty>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Sân đang quản lý">
              <select
                value={courtId}
                onChange={(e) => select('court', e.target.value)}
              >
                {courts.data.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                    {!court.active ? ' · Ngừng nhận mới' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ngày xem lịch">
              <input
                type="date"
                required
                value={day}
                onChange={(e) => {
                  if (e.target.value) select('date', e.target.value)
                }}
              />
            </Field>
          </div>
          {court ? (
            <DailySchedule key={`${court.id}-${day}`} court={court} day={day} />
          ) : (
            <ErrorNotice message="Sân không thuộc tài khoản của bạn." />
          )}
        </>
      )}
    </>
  )
}
