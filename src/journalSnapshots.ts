import { companySnapshotsKey } from './companies'
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

function newSnapshotId(): string {
  try {
    return `js_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  } catch {
    return `js_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }
}

function cloneJson<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

function readAll(companyId: string): JournalSnapshot[] {
  try {
    const raw = localStorage.getItem(companySnapshotsKey(companyId))
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

function writeAll(companyId: string, snapshots: JournalSnapshot[]): void {
  const key = companySnapshotsKey(companyId)
  const raw = JSON.stringify(snapshots)
  try {
    localStorage.setItem(key, raw)
  } catch (err) {
    // Desktop mirrors into userData even when Chromium quota blocks localStorage.
    const desktop = window.accountingDesktop
    if (desktop?.isDesktop) {
      void desktop.storageSet(key, raw)
      // Best-effort: keep a tiny pointer so list/read still works this session.
      try {
        sessionStorage.setItem(key, raw)
      } catch {
        /* ignore */
      }
      return
    }
    throw err
  }
}

function readWithSessionFallback(companyId: string): JournalSnapshot[] {
  const fromLocal = readAll(companyId)
  if (fromLocal.length) return fromLocal
  try {
    const raw = sessionStorage.getItem(companySnapshotsKey(companyId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as JournalSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function listJournalSnapshots(companyId: string): JournalSnapshot[] {
  return readWithSessionFallback(companyId).sort((a, b) => {
    const byDate = b.asOfDate.localeCompare(a.asOfDate)
    if (byDate) return byDate
    return b.savedAt.localeCompare(a.savedAt)
  })
}

export function saveJournalSnapshot(
  companyId: string,
  input: {
    asOfDate: string
    name?: string
    entries: JournalEntry[]
    accounts: Account[]
  },
): JournalSnapshot {
  const asOfDate = String(input.asOfDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new Error('Choose a valid date (YYYY-MM-DD).')
  }
  if (!Array.isArray(input.entries) || !Array.isArray(input.accounts)) {
    throw new Error('Nothing to save — books are still loading.')
  }
  const snapshot: JournalSnapshot = {
    id: newSnapshotId(),
    name: (input.name || '').trim() || `Journal ${asOfDate}`,
    asOfDate,
    savedAt: new Date().toISOString(),
    entries: cloneJson(input.entries),
    accounts: cloneJson(input.accounts),
  }
  const next = [snapshot, ...readWithSessionFallback(companyId).filter((s) => s.id !== snapshot.id)]
  writeAll(companyId, next)

  // Verify round-trip so Settings UI doesn't silently show an empty list.
  const listed = listJournalSnapshots(companyId)
  if (!listed.some((s) => s.id === snapshot.id)) {
    throw new Error('Save did not stick — storage may be full. Try quitting and relaunching the desktop app.')
  }
  return snapshot
}

export function deleteJournalSnapshot(companyId: string, id: string): void {
  writeAll(
    companyId,
    readWithSessionFallback(companyId).filter((s) => s.id !== id),
  )
}

export function getJournalSnapshot(companyId: string, id: string): JournalSnapshot | null {
  return readWithSessionFallback(companyId).find((s) => s.id === id) ?? null
}
