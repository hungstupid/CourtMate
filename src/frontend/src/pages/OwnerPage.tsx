import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  BackLink,
  Badge,
  ConfirmDialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
} from '../components/ui'
import type { FormSubmit } from '../components/ui'
import { apiRequest } from '../lib/api'
import { formValue, money } from '../lib/format'
import { useResource } from '../lib/use-resource'
import type { Court } from '../lib/types'

export function OwnerPage() {
  const resource = useResource<Court[]>('/api/owner/courts')
  const [court, setCourt] = useState<Court | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function deactivate() {
    if (!court) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/owner/courts/${court.id}`, {
        method: 'PATCH',
        body: { active: false },
      })
      setCourt(null)
      resource.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể ngừng nhận booking.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading title="Sân của tôi">
        Mở lịch, xem booking hoặc chỉnh thông tin ngay từ từng sân.
      </PageHeading>
      <Link className="button" to="/owner/courts/new">
        + Thêm sân
      </Link>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <Empty title="Bạn chưa có sân">
          Thêm sân đầu tiên rồi thiết lập giờ hoạt động và công bố slot.
        </Empty>
      ) : (
        <div className="record-list owner-list">
          {resource.data.map((c) => (
            <article className="panel" key={c.id}>
              <div className="section-heading">
                <h2>{c.name}</h2>
                <Badge status={c.active ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <p>
                {c.address} · {c.area} · {c.sport}
              </p>
              <p>
                Giá cơ bản {money(c.base_price_vnd)}/giờ · {c.max_players} người
                chơi đồng thời
              </p>
              <div className="actions">
                <Link className="button" to={`/owner/schedule?court=${c.id}`}>
                  Lịch sân
                </Link>
                <Link
                  className="button secondary"
                  to={`/owner/bookings?court=${c.id}`}
                >
                  Booking
                </Link>
                <Link
                  className="button secondary"
                  to={`/owner/courts/${c.id}/edit`}
                >
                  Thông tin sân
                </Link>
              </div>
              {c.active ? (
                <button
                  className="ghost"
                  onClick={() => {
                    setError('')
                    setCourt(c)
                  }}
                >
                  Ngừng nhận booking mới
                </button>
              ) : (
                <p className="muted">
                  Sân đã ngừng nhận booking mới. Bật lại trong Thông tin sân.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {court && (
        <ConfirmDialog
          title="Ngừng nhận booking mới?"
          confirm="Xác nhận ngừng nhận"
          busy={busy}
          error={error}
          onClose={() => setCourt(null)}
          onConfirm={() => void deactivate()}
        >
          <p>
            {court.name} sẽ không xuất hiện trong tìm sân và không nhận đặt mới.
            Booking, giá đã chấp nhận và lịch sử hiện có được giữ nguyên.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}

function CourtForm({ court }: { court?: Court }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = {
      name: formValue(data, 'name'),
      sport: formValue(data, 'sport'),
      address: formValue(data, 'address'),
      area: formValue(data, 'area'),
      description: formValue(data, 'description'),
      contact: formValue(data, 'contact'),
      base_price_vnd: Number(data.get('base_price_vnd')),
      max_players: Number(data.get('max_players')),
      photo_urls: formValue(data, 'photo_urls')
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean),
      active: data.get('active') === 'on',
    }
    setBusy(true)
    setError('')
    try {
      const saved = await apiRequest<Court>(
        court ? `/api/owner/courts/${court.id}` : '/api/owner/courts',
        { method: court ? 'PATCH' : 'POST', body }
      )
      navigate(court ? '/owner' : `/owner/schedule?court=${saved.id}`, {
        replace: true,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu thông tin sân.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="panel court-form" onSubmit={(e) => void submit(e)}>
      <div className="form-grid">
        <Field label="Tên sân">
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={court?.name}
          />
        </Field>
        <Field label="Môn thể thao">
          <input
            name="sport"
            required
            maxLength={80}
            defaultValue={court?.sport}
            list="court-sports"
          />
          <datalist id="court-sports">
            <option>Cầu lông</option>
            <option>Bóng đá</option>
            <option>Bóng rổ</option>
            <option>Tennis</option>
            <option>Pickleball</option>
          </datalist>
        </Field>
        <Field label="Địa chỉ đầy đủ">
          <input
            name="address"
            required
            maxLength={300}
            defaultValue={court?.address}
          />
        </Field>
        <Field label="Khu vực">
          <input
            name="area"
            required
            maxLength={120}
            defaultValue={court?.area}
          />
        </Field>
        <Field
          label="Giá cơ bản / giờ (₫)"
          hint="Giá slot do bạn công bố riêng khi thiết lập lịch."
        >
          <input
            name="base_price_vnd"
            type="number"
            min={1}
            step={1}
            max={Number.MAX_SAFE_INTEGER}
            required
            defaultValue={court?.base_price_vnd}
          />
        </Field>
        <Field
          label="Người chơi đồng thời"
          hint="Số nguyên từ 2 đến 30; phòng Open Play tối đa gấp đôi."
        >
          <input
            name="max_players"
            type="number"
            min={2}
            max={30}
            step={1}
            required
            defaultValue={court?.max_players ?? 8}
          />
        </Field>
      </div>
      <Field label="Mô tả sân">
        <textarea
          name="description"
          required
          maxLength={4000}
          rows={4}
          defaultValue={court?.description}
        />
      </Field>
      <Field label="Liên hệ sân">
        <input name="contact" maxLength={200} defaultValue={court?.contact} />
      </Field>
      <Field
        label="URL ảnh (mỗi dòng một URL)"
        hint="Tối đa 20 URL HTTP/HTTPS. Chỉ dùng ảnh bạn có quyền công bố."
      >
        <textarea
          name="photo_urls"
          rows={3}
          defaultValue={court?.photo_urls.join('\n')}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          name="active"
          defaultChecked={court?.active ?? true}
        />
        Đang nhận booking mới
      </label>
      {error && <ErrorNotice message={error} />}
      <div className="actions">
        <button disabled={busy}>
          {busy
            ? 'Đang lưu…'
            : court
              ? 'Lưu thông tin sân'
              : 'Tạo sân và thiết lập lịch'}
        </button>
        <Link className="button ghost" to="/owner">
          Hủy, chưa lưu
        </Link>
      </div>
    </form>
  )
}

export function CourtEditPage() {
  const { courtId } = useParams()
  const resource = useResource<Court>(
    courtId ? `/api/owner/courts/${courtId}` : null
  )
  return (
    <>
      <BackLink to="/owner">Sân của tôi</BackLink>
      <PageHeading title={courtId ? 'Chỉnh thông tin sân' : 'Thêm sân'}>
        Chỉ quản lý sân thuộc tài khoản của bạn.
      </PageHeading>
      {courtId && resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : (
        <CourtForm key={courtId || 'new'} court={resource.data || undefined} />
      )}
    </>
  )
}
