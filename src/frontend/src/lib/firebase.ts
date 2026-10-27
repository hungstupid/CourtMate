import { initializeApp } from '@firebase/app'
import { connectAuthEmulator, getAuth } from '@firebase/auth'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
export const firebaseConfigured = Boolean(projectId && apiKey && import.meta.env.VITE_FIREBASE_APP_ID)

export const firebaseAuth = firebaseConfigured ? getAuth(initializeApp({
  projectId,
  apiKey,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
})) : null

if (firebaseAuth && import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(firebaseAuth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true })
}
