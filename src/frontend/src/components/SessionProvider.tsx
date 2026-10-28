import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onIdTokenChanged, signOut } from '@firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { apiRequest } from '../lib/api'
import { SessionContext } from '../lib/session-context'
import type { Identity, Session } from '../lib/session-context'

type State = Pick<Session, 'status' | 'user' | 'identity' | 'message'>
const initial: State = { status: 'loading', user: null, identity: null, message: '' }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const auth = firebaseAuth
    if (!auth) return
    let request: AbortController | undefined
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      request?.abort()
      if (!user) {
        setState((old) => ({ ...initial, status: 'signed-out', message: old.message }))
        return
      }
      request = new AbortController()
      const controller = request
      setState({ ...initial, user, status: 'loading' })
      void apiRequest<Identity>('/api/me', { signal: controller.signal }).then((identity) => {
        if (!controller.signal.aborted) setState({ user, identity, status: 'ready', message: '' })
      }).catch((error: unknown) => {
        if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) {
          setState({ user, identity: null, status: 'error', message: error instanceof Error ? error.message : 'Unable to connect.' })
        }
      })
    }, () => setState({ ...initial, status: 'error', message: 'Unable to load your session. Please retry.' }))
    const expire = () => {
      request?.abort()
      setState({ ...initial, status: 'signed-out', message: 'Your session expired. Sign in again.' })
      void signOut(auth).catch(() => setState({ ...initial, status: 'error', message: 'Please retry signing out.' }))
    }
    window.addEventListener('courtmate:session-expired', expire)
    return () => {
      request?.abort()
      unsubscribe()
      window.removeEventListener('courtmate:session-expired', expire)
    }
  }, [attempt])

  async function logOut() {
    if (!firebaseAuth) return
    try {
      await signOut(firebaseAuth)
      setState({ ...initial, status: 'signed-out' })
    } catch {
      setState((old) => ({ ...old, message: 'Sign-out failed. Please retry.' }))
    }
  }

  const visibleState: State = firebaseAuth ? state : { ...initial, status: 'signed-out' }
  return <SessionContext value={{ ...visibleState, refresh: () => setAttempt((old) => old + 1), logOut }}>{children}</SessionContext>
}
