export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export type AuthMode = 'firebase' | 'mock'

export type AuthUser = {
  uid: string
  email: string
  displayName?: string
}
