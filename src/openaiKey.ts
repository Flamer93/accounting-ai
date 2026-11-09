const OPENAI_KEY_STORAGE = 'receipt-ledger:openai-api-key'

/** Private single-user: key lives in browser localStorage only — never committed or logged. */
export function loadOpenAiApiKey(): string {
  try {
    return localStorage.getItem(OPENAI_KEY_STORAGE)?.trim() || ''
  } catch {
    return ''
  }
}

export function saveOpenAiApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    clearOpenAiApiKey()
    return
  }
  localStorage.setItem(OPENAI_KEY_STORAGE, trimmed)
}

export function clearOpenAiApiKey(): void {
  localStorage.removeItem(OPENAI_KEY_STORAGE)
}

export function hasOpenAiApiKey(): boolean {
  return Boolean(loadOpenAiApiKey())
}
