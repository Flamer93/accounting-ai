import type { FirebaseWebConfig } from './types'

declare const __FIREBASE_CONFIG__: FirebaseWebConfig | undefined

function normalizeConfig(raw: Partial<FirebaseWebConfig> | null | undefined): FirebaseWebConfig | null {
  if (!raw) return null
  const apiKey = String(raw.apiKey || '').trim()
  const authDomain = String(raw.authDomain || '').trim()
  const projectId = String(raw.projectId || '').trim()
  const storageBucket = String(raw.storageBucket || '').trim()
  const messagingSenderId = String(raw.messagingSenderId || '').trim()
  const appId = String(raw.appId || '').trim()
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
}

/** Compile-time inject from Vite `define` (process.env.FIREBASE_*). */
export function buildTimeFirebaseConfig(): FirebaseWebConfig | null {
  try {
    return normalizeConfig(typeof __FIREBASE_CONFIG__ !== 'undefined' ? __FIREBASE_CONFIG__ : null)
  } catch {
    return null
  }
}

/** Runtime config from Express `/api/firebase-config` (Cursor publish secrets). */
export async function fetchRuntimeFirebaseConfig(): Promise<FirebaseWebConfig | null> {
  try {
    const res = await fetch('/api/firebase-config', { credentials: 'same-origin' })
    if (!res.ok) return null
    const body = (await res.json()) as { configured?: boolean; config?: FirebaseWebConfig }
    if (!body.configured) return null
    return normalizeConfig(body.config)
  } catch {
    return null
  }
}

export async function resolveFirebaseConfig(): Promise<FirebaseWebConfig | null> {
  const runtime = await fetchRuntimeFirebaseConfig()
  if (runtime) return runtime
  return buildTimeFirebaseConfig()
}

export function isFirebaseConfigComplete(config: FirebaseWebConfig | null): boolean {
  return Boolean(config?.apiKey && config.authDomain && config.projectId && config.appId)
}
