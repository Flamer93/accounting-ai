import type { Account, JournalEntry } from './types'

export type JournalSnapshot = {
  id: string
  /** Display name (defaults to as-of date). */
  name: string
  /** Calendar date this save represents (YYYY-MM-DD). */
  asOfDate: string
  savedAt: string
  entries: JournalEntry[]
  accounts: Account[]
}

function storageKey(userId: string): string {
  return `receipt-ledger:user:${userId}:journal-snapshots-v1`
}

function readAll(userId: string): JournalSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as JournalSnapshot[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        typeof s.asOfDate === 'string' &&
        Array.isArray(s.entries) &&
        Array.isArray(s.accounts),
    )
  } catch {
    return []
  }
}

function writeAll(userId: string, snapshots: JournalSnapshot[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(snapshots))
}

export function listJournalSnapshots(userId: string): JournalSnapshot[] {
  return readAll(userId).sort((a, b) => {
    const byDate = b.asOfDate.localeCompare(a.asOfDate)
    if (byDate) return byDate
    return b.savedAt.localeCompare(a.savedAt)
  })
}

export function saveJournalSnapshot(
  userId: string,
  input: {
    asOfDate: string
    name?: string
    entries: JournalEntry[]
    accounts: Account[]
  },
): JournalSnapshot {
  const asOfDate = input.asOfDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new Error('Choose a valid date (YYYY-MM-DD).')
  }
  const snapshot: JournalSnapshot = {
    id: `js_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    name: (input.name || '').trim() || `Journal ${asOfDate}`,
    asOfDate,
    savedAt: new Date().toISOString(),
    entries: structuredClone(input.entries),
    accounts: structuredClone(input.accounts),
  }
  const next = [snapshot, ...readAll(userId).filter((s) => s.id !== snapshot.id)]
  writeAll(userId, next)
  return snapshot
}

export function deleteJournalSnapshot(userId: string, id: string): void {
  writeAll(
    userId,
    readAll(userId).filter((s) => s.id !== id),
  )
}

export function getJournalSnapshot(userId: string, id: string): JournalSnapshot | null {
  return readAll(userId).find((s) => s.id === id) ?? null
}
