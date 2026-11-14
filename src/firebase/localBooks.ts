import { companyBooksKey } from '../companies'
import { DEFAULT_CHART_OF_ACCOUNTS, normalizeAccounts } from '../chartOfAccounts'
import { DEFAULT_SETTINGS, normalizeSettings } from '../settings'
import type { UserBooks } from './books'
import { normalizeUserBooks } from './books'

/** Per-company localStorage books — never shared across companies. */
export function loadLocalUserBooks(companyId: string): UserBooks {
  try {
    const raw = localStorage.getItem(companyBooksKey(companyId))
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

export function saveLocalUserBooks(companyId: string, books: UserBooks): void {
  const payload: UserBooks = {
    documents: books.documents,
    entries: books.entries,
    accounts: normalizeAccounts(books.accounts),
    settings: normalizeSettings(books.settings),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(companyBooksKey(companyId), JSON.stringify(payload))
}

export function clearLocalUserBooks(companyId: string): void {
  localStorage.removeItem(companyBooksKey(companyId))
}
