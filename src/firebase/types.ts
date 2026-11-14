export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

/** Local single-user mode — no sign-in. */
export type AuthMode = 'local' | 'firebase'

export type AuthUser = {
  uid: string
  email: string
  displayName?: string
}
