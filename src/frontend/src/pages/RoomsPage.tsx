import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
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
import { apiRequest } from '../lib/api'
import { interval, money } from '../lib/format'
import { useResource } from '../lib/use-resource'
import { useSession } from '../lib/session-context'
import type { Room } from '../lib/types'

export function RoomsPage() {
  const [params, setParams] = useSearchParams()
  const [location, setLocation] = useState(params.get('location') || '')
  useEffect(() => {
    const restore = () =>
      setLocation(
        new URLSearchParams(window.location.search).get('location') || ''
      )
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const resource = useResource<Room[]>(`/api/rooms?${params}`, false)
  return (
    <>
      <PageHeading title="Tìm một trận gần bạn">
        Tìm phòng theo địa chỉ hoặc khu vực của sân.
      </PageHeading>
      <form
        className="panel search-form"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(location.trim() ? { location: location.trim() } : {})
        }}
      >
        <Field
          label="Địa chỉ hoặc khu vực"
          hint="Tìm theo địa điểm của sân gắn với phòng."
        >
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={300}
            placeholder="Nhập địa chỉ hoặc khu vực"
          />
        </Field>
        <div className="actions">
          <button>Tìm phòng</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setLocation('')
              setParams({})
            }}
          >
            Xóa địa điểm
          </button>
        </div>
      </form>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <Empty title="Không có phòng phù hợp">
          <p>Thử khu vực khác, hoặc tạo phòng từ booking của bạn.</p>
          <Link className="button secondary" to="/bookings">
            Lịch đặt của tôi
          </Link>
        </Empty>
      ) : (
        <>
          <p>{resource.data.length} phòng phù hợp</p>
          <div className="record-list">
            {resource.data.map((room) => (
              <article className="panel" key={room.id}>
                <div className="section-heading">
                  <h2>{room.court_name}</h2>
                  <Badge status={room.status} />
                </div>
                <p className="muted">
                  {room.address} · {room.area} · {room.sport}
                </p>
                <p>{interval(room.start_at, room.end_at)}</p>
                <p>
                  {room.member_count} / {room.capacity} người ·{' '}
                  {room.remaining_places} chỗ trống
                </p>
                <strong className="price">
                  {room.estimated_share_vnd === null
                    ? 'Ước tính không khả dụng'
                    : `Ước tính ${money(room.estimated_share_vnd)}/người`}
                </strong>
                <div className="actions">
                  <Link
                    className="button"
                    to={`/rooms/${room.id}`}
                    state={{ search: `/rooms?${params}` }}
                  >
                    Xem phòng
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export function RoomPage() {
  const { roomId } = useParams()
  const session = useSession()
  const isPlayer =
    session.status === 'ready' && session.identity?.role === 'player'
  const resource = useResource<Room>(
    isPlayer ? `/api/rooms/${roomId}/membership` : `/api/rooms/${roomId}`,
    isPlayer
  )
  const [action, setAction] = useState<'join' | 'leave' | 'close' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const back =
    (location.state as { search?: string } | null)?.search || '/rooms'
  async function act() {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/rooms/${roomId}/${action}`, { method: 'POST' })
      setAction(null)
      resource.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật phòng.')
      resource.reload()
    } finally {
      setBusy(false)
    }
  }
  if (resource.loading) return <Loading />
  if (resource.error)
    return <ErrorNotice message={resource.error} retry={resource.reload} />
  if (!resource.data) return null
  const room = resource.data
  const closed = room.status === 'CLOSED'
  const closeReasons: Record<string, string> = {
    ORGANIZER_CLOSED:
      'Người tổ chức đã đóng phòng. Booking vẫn được giữ nguyên.',
    BOOKING_CANCELLED: 'Booking liên kết đã hủy.',
    PLAY_STARTED: 'Trận đã bắt đầu.',
  }
  return (
    <>
      <BackLink to={back}>Danh sách phòng</BackLink>
      <PageHeading
        title={`${room.is_organizer ? 'Phòng của bạn' : 'Open Play'} · ${room.court_name}`}
        action={
          <button className="ghost" onClick={resource.reload}>
            Làm mới
          </button>
        }
      >
        {interval(room.start_at, room.end_at)}
      </PageHeading>
      <div className="section-heading">
        <Badge status={room.status} />
        <p>
          {room.member_count} / {room.capacity} thành viên
        </p>
      </div>
      <p className="muted">
        {room.address} · {room.area} · {room.sport}
      </p>
      {closed && (
        <div className="notice warning">
          <strong>Phòng đã đóng</strong>
          <p>
            {closeReasons[room.closed_reason || ''] ||
              'Phòng không còn nhận thay đổi thành viên.'}{' '}
            Không thể tham gia, rời hoặc mở lại phòng.
          </p>
        </div>
      )}
      <section className="notice success">
        <h2>Đội hình hiện tại</h2>
        <ul className="member-list">
          {room.members.map((member, index) => (
            <li key={index}>
              {member.display_name || `Người chơi ${index + 1}`} ·{' '}
              {member.is_organizer ? 'Người tổ chức' : 'Thành viên'}
              {member.is_self ? ' · Bạn' : ''}
            </li>
          ))}
        </ul>
      </section>
      <section className="notice success">
        <h2>
          {room.estimated_share_vnd === null
            ? 'Ước tính không khả dụng'
            : `Ước tính ${money(room.estimated_share_vnd)}/người`}
        </h2>
        <p>
          Chi phí booking chia cho {room.member_count} thành viên, gồm người tổ
          chức. Đây chỉ là chi phí tham khảo, không thu tiền.
        </p>
      </section>
      <div className="actions">
        {!isPlayer ? (
          session.identity?.role === 'owner' ? (
            <p>Tham gia phòng dành cho tài khoản Người chơi.</p>
          ) : (
            <Link
              className="button"
              to="/login"
              state={{ from: `/rooms/${roomId}` }}
            >
              Đăng nhập để tham gia
            </Link>
          )
        ) : room.is_organizer ? (
          <button
            className="danger"
            disabled={closed}
            onClick={() => {
              setError('')
              setAction('close')
            }}
          >
            Đóng phòng
          </button>
        ) : room.is_member ? (
          <button
            className="ghost"
            disabled={closed}
            onClick={() => {
              setError('')
              setAction('leave')
            }}
          >
            Rời phòng
          </button>
        ) : (
          <button
            disabled={room.status !== 'OPEN'}
            onClick={() => {
              setError('')
              setAction('join')
            }}
          >
            {closed
              ? 'Phòng đã đóng'
              : room.status === 'FULL'
                ? 'Phòng đã đầy'
                : 'Tham gia phòng'}
          </button>
        )}
        {room.is_organizer && (
          <Link
            className="button secondary"
            to={`/bookings/${room.booking_id}`}
          >
            Xem lịch sân
          </Link>
        )}
        <Link className="button ghost" to={`/courts/${room.court_id}`}>
          Thông tin sân
        </Link>
      </div>
      {action && (
        <ConfirmDialog
          title={
            action === 'close'
              ? 'Đóng phòng này?'
              : action === 'leave'
                ? 'Rời phòng này?'
                : 'Tham gia phòng?'
          }
          confirm={
            action === 'close'
              ? 'Xác nhận đóng phòng'
              : action === 'leave'
                ? 'Xác nhận rời phòng'
                : 'Xác nhận tham gia'
          }
          danger={action === 'close'}
          onClose={() => setAction(null)}
          onConfirm={() => void act()}
          busy={busy}
          error={error}
        >
          <p>
            {action === 'close'
              ? 'Phòng sẽ đóng vĩnh viễn, giữ lịch sử thành viên và chặn Join/Leave. Booking, slot và tổng tiền vẫn giữ nguyên.'
              : action === 'leave'
                ? 'Chỗ của bạn sẽ được mở lại khi phòng còn đủ điều kiện. Booking của người tổ chức không thay đổi.'
                : `${room.court_name} · ${interval(room.start_at, room.end_at)}. Ước tính thay đổi theo số người thực tế.`}
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
