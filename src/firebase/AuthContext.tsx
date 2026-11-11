import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isFirebaseConfigComplete, resolveFirebaseConfig } from './config'
import { mockGetSession, mockSignIn, mockSignOut, mockSignUp } from './mockAuth'
import type { AuthMode, AuthUser, FirebaseWebConfig } from './types'

type AuthState = {
  loading: boolean
  mode: AuthMode
  user: AuthUser | null
  firebaseApp: FirebaseApp | null
  firestore: Firestore | null
  googleAvailable: boolean
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<AuthMode>('mock')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null)
  const [auth, setAuth] = useState<Auth | null>(null)
  const [firestore, setFirestore] = useState<Firestore | null>(null)
  const [googleAvailable, setGoogleAvailable] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false

    ;(async () => {
      const config = await resolveFirebaseConfig()
      if (cancelled) return

      if (isFirebaseConfigComplete(config)) {
        try {
          const app = initializeApp(config as FirebaseWebConfig)
          const nextAuth = getAuth(app)
          const db = getFirestore(app)
          setFirebaseApp(app)
          setAuth(nextAuth)
          setFirestore(db)
          setMode('firebase')
          setGoogleAvailable(true)
          unsub = onAuthStateChanged(nextAuth, (fbUser) => {
            setUser(fbUser ? mapFirebaseUser(fbUser) : null)
            setLoading(false)
          })
          return
        } catch (err) {
          console.warn('Firebase init failed — falling back to local mock auth', err)
        }
      }

      // Local mock auth when Firebase config is missing or init fails
      setMode('mock')
      setGoogleAvailable(false)
      setFirebaseApp(null)
      setAuth(null)
      setFirestore(null)
      setUser(mockGetSession())
      setLoading(false)
    })()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      if (mode === 'firebase' && auth) {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        return
      }
      setUser(mockSignIn(email, password))
    },
    [auth, mode],
  )

  const signUpEmail = useCallback(
    async (email: string, password: string) => {
      if (mode === 'firebase' && auth) {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        return
      }
      setUser(mockSignUp(email, password))
    },
    [auth, mode],
  )

  const signInGoogle = useCallback(async () => {
    if (mode !== 'firebase' || !auth) {
      throw new Error('Google sign-in requires Firebase configuration')
    }
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }, [auth, mode])

  const signOutUser = useCallback(async () => {
    if (mode === 'firebase' && auth) {
      await signOut(auth)
      return
    }
    mockSignOut()
    setUser(null)
  }, [auth, mode])

  const value = useMemo(
    () => ({
      loading,
      mode,
      user,
      firebaseApp,
      firestore,
      googleAvailable,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signOutUser,
    }),
    [
      loading,
      mode,
      user,
      firebaseApp,
      firestore,
      googleAvailable,
      signInEmail,
      signUpEmail,
      signInGoogle,
      signOutUser,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
