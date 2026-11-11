/** Per-user API keys in localStorage — never shared across accounts. */

function googleKey(uid: string): string {
  return `receipt-ledger:user:${uid}:google-api-key`
}

function openaiKey(uid: string): string {
  return `receipt-ledger:user:${uid}:openai-api-key`
}

export function loadGoogleApiKey(uid: string): string {
  try {
    return localStorage.getItem(googleKey(uid))?.trim() || ''
  } catch {
    return ''
  }
}

export function saveGoogleApiKey(uid: string, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearGoogleApiKey(uid)
    return
  }
  localStorage.setItem(googleKey(uid), trimmed)
}

export function clearGoogleApiKey(uid: string): void {
  localStorage.removeItem(googleKey(uid))
}

export function hasGoogleApiKey(uid: string): boolean {
  return Boolean(loadGoogleApiKey(uid))
}

export function loadOpenAiApiKey(uid: string): string {
  try {
    return localStorage.getItem(openaiKey(uid))?.trim() || ''
  } catch {
    return ''
  }
}

export function saveOpenAiApiKey(uid: string, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearOpenAiApiKey(uid)
    return
  }
  localStorage.setItem(openaiKey(uid), trimmed)
}

export function clearOpenAiApiKey(uid: string): void {
  localStorage.removeItem(openaiKey(uid))
}

export function hasOpenAiApiKey(uid: string): boolean {
  return Boolean(loadOpenAiApiKey(uid))
}
