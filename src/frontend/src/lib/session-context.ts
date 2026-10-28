import { createContext, useContext } from 'react'
import type { User } from '@firebase/auth'

export type Identity = { id: string; firebase_uid: string; role: 'player' | 'owner' }
export type Session = {
  status: 'loading' | 'signed-out' | 'ready' | 'error'
  user: User | null
  identity: Identity | null
  message: string
  refresh: () => void
  logOut: () => Promise<void>
}
export const SessionContext = createContext<Session | null>(null)
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider is required.')
  return session
}
