import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import { DEFAULT_CHART_OF_ACCOUNTS, normalizeAccounts } from '../chartOfAccounts'
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from '../settings'
import type { Account, DocumentRecord, JournalEntry } from '../types'

export type UserBooks = {
  documents: DocumentRecord[]
  entries: JournalEntry[]
  accounts: Account[]
  settings: AppSettings
  updatedAt?: string
}

const emptyBooks = (): UserBooks => ({
  documents: [],
  entries: [],
  accounts: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a })),
  settings: normalizeSettings(DEFAULT_SETTINGS),
})

function booksDocRef(db: Firestore, uid: string) {
  return doc(db, 'users', uid, 'books', 'main')
}

export function normalizeUserBooks(raw: Partial<UserBooks> | null | undefined): UserBooks {
  if (!raw) return emptyBooks()
  return {
    documents: Array.isArray(raw.documents) ? (raw.documents as DocumentRecord[]) : [],
    entries: Array.isArray(raw.entries) ? (raw.entries as JournalEntry[]) : [],
    accounts: normalizeAccounts(raw.accounts),
    settings: normalizeSettings(raw.settings ?? null),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

/** Load this user's books from Firestore. Missing doc → blank template. */
export async function loadUserBooks(db: Firestore, uid: string): Promise<UserBooks> {
  const snap = await getDoc(booksDocRef(db, uid))
  if (!snap.exists()) return emptyBooks()
  return normalizeUserBooks(snap.data() as Partial<UserBooks>)
}

/** Persist books under users/{uid}/books/main — never cross-user. */
export async function saveUserBooks(db: Firestore, uid: string, books: UserBooks): Promise<void> {
  const payload: UserBooks = {
    documents: books.documents,
    entries: books.entries,
    accounts: normalizeAccounts(books.accounts),
    settings: normalizeSettings(books.settings),
    updatedAt: new Date().toISOString(),
  }
  await setDoc(booksDocRef(db, uid), payload, { merge: true })
}
