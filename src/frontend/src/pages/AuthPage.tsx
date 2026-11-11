import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@firebase/auth'
import { Link, Navigate, useLocation } from 'react-router'
import { apiRequest } from '../lib/api'
import { firebaseAuth } from '../lib/firebase'
import { useSession } from '../lib/session-context'
import { ErrorNotice, Field, Loading, PageHeading } from '../components/ui'
import type { FormSubmit } from '../components/ui'

export function AuthPage({ register = false }: { register?: boolean }) {
  const session = useSession()
  const location = useLocation()
  const [role, setRole] = useState<'player' | 'owner'>('player')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const from = (location.state as { from?: string } | null)?.from
  const destination =
    from?.startsWith('/') &&
    !from.startsWith('//') &&
    !['/login', '/register'].includes(from.split('?')[0])
      ? from
      : session.identity?.role === 'owner'
        ? '/owner'
        : '/'
  if (session.status === 'ready') return <Navigate to={destination} replace />
  async function submit(event: FormSubmit) {
    event.preventDefault()
    if (!firebaseAuth) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      if (session.status === 'unregistered') {
        await apiRequest('/api/register', { method: 'POST', body: { role } })
      } else if (register) {
        await createUserWithEmailAndPassword(
          firebaseAuth,
          String(data.get('email')),
          String(data.get('password'))
        )
        await apiRequest('/api/register', { method: 'POST', body: { role } })
      } else {
        await signInWithEmailAndPassword(
          firebaseAuth,
          String(data.get('email')),
          String(data.get('password'))
        )
      }
      session.refresh()
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : ''
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Email đã được đăng ký. Hãy đăng nhập.',
        'auth/weak-password': 'Chọn mật khẩu mạnh hơn, ít nhất 6 ký tự.',
        'auth/invalid-email': 'Nhập email hợp lệ.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
        'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
        'auth/too-many-requests':
          'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.',
        'auth/network-request-failed':
          'Không thể kết nối. Kiểm tra mạng và thử lại.',
      }
      setError(
        messages[code] ||
          (error instanceof Error && error.name === 'ApiError'
            ? error.message
            : 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra và thử lại.')
      )
    } finally {
      setBusy(false)
    }
  }
  const completing = session.status === 'unregistered'
  const isRegister = register || completing
  return (
    <>
      {isRegister && (
        <PageHeading
          eyebrow="BẮT ĐẦU CÙNG COURTMATE"
          title={
            completing
              ? 'Hoàn tất tài khoản'
              : isRegister
                ? 'Tạo tài khoản'
                : 'Đăng nhập'
          }
        >
          {isRegister
            ? 'Chọn Người chơi hoặc Chủ sân khi tạo tài khoản.'
            : 'Chào mừng bạn trở lại CourtMate.'}
        </PageHeading>
      )}
      <div className={isRegister ? 'auth-layout' : 'auth-layout auth-login'}>
        {!isRegister && (
          <aside className="auth-aside">
            <p className="auth-display">
              Một tài khoản.
              <br />
              Nhiều trận hay.
            </p>
            <p>
              Đặt sân rõ ràng. Quản lý nhẹ nhàng.
              <br />
              Kết nối người chơi qua Open Play.
            </p>
            <img
              src="/images/login-court.svg"
              width="480"
              height="240"
              alt=""
            />
          </aside>
        )}
        <section className="auth-card">
          <Link className="back-link" to="/">
            ← Explore courts
          </Link>
          {!isRegister && (
            <p className="eyebrow login-kicker">CHÀO MỪNG TRỞ LẠI</p>
          )}
          {!isRegister && <h1 className="login-title">Đăng nhập CourtMate</h1>}
          <p className="muted">
            {isRegister
              ? 'Chọn cách sử dụng CourtMate. Vai trò được lưu một lần khi đăng ký.'
              : 'Dùng email và mật khẩu đã đăng ký.'}
          </p>
          {!firebaseAuth ? (
            <ErrorNotice message="Đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau." />
          ) : session.status === 'loading' ? (
            <Loading>Đang tải phiên đăng nhập…</Loading>
          ) : (
            <form aria-busy={busy} onSubmit={(e) => void submit(e)}>
              {!completing && (
                <>
                  <Field label="Email">
                    <input
                      disabled={busy}
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={320}
                    />
                  </Field>
                  <Field
                    label="Mật khẩu"
                    hint={
                      isRegister
                        ? 'Ít nhất 6 ký tự. Có thể dùng trình quản lý mật khẩu.'
                        : undefined
                    }
                  >
                    <input
                      disabled={busy}
                      name="password"
                      type="password"
                      autoComplete={
                        isRegister ? 'new-password' : 'current-password'
                      }
                      minLength={isRegister ? 6 : undefined}
                      required
                    />
                  </Field>
                </>
              )}
              {completing && (
                <p>
                  Bạn đang đăng nhập với {session.user?.email}. Chọn vai trò ban
                  đầu để hoàn tất đăng ký.
                </p>
              )}
              {isRegister && (
                <fieldset className="role-choice">
                  <legend>Vai trò tài khoản</legend>
                  <label>
                    <input
                      disabled={busy}
                      type="radio"
                      name="role"
                      value="player"
                      checked={role === 'player'}
                      onChange={() => setRole('player')}
                    />
                    <span>
                      <strong>Người chơi</strong>
                      <small>Tìm sân và tham gia trận</small>
                    </span>
                  </label>
                  <label>
                    <input
                      disabled={busy}
                      type="radio"
                      name="role"
                      value="owner"
                      checked={role === 'owner'}
                      onChange={() => setRole('owner')}
                    />
                    <span>
                      <strong>Chủ sân</strong>
                      <small>Quản lý sân và lịch</small>
                    </span>
                  </label>
                </fieldset>
              )}
              {(error || session.message) && (
                <ErrorNotice message={error || session.message} />
              )}
              {session.status === 'error' && (
                <button
                  className="secondary"
                  type="button"
                  onClick={session.refresh}
                >
                  Thử lại phiên đăng nhập
                </button>
              )}
              <button className="full" disabled={busy}>
                {busy
                  ? 'Đang kết nối…'
                  : completing
                    ? 'Hoàn tất đăng ký'
                    : isRegister
                      ? 'Tạo tài khoản'
                      : 'Đăng nhập'}
              </button>
            </form>
          )}
          {completing ? (
            <button
              className="text-button"
              onClick={() => {
                if (firebaseAuth) void signOut(firebaseAuth)
              }}
            >
              Dùng tài khoản khác
            </button>
          ) : (
            <p className="auth-switch">
              {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
              <Link
                to={isRegister ? '/login' : '/register'}
                state={location.state}
              >
                {isRegister ? 'Đăng nhập' : 'Tạo tài khoản'}
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  )
}
