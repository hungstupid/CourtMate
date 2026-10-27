import { BackendStatus } from '../components/BackendStatus'
import { IdentitySmoke } from '../components/IdentitySmoke'

export function DevelopmentPage() {
  return (
    <main>
      <header><span className="brand-mark" aria-hidden="true">C</span>CourtMate</header>
      <div className="intro">
        <p className="eyebrow">LOCAL DEVELOPMENT ENVIRONMENT</p>
        <h1>A shared starting point<br />for CourtMate.</h1>
        <p className="lead">Sports Court Booking &amp; Management Platform</p>
      </div>
      <BackendStatus />
      <IdentitySmoke />
      <footer>T05 Nexora <span aria-hidden="true">·</span> HCMUS</footer>
    </main>
  )
}
