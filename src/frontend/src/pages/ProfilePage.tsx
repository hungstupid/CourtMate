import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { useDraftGuard } from '../lib/draft-context'
import { useSession } from '../lib/session-context'
import { useResource } from '../lib/use-resource'
import type { Profile } from '../lib/types'
import { ErrorNotice, Field, Loading, PageHeading } from '../components/ui'
import type { FormSubmit } from '../components/ui'

function ProfileForm({ profile }: { profile: Profile }) {
  const session = useSession()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const guard = useDraftGuard(busy)
  async function submit(event: FormSubmit) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiRequest('/api/profile', {
        method: 'PATCH',
        body: {
          display_name: String(data.get('display_name')).trim(),
          contact_preferences: String(data.get('contact_preferences')).trim(),
        },
      })
      setMessage('Hồ sơ đã lưu thành công.')
      guard.markClean()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu hồ sơ.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      aria-busy={busy}
      onChangeCapture={() => {
        guard.markDirty()
        setMessage('')
      }}
      className="panel profile-form"
      onSubmit={(e) => void submit(e)}
    >
      <Field label="Tên hiển thị">
        <input
          disabled={busy}
          name="display_name"
          maxLength={100}
          defaultValue={profile.display_name}
        />
      </Field>
      <Field label="Tùy chọn liên hệ">
        <input
          disabled={busy}
          name="contact_preferences"
          maxLength={500}
          defaultValue={profile.contact_preferences}
        />
      </Field>
      <Field label="Email" hint="Được quản lý bởi dịch vụ xác thực.">
        <input
          type="email"
          value={profile.registration_email || session.user?.email || ''}
          readOnly
        />
      </Field>
      <Field label="Vai trò" hint="Không thể đổi vai trò qua hồ sơ.">
        <input
          readOnly
          value={
            profile.role === 'owner'
              ? 'Chủ sân (Court Owner)'
              : 'Người chơi (Player)'
          }
        />
      </Field>
      {error && <ErrorNotice message={error} />}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      <div className="actions">
        <button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        <button
          type="button"
          className="ghost"
          onClick={() => guard.protect(() => void session.logOut())}
        >
          Đăng xuất
        </button>
      </div>
    </form>
  )
}
export function ProfilePage() {
  const profile = useResource<Profile>('/api/profile')
  return (
    <>
      <PageHeading eyebrow="TÀI KHOẢN CỦA BẠN" title="Thông tin cá nhân">
        Chỉnh sửa thông tin cơ bản. Danh tính và vai trò được bảo vệ.
      </PageHeading>
      {profile.loading ? (
        <Loading />
      ) : profile.error ? (
        <ErrorNotice message={profile.error} retry={profile.reload} />
      ) : (
        profile.data && <ProfileForm profile={profile.data} />
      )}
    </>
  )
}
