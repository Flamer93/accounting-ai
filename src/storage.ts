import type { DocumentRecord, JournalEntry } from './types'
import { createSeedData } from './seed'

const DOCS_KEY = 'receipt-ledger:documents'
const ENTRIES_KEY = 'receipt-ledger:entries'
const SEEDED_KEY = 'receipt-ledger:seeded'

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

export function ensureSeeded(): void {
  if (localStorage.getItem(SEEDED_KEY) === '1') return
  const { documents, entries } = createSeedData()
  writeJson(DOCS_KEY, documents)
  writeJson(ENTRIES_KEY, entries)
  localStorage.setItem(SEEDED_KEY, '1')
}

export function loadDocuments(): DocumentRecord[] {
  ensureSeeded()
  return readJson<DocumentRecord[]>(DOCS_KEY, [])
}

export function saveDocuments(docs: DocumentRecord[]): void {
  writeJson(DOCS_KEY, docs)
}

export function loadEntries(): JournalEntry[] {
  ensureSeeded()
  return readJson<JournalEntry[]>(ENTRIES_KEY, [])
}

export function saveEntries(entries: JournalEntry[]): void {
  writeJson(ENTRIES_KEY, entries)
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
