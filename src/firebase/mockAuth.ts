import type { AuthUser } from './types'

const USERS_KEY = 'receipt-ledger:mock-users-v1'
const SESSION_KEY = 'receipt-ledger:mock-session-v1'

type MockUserRecord = {
  uid: string
  email: string
  password: string
  displayName?: string
}

function readUsers(): MockUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MockUserRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeUsers(users: MockUserRecord[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function toAuthUser(user: MockUserRecord): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName }
}

export function mockGetSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.uid || !parsed?.email) return null
    return parsed
  } catch {
    return null
  }
}

function setSession(user: AuthUser | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function mockSignUp(email: string, password: string): AuthUser {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !password) throw new Error('Email and password are required')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')
  const users = readUsers()
  if (users.some((u) => u.email === normalized)) {
    throw new Error('An account with this email already exists')
  }
  const user: MockUserRecord = {
    uid: `mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    email: normalized,
    password,
  }
  writeUsers([...users, user])
  const authUser = toAuthUser(user)
  setSession(authUser)
  return authUser
}

export function mockSignIn(email: string, password: string): AuthUser {
  const normalized = email.trim().toLowerCase()
  const user = readUsers().find((u) => u.email === normalized)
  if (!user || user.password !== password) {
    throw new Error('Invalid email or password')
  }
  const authUser = toAuthUser(user)
  setSession(authUser)
  return authUser
}

export function mockSignOut(): void {
  setSession(null)
}
