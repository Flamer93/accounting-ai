const GOOGLE_KEY_STORAGE = 'receipt-ledger:google-api-key'

/** Private single-user: key lives in browser localStorage only — never committed or logged. */
export function loadGoogleApiKey(): string {
  try {
    return localStorage.getItem(GOOGLE_KEY_STORAGE)?.trim() || ''
  } catch {
    return ''
  }
}

export function saveGoogleApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearGoogleApiKey()
    return
  }
  localStorage.setItem(GOOGLE_KEY_STORAGE, trimmed)
}

export function clearGoogleApiKey(): void {
  localStorage.removeItem(GOOGLE_KEY_STORAGE)
}

export function hasGoogleApiKey(): boolean {
  return Boolean(loadGoogleApiKey())
}
