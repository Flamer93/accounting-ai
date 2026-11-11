import { DEFAULT_CHART_OF_ACCOUNTS, normalizeAccounts } from '../chartOfAccounts'
import { DEFAULT_SETTINGS, normalizeSettings } from '../settings'
import type { UserBooks } from './books'
import { normalizeUserBooks } from './books'

function booksKey(uid: string): string {
  return `receipt-ledger:user:${uid}:books`
}

/** Per-user localStorage books for mock-auth / offline fallback — never shared across uids. */
export function loadLocalUserBooks(uid: string): UserBooks {
  try {
    const raw = localStorage.getItem(booksKey(uid))
    if (!raw) {
      return normalizeUserBooks({
        documents: [],
        entries: [],
        accounts: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a })),
        settings: DEFAULT_SETTINGS,
      })
    }
    return normalizeUserBooks(JSON.parse(raw) as Partial<UserBooks>)
  } catch {
    return normalizeUserBooks(null)
  }
}

export function saveLocalUserBooks(uid: string, books: UserBooks): void {
  const payload: UserBooks = {
    documents: books.documents,
    entries: books.entries,
    accounts: normalizeAccounts(books.accounts),
    settings: normalizeSettings(books.settings),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(booksKey(uid), JSON.stringify(payload))
}

export function clearLocalUserBooks(uid: string): void {
  localStorage.removeItem(booksKey(uid))
}
