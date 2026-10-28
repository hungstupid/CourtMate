import { DevelopmentPage } from '../pages/DevelopmentPage'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { SessionProvider } from '../components/SessionProvider'
import { useSession } from '../lib/session-context'
import { IdentitySmoke } from '../components/IdentitySmoke'

function Protected({ owner = false, children }: { owner?: boolean; children: ReactNode }) {
  const session = useSession()
  if (session.status === 'loading') return <p role="status">Loading session…</p>
  if (session.status !== 'ready') return <IdentitySmoke />
  if (owner && session.identity?.role !== 'owner') return <p role="alert">Court Owner access is required.</p>
  return children
}

function RouteFoundation({ owner = false }: { owner?: boolean }) {
  return <main><h1>{owner ? 'Court Owner foundation' : 'Account foundation'}</h1>
    <p>This route provides session and access foundations. Business features are pending PA5.</p>
    <IdentitySmoke />
  </main>
}

export function App() {
  return <BrowserRouter><SessionProvider>
    <nav aria-label="Main navigation"><Link to="/">CourtMate</Link> · <Link to="/account">Account</Link> · <Link to="/owner">Court Owner</Link></nav>
    <Routes>
      <Route path="/" element={<DevelopmentPage />} />
      <Route path="/account" element={<Protected><RouteFoundation /></Protected>} />
      <Route path="/owner" element={<Protected owner><RouteFoundation owner /></Protected>} />
      <Route path="*" element={<main><h1>Page not found</h1><Link to="/">Return to CourtMate</Link></main>} />
    </Routes>
  </SessionProvider></BrowserRouter>
}
