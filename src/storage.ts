import type { DocumentRecord, JournalEntry } from './types'

const DOCS_KEY = 'receipt-ledger:documents'
const ENTRIES_KEY = 'receipt-ledger:entries'
const SEEDED_KEY = 'receipt-ledger:seeded'
const BLANK_TEMPLATE_KEY = 'receipt-ledger:blank-template-v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * One-time migrate: drop old seed/demo documents & journal entries so the app
 * opens as a blank books template.
 */
export function ensureBlankTemplate(): void {
  if (localStorage.getItem(BLANK_TEMPLATE_KEY) === '1') return
  localStorage.removeItem(SEEDED_KEY)
  writeJson(DOCS_KEY, [])
  writeJson(ENTRIES_KEY, [])
  // Clear demo company name if it was the old Paul's Guitar default
  try {
    const raw = localStorage.getItem('receipt-ledger:settings')
    if (raw) {
      const parsed = JSON.parse(raw) as { companyName?: string }
      if (
        typeof parsed.companyName === 'string' &&
        /paul'?s\s+guitar|apple\s+inc/i.test(parsed.companyName)
      ) {
        parsed.companyName = ''
        localStorage.setItem('receipt-ledger:settings', JSON.stringify(parsed))
      }
    }
  } catch {
    // ignore
  }
  localStorage.setItem(BLANK_TEMPLATE_KEY, '1')
}

export function loadDocuments(): DocumentRecord[] {
  ensureBlankTemplate()
  return readJson<DocumentRecord[]>(DOCS_KEY, [])
}

export function saveDocuments(docs: DocumentRecord[]): void {
  writeJson(DOCS_KEY, docs)
}

export function loadEntries(): JournalEntry[] {
  ensureBlankTemplate()
  return readJson<JournalEntry[]>(ENTRIES_KEY, [])
}

export function saveEntries(entries: JournalEntry[]): void {
  writeJson(ENTRIES_KEY, entries)
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
