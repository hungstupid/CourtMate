import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router'
import { SessionProvider } from '../components/SessionProvider'
import { useSession } from '../lib/session-context'
import { ErrorNotice, Loading, Modal } from '../components/ui'
import { AuthPage } from '../pages/AuthPage'
import { CourtsPage } from '../pages/CourtsPage'
import { CourtPage, SlotsPage } from '../pages/CourtPage'
import { BookingsPage, BookingPage } from '../pages/BookingsPage'
import { RoomsPage, RoomPage } from '../pages/RoomsPage'
import { OwnerPage, CourtEditPage } from '../pages/OwnerPage'
import { SchedulePage } from '../pages/SchedulePage'
import { DealsPage, OffersPage } from '../pages/OffersPage'
import { ProfilePage } from '../pages/ProfilePage'
import { DevelopmentPage } from '../pages/DevelopmentPage'

function Protected({
  role,
  children,
}: {
  role?: 'player' | 'owner'
  children: ReactNode
}) {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'loading')
    return <Loading>Đang tải phiên đăng nhập…</Loading>
  if (session.status === 'error')
    return <ErrorNotice message={session.message} retry={session.refresh} />
  if (session.status !== 'ready')
    return (
      <Navigate
        to={session.status === 'unregistered' ? '/register' : '/login'}
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    )
  if (role && session.identity?.role !== role)
    return (
      <ErrorNotice
        message={
          role === 'owner'
            ? 'Chỉ tài khoản Chủ sân có quyền truy cập.'
            : 'Chức năng này dành cho tài khoản Người chơi.'
        }
      />
    )
  return children
}

function Shell() {
  const session = useSession()
  const location = useLocation()
  const [menu, setMenu] = useState(false)
  const main = useRef<HTMLElement>(null)
  const owner = session.status === 'ready' && session.identity?.role === 'owner'
  const links = owner
    ? [
        { to: '/owner', label: 'Sân của tôi', end: true },
        { to: '/owner/schedule', label: 'Lịch sân' },
        { to: '/owner/bookings', label: 'Booking' },
        { to: '/owner/offers', label: 'Ưu đãi' },
      ]
    : [
        { to: '/', label: 'Tìm sân', end: true },
        { to: '/rooms', label: 'Open Play' },
        { to: '/bookings', label: 'Lịch đặt' },
      ]
  useEffect(() => {
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [location.pathname])
  const navigation = (
    <>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={() => setMenu(false)}
        >
          {link.label}
        </NavLink>
      ))}
      {session.status === 'ready' ? (
        <NavLink
          className="account-link"
          to="/profile"
          onClick={() => setMenu(false)}
        >
          {owner ? 'Chủ sân' : 'Người chơi'} · Hồ sơ
        </NavLink>
      ) : (
        <NavLink
          className="account-link"
          to="/login"
          onClick={() => setMenu(false)}
        >
          Đăng nhập
        </NavLink>
      )}
    </>
  )
  return (
    <>
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung
      </a>
      <header className="site-header">
        <Link
          className="brand"
          to={owner ? '/owner' : '/'}
          aria-label="CourtMate · Trang chủ"
        >
          <span aria-hidden="true">◉</span> CourtMate
        </Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {navigation}
        </nav>
        <button
          className="ghost mobile-menu-button"
          aria-expanded={menu}
          onClick={() => setMenu(true)}
        >
          Menu
        </button>
      </header>
      {menu && (
        <Modal title="Menu CourtMate" onClose={() => setMenu(false)}>
          <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
            {navigation}
            {owner && (
              <Link to="/" onClick={() => setMenu(false)}>
                Khám phá sân
              </Link>
            )}
          </nav>
        </Modal>
      )}
      <main id="main-content" ref={main} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CourtsPage />} />
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
          <Route
            path="/courts/:courtId"
            element={<CourtPage key={location.pathname} />}
          />
          <Route
            path="/courts/:courtId/slots"
            element={<SlotsPage key={location.pathname} />}
          />
          <Route path="/deals" element={<DealsPage />} />
          <Route
            path="/bookings"
            element={
              <Protected role="player">
                <BookingsPage />
              </Protected>
            }
          />
          <Route
            path="/bookings/:bookingId"
            element={
              <Protected role="player">
                <BookingPage key={location.pathname} />
              </Protected>
            }
          />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route
            path="/rooms/:roomId"
            element={<RoomPage key={location.pathname} />}
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route path="/account" element={<Navigate to="/profile" replace />} />
          <Route
            path="/owner"
            element={
              <Protected role="owner">
                <OwnerPage />
              </Protected>
            }
          />
          <Route
            path="/owner/courts/new"
            element={
              <Protected role="owner">
                <CourtEditPage key="new" />
              </Protected>
            }
          />
          <Route
            path="/owner/courts/:courtId/edit"
            element={
              <Protected role="owner">
                <CourtEditPage key={location.pathname} />
              </Protected>
            }
          />
          <Route
            path="/owner/schedule"
            element={
              <Protected role="owner">
                <SchedulePage />
              </Protected>
            }
          />
          <Route
            path="/owner/bookings"
            element={
              <Protected role="owner">
                <BookingsPage owner />
              </Protected>
            }
          />
          <Route
            path="/owner/bookings/:bookingId"
            element={
              <Protected role="owner">
                <BookingPage key={location.pathname} owner />
              </Protected>
            }
          />
          <Route
            path="/owner/offers"
            element={
              <Protected role="owner">
                <OffersPage />
              </Protected>
            }
          />
          <Route path="/development" element={<DevelopmentPage />} />
          <Route
            path="*"
            element={
              <section>
                <h1>Không tìm thấy trang</h1>
                <Link className="button" to="/">
                  Về CourtMate
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        CourtMate&nbsp; / &nbsp;Hẹn một trận, thêm niềm vui.
      </footer>
    </>
  )
}
export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </BrowserRouter>
  )
}
