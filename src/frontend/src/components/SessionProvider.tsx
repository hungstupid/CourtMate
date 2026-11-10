import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onIdTokenChanged, signOut } from '@firebase/auth'
import { firebaseAuth } from '../lib/firebase'
import { ApiError, apiRequest } from '../lib/api'
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
          setState({ user, identity: null, status: error instanceof ApiError && error.code === 'ACCOUNT_UNREGISTERED' ? 'unregistered' : 'error', message: error instanceof Error ? error.message : 'Không thể kết nối. Vui lòng thử lại.' })
        }
      })
    }, () => setState({ ...initial, status: 'error', message: 'Không thể tải phiên đăng nhập. Vui lòng thử lại.' }))
    const expire = () => {
      request?.abort()
      setState({ ...initial, status: 'signed-out', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })
      void signOut(auth).catch(() => setState({ ...initial, status: 'error', message: 'Vui lòng thử đăng xuất lại.' }))
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
      setState((old) => ({ ...old, message: 'Đăng xuất chưa thành công. Vui lòng thử lại.' }))
    }
  }

  const visibleState: State = firebaseAuth ? state : { ...initial, status: 'signed-out' }
  return <SessionContext value={{ ...visibleState, refresh: () => setAttempt((old) => old + 1), logOut }}>{children}</SessionContext>
}
