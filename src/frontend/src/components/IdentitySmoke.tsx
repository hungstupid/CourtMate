import { useState } from 'react'
import type { FormEvent } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { useSession } from '../lib/session-context'

export function IdentitySmoke() {
  const { status, user, identity, message: sessionMessage, refresh, logOut } = useSession()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseAuth) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '')
    const password = String(data.get('password') || '')
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    setBusy(true)
    setMessage('')
    try {
      if (submitter?.value === 'register') {
        await createUserWithEmailAndPassword(firebaseAuth, email, password)
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
      }
    } catch {
      setMessage('Sign-in or registration failed. Check your credentials and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="connection identity" aria-labelledby="identity-title">
      <h2 id="identity-title">Identity connection</h2>
      {!firebaseAuth ? <p>Firebase configuration is missing. See the frontend setup guide.</p> : status === 'loading' ? <p role="status">Loading session…</p> : user ? (
        <>
          <p>Signed in with Firebase.</p>
          <button disabled={busy} onClick={refresh}>Verify with backend</button>{' '}
          <button className="secondary" onClick={() => { setMessage(''); void logOut() }}>Sign out</button>
          {identity && <p role="status">Backend verified · Role: <strong>{identity.role === 'owner' ? 'Court Owner' : 'Player'}</strong></p>}
        </>
      ) : (
        <form onSubmit={authenticate}>
          <p>Use a development account to check Firebase and API integration.</p>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" minLength={6} required />
          <div className="auth-actions">
            <button type="submit" value="signin" disabled={busy}>Sign in</button>
            <button className="secondary" type="submit" value="register" disabled={busy}>Register as Player</button>
          </div>
        </form>
      )}
      {busy && <p role="status">Working…</p>}
      {message && <p role="alert">{message}</p>}
      {sessionMessage && <p role="alert">{sessionMessage}</p>}
      {status === 'error' && !user && <button onClick={refresh}>Retry session</button>}
    </section>
  )
}
