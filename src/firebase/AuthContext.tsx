import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthMode, AuthUser } from './types'

const LEGACY_MOCK_SESSION_KEY = 'receipt-ledger:mock-session-v1'

const DEFAULT_LOCAL_USER: AuthUser = {
  uid: 'local',
  email: 'local',
  displayName: 'Local',
}

type AuthState = {
  loading: boolean
  mode: AuthMode
  user: AuthUser
  firebaseApp: null
  firestore: null
  googleAvailable: boolean
}

const Ctx = createContext<AuthState | null>(null)

/** Prefer a prior mock-auth session uid so existing local books keep loading. */
function resolveLocalUser(): AuthUser {
  try {
    const raw = localStorage.getItem(LEGACY_MOCK_SESSION_KEY)
    if (!raw) return DEFAULT_LOCAL_USER
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (parsed?.uid && typeof parsed.uid === 'string') {
      return {
        uid: parsed.uid,
        email: typeof parsed.email === 'string' && parsed.email ? parsed.email : 'local',
        displayName:
          typeof parsed.displayName === 'string' && parsed.displayName
            ? parsed.displayName
            : 'Local',
      }
    }
  } catch {
    /* ignore corrupt legacy session */
  }
  return DEFAULT_LOCAL_USER
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<AuthUser>(() => resolveLocalUser())

  const value = useMemo<AuthState>(
    () => ({
      loading: false,
      mode: 'local',
      user,
      firebaseApp: null,
      firestore: null,
      googleAvailable: false,
    }),
    [user],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
