import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from '@firebase/auth'
import type { User } from '@firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { API_BASE_URL } from '../lib/api'

type Identity = { id: string; firebase_uid: string; role: 'player' | 'owner' }

export function IdentitySmoke() {
  const [user, setUser] = useState<User | null>(null)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setIdentity(null)
      setMessage('')
    })
  }, [])

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

  async function verifyIdentity() {
    if (!user) return
    setBusy(true)
    setMessage('')
    try {
      const token = await user.getIdToken()
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(75000),
      })
      if (!response.ok) throw new Error(`API verification failed (HTTP ${response.status}). Retry after the backend wakes up.`)
      const result = await response.json() as Identity
      setIdentity(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API connection failed.')
    } finally {
      setBusy(false)
    }
  }

  async function logOut() {
    if (!firebaseAuth) return
    try {
      await signOut(firebaseAuth)
    } catch {
      setMessage('Sign-out failed. Please try again.')
    }
  }

  return (
    <section className="connection identity" aria-labelledby="identity-title">
      <h2 id="identity-title">Identity connection</h2>
      {!firebaseAuth ? <p>Firebase configuration is missing. See the frontend setup guide.</p> : user ? (
        <>
          <p>Signed in with Firebase.</p>
          <button disabled={busy} onClick={verifyIdentity}>Verify with backend</button>{' '}
          <button className="secondary" onClick={logOut}>Sign out</button>
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
    </section>
  )
}
