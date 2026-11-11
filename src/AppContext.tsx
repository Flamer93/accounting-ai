import type { Firestore } from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildOpeningBalanceLines, validateEntry, type OpeningBalanceAmount } from './accounting'
import { apiFetch } from './apiClient'
import {
  accountLabel,
  accountsSorted,
  DEFAULT_CHART_OF_ACCOUNTS,
  ensureOpeningBalanceEquity,
  nextAccountCode,
  setChartOfAccounts,
} from './chartOfAccounts'
import { cascadeRemoveDocument } from './documentCascade'
import type { AuthMode } from './firebase/types'
import { loadUserBooks, saveUserBooks, type UserBooks } from './firebase/books'
import { loadLocalUserBooks, saveLocalUserBooks } from './firebase/localBooks'
import { normalizeReceiptImage } from './normalizeReceiptImage'
import {
  enabledExtractFields,
  normalizeSettings,
  type AppSettings,
} from './settings'
import { uid } from './storage'
import type { Account, AccountType, DocumentRecord, ExtractResult, JournalEntry, PeriodFilter } from './types'
import {
  clearGoogleApiKey,
  clearOpenAiApiKey,
  hasGoogleApiKey,
  hasOpenAiApiKey,
  loadGoogleApiKey,
  loadOpenAiApiKey,
  saveGoogleApiKey,
  saveOpenAiApiKey,
} from './userKeys'

export type ExtractProvider = 'google' | 'openai' | 'mock' | null

interface AppState {
  documents: DocumentRecord[]
  entries: JournalEntry[]
  accounts: Account[]
  period: PeriodFilter
  settings: AppSettings
  booksReady: boolean
  persistError: string | null
  setPeriod: (period: PeriodFilter) => void
  updateSettings: (next: AppSettings) => void
  addAccount: (input: { name: string; type: AccountType }) => { errors: string[]; account?: Account }
  deleteAccount: (
    code: string,
    opts?: { force?: boolean },
  ) => { errors: string[]; blocked?: boolean; usageCount?: number }
  addDocument: (file: File, dataUrl: string) => DocumentRecord
  extractDocument: (documentId: string) => Promise<ExtractOutcome>
  deleteDocument: (documentId: string) => void
  updateEntry: (entry: JournalEntry) => string[]
  /** Pass `override` when approving unsaved journal editor edits (avoids stale-state race). */
  approveEntry: (entryId: string, override?: JournalEntry) => string[]
  deleteEntry: (entryId: string) => void
  addManualEntry: () => string
  /**
   * Create a balanced, approved journal entry from any books view.
   * Returns errors or the new entry id.
   */
  postSimpleEntry: (input: {
    date: string
    memo: string
    debitAccount: string
    creditAccount: string
    amount: number
    vendor?: string
  }) => { errors: string[]; entryId?: string }
  /**
   * Post a balanced opening-balances journal entry (normal-side amounts + Opening Balance Equity plug).
   * Optionally clear the journal first and/or set the period From date.
   */
  postOpeningBalances: (input: {
    date: string
    memo?: string
    amounts: OpeningBalanceAmount[]
    clearJournalFirst?: boolean
    setPeriodFrom?: boolean
  }) => { errors: string[]; entryId?: string }
  /** Wipe all journal entries and documents; statements go empty. Keeps accounts & company. */
  clearJournal: () => void
  /** Restore default chart of accounts (does not clear company name). */
  resetAccounts: () => void
  openaiConfigured: boolean | null
  googleKeySaved: boolean
  openaiKeySaved: boolean
  saveGoogleKey: (key: string) => void
  removeGoogleKey: () => void
  saveOpenAiKey: (key: string) => void
  removeOpenAiKey: () => void
  preferredProvider: ExtractProvider
}

const Ctx = createContext<AppState | null>(null)

function entryFromExtract(docId: string, result: ExtractResult): JournalEntry {
  const amount = Number(result.amount) || 0
  const debit = result.debitAccount || '5200'
  const credit = result.creditAccount || '1000'
  const editRequired = Boolean(result.editRequired || result.source === 'mock')
  const draft: JournalEntry = {
    id: uid('je'),
    date: result.date || new Date().toISOString().slice(0, 10),
    memo: result.memo || '',
    vendor: result.vendor,
    documentId: docId,
    lines: [
      { accountCode: debit, debit: amount, credit: 0 },
      { accountCode: credit, debit: 0, credit: amount },
    ],
    status: 'draft',
    editRequired,
    source: 'extract',
    createdAt: new Date().toISOString(),
    tax: result.tax,
    category: result.category,
    extractSource: result.source,
    extractedFields: result.fields,
  }

  // Auto-post balanced, valid AI extracts so statements update immediately.
  // Mock / edit-required stays draft until the user Approves & posts in Journal.
  if (!editRequired && validateEntry(draft).length === 0) {
    return { ...draft, status: 'approved', editRequired: false }
  }
  return draft
}

export type ExtractOutcome = {
  entry: JournalEntry
  warning?: string
}

function countAccountUsage(entries: JournalEntry[], code: string): number {
  let n = 0
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountCode === code) n += 1
    }
  }
  return n
}

function pickDefaultAccount(accounts: Account[], preferredCodes: string[]): string {
  for (const code of preferredCodes) {
    if (accounts.some((a) => a.code === code)) return code
  }
  return accounts[0]?.code || ''
}

function applyBooks(books: UserBooks, setters: {
  setDocuments: (d: DocumentRecord[]) => void
  setEntries: (e: JournalEntry[]) => void
  setAccounts: (a: Account[]) => void
  setSettings: (s: AppSettings) => void
  documentsRef: { current: DocumentRecord[] }
  entriesRef: { current: JournalEntry[] }
  settingsRef: { current: AppSettings }
  accountsRef: { current: Account[] }
}) {
  setters.documentsRef.current = books.documents
  setters.entriesRef.current = books.entries
  setters.settingsRef.current = books.settings
  setters.accountsRef.current = books.accounts
  setChartOfAccounts(books.accounts)
  setters.setDocuments(books.documents)
  setters.setEntries(books.entries)
  setters.setAccounts(books.accounts)
  setters.setSettings(books.settings)
}

type AppProviderProps = {
  children: ReactNode
  userId: string
  authMode: AuthMode
  firestore: Firestore | null
}

export function AppProvider({ children, userId, authMode, firestore }: AppProviderProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_BOOT_SETTINGS)
  const [period, setPeriod] = useState<PeriodFilter>({})
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null)
  const [googleKeySaved, setGoogleKeySaved] = useState(false)
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false)
  const [booksReady, setBooksReady] = useState(false)
  const [persistError, setPersistError] = useState<string | null>(null)
  const documentsRef = useRef(documents)
  const entriesRef = useRef(entries)
  const settingsRef = useRef(settings)
  const accountsRef = useRef(accounts)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    accountsRef.current = accounts
    setChartOfAccounts(accounts)
  }, [accounts])

  // Boot this user's books — remount (key=uid) clears prior session state.
  useEffect(() => {
    let cancelled = false
    setBooksReady(false)
    setPersistError(null)
    setPeriod({})
    setDocuments([])
    setEntries([])
    setAccounts([])
    setSettings(DEFAULT_BOOT_SETTINGS)

    ;(async () => {
      try {
        let books: UserBooks
        if (authMode === 'firebase' && firestore) {
          books = await loadUserBooks(firestore, userId)
        } else {
          books = loadLocalUserBooks(userId)
        }
        if (cancelled) return
        applyBooks(books, {
          setDocuments,
          setEntries,
          setAccounts,
          setSettings,
          documentsRef,
          entriesRef,
          settingsRef,
          accountsRef,
        })
        setGoogleKeySaved(hasGoogleApiKey(userId))
        setOpenaiKeySaved(hasOpenAiApiKey(userId))
        setBooksReady(true)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load user books', err)
        setPersistError(err instanceof Error ? err.message : 'Failed to load books')
        const fallback = loadLocalUserBooks(userId)
        applyBooks(fallback, {
          setDocuments,
          setEntries,
          setAccounts,
          setSettings,
          documentsRef,
          entriesRef,
          settingsRef,
          accountsRef,
        })
        setGoogleKeySaved(hasGoogleApiKey(userId))
        setOpenaiKeySaved(hasOpenAiApiKey(userId))
        setBooksReady(true)
      }
    })()

    const headers: HeadersInit = {}
    const googleKey = loadGoogleApiKey(userId)
    const openaiKey = loadOpenAiApiKey(userId)
    if (googleKey) headers['X-Google-Api-Key'] = googleKey
    if (openaiKey) headers['X-OpenAI-Api-Key'] = openaiKey
    apiFetch('/api/health', { headers }, 10_000)
      .then((r) => r.json())
      .then((j: { openaiConfigured?: boolean }) => setOpenaiConfigured(Boolean(j.openaiConfigured)))
      .catch(() => setOpenaiConfigured(false))

    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [userId, authMode, firestore])

  const persistBooks = useCallback(
    (next: UserBooks) => {
      // Always keep a uid-scoped local mirror so account switches stay isolated offline.
      saveLocalUserBooks(userId, next)
      if (authMode !== 'firebase' || !firestore) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveUserBooks(firestore, userId, next)
          .then(() => setPersistError(null))
          .catch((err) => {
            console.error('Failed to save books', err)
            setPersistError(err instanceof Error ? err.message : 'Failed to save books')
          })
      }, 450)
    },
    [authMode, firestore, userId],
  )

  const snapshot = useCallback(
    (overrides?: Partial<UserBooks>): UserBooks => ({
      documents: overrides?.documents ?? documentsRef.current,
      entries: overrides?.entries ?? entriesRef.current,
      accounts: overrides?.accounts ?? accountsRef.current,
      settings: overrides?.settings ?? settingsRef.current,
    }),
    [],
  )

  useEffect(() => {
    if (!booksReady) return
    persistBooks(snapshot())
  }, [documents, entries, accounts, settings, booksReady, persistBooks, snapshot])

  const updateSettings = useCallback(
    (next: AppSettings) => {
      const normalized = normalizeSettings(next)
      settingsRef.current = normalized
      setSettings(normalized)
      persistBooks(snapshot({ settings: normalized }))
    },
    [persistBooks, snapshot],
  )

  const saveGoogleKey = useCallback(
    (key: string) => {
      saveGoogleApiKey(userId, key)
      setGoogleKeySaved(hasGoogleApiKey(userId))
    },
    [userId],
  )

  const removeGoogleKey = useCallback(() => {
    clearGoogleApiKey(userId)
    setGoogleKeySaved(false)
  }, [userId])

  const saveOpenAiKey = useCallback(
    (key: string) => {
      saveOpenAiApiKey(userId, key)
      setOpenaiKeySaved(hasOpenAiApiKey(userId))
    },
    [userId],
  )

  const removeOpenAiKey = useCallback(() => {
    clearOpenAiApiKey(userId)
    setOpenaiKeySaved(false)
  }, [userId])

  const preferredProvider: ExtractProvider = googleKeySaved
    ? 'google'
    : openaiKeySaved || openaiConfigured
      ? 'openai'
      : openaiConfigured === null && !openaiKeySaved
        ? null
        : 'mock'

  const addDocument = useCallback(
    (file: File, dataUrl: string) => {
      const doc: DocumentRecord = {
        id: uid('doc'),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        uploadedAt: new Date().toISOString(),
        extractionStatus: 'pending',
        entryIds: [],
      }
      setDocuments((prev) => {
        const next = [doc, ...prev]
        documentsRef.current = next
        persistBooks(snapshot({ documents: next }))
        return next
      })
      return doc
    },
    [persistBooks, snapshot],
  )

  const extractDocument = useCallback(
    async (documentId: string) => {
      const doc =
        documentsRef.current.find((d) => d.id === documentId) ||
        snapshot().documents.find((d) => d.id === documentId)
      if (!doc) throw new Error('Document not found')

      const fields = enabledExtractFields(settingsRef.current)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const googleKey = loadGoogleApiKey(userId)
      const openaiKey = loadOpenAiApiKey(userId)
      // Send via header and body so a proxy that strips custom headers still works
      if (googleKey) headers['X-Google-Api-Key'] = googleKey
      if (openaiKey) headers['X-OpenAI-Api-Key'] = openaiKey

      let normalizedDataUrl = doc.dataUrl
      let bottomDataUrl: string | undefined
      try {
        const prepared = await normalizeReceiptImage(doc.dataUrl)
        normalizedDataUrl = prepared.dataUrl
        bottomDataUrl = prepared.bottomDataUrl
      } catch {
        // Fall back to the stored data URL if canvas normalize fails
      }

      let res: Response
      try {
        res = await apiFetch(
          '/api/extract',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              dataUrl: normalizedDataUrl,
              ...(bottomDataUrl ? { bottomDataUrl } : {}),
              filename: doc.name,
              size: normalizedDataUrl.length,
              fields,
              ...(googleKey ? { googleApiKey: googleKey } : {}),
              ...(openaiKey ? { openaiApiKey: openaiKey } : {}),
            }),
          },
          195_000,
        )
      } catch (err) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, extractionStatus: 'failed' } : d)),
        )
        throw err
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, extractionStatus: 'failed' } : d)),
        )
        throw new Error((err as { error?: string }).error || `Extract failed (HTTP ${res.status})`)
      }
      const result = (await res.json()) as ExtractResult
      if ((googleKey || openaiKey) && result.source === 'mock') {
        throw new Error(
          'An AI key was sent but the server returned a mock extract. Check that /api/extract received the key.',
        )
      }
      const entry = entryFromExtract(doc.id, result)
      const sourceLabel =
        result.source === 'google' ? 'Google extract' : result.source === 'openai' ? 'OpenAI extract' : 'Mock extract'
      const lineCount = result.lineItems?.length
      const summaryParts = [
        sourceLabel,
        result.model ? `(${result.model})` : '',
        `$${Number(result.amount).toFixed(2)}`,
        result.vendor,
        result.memo,
        lineCount ? `${lineCount} line item${lineCount === 1 ? '' : 's'}` : '',
        entry.status === 'approved' ? 'posted to books' : 'draft — Approve & post in Journal',
        result.warning,
      ].filter(Boolean)

      setEntries((prev) => {
        const next = [entry, ...prev]
        entriesRef.current = next
        return next
      })
      setDocuments((prev) => {
        const next = prev.map((d) =>
          d.id === documentId
            ? {
                ...d,
                extractionStatus: 'extracted' as const,
                editRequired: entry.status !== 'approved' && Boolean(entry.editRequired),
                entryIds: [...d.entryIds, entry.id],
                lastExtractSource: result.source,
                lastExtractSummary: summaryParts.join(' · '),
              }
            : d,
        )
        documentsRef.current = next
        persistBooks(snapshot({ documents: next, entries: entriesRef.current }))
        return next
      })
      return { entry, warning: result.warning }
    },
    [persistBooks, snapshot, userId],
  )

  const updateEntry = useCallback((entry: JournalEntry) => {
    const errors = validateEntry(entry)
    if (errors.length) return errors
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...entry, editRequired: false } : e)))
    return []
  }, [])

  const approveEntry = useCallback((entryId: string, override?: JournalEntry) => {
    const entry = override ?? entriesRef.current.find((e) => e.id === entryId)
    if (!entry || entry.id !== entryId) return ['Entry not found']
    const errors = validateEntry(entry)
    if (errors.length) return errors
    const posted: JournalEntry = { ...entry, status: 'approved', editRequired: false }
    // Keep ref in sync so immediate follow-up reads see the approved entry
    entriesRef.current = entriesRef.current.map((e) => (e.id === entryId ? posted : e))
    setEntries((prev) => prev.map((e) => (e.id === entryId ? posted : e)))
    if (posted.documentId) {
      const docId = posted.documentId
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                editRequired: false,
                lastExtractSummary: d.lastExtractSummary?.includes('posted')
                  ? d.lastExtractSummary
                  : d.lastExtractSummary
                    ? `${d.lastExtractSummary} · posted`
                    : d.lastExtractSummary,
              }
            : d,
        ),
      )
    }
    return []
  }, [])

  const deleteEntry = useCallback((entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
    setDocuments((prev) =>
      prev.map((d) => ({ ...d, entryIds: d.entryIds.filter((id) => id !== entryId) })),
    )
  }, [])

  const deleteDocument = useCallback(
    (documentId: string) => {
      const next = cascadeRemoveDocument(documentsRef.current, entriesRef.current, documentId)
      documentsRef.current = next.documents
      entriesRef.current = next.entries
      setDocuments(next.documents)
      setEntries(next.entries)
      persistBooks(snapshot({ documents: next.documents, entries: next.entries }))
    },
    [persistBooks, snapshot],
  )

  const addAccount = useCallback((input: { name: string; type: AccountType }) => {
    const name = input.name.trim()
    if (!name) return { errors: ['Account name is required'] }
    const existing = accountsRef.current
    if (existing.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      return { errors: [`An account named “${name}” already exists`] }
    }
    const account: Account = {
      code: nextAccountCode(input.type, existing),
      name,
      type: input.type,
    }
    const next = accountsSorted([...existing, account])
    accountsRef.current = next
    setChartOfAccounts(next)
    setAccounts(next)
    return { errors: [], account }
  }, [])

  const deleteAccount = useCallback((code: string, opts?: { force?: boolean }) => {
    const existing = accountsRef.current
    const account = existing.find((a) => a.code === code)
    if (!account) return { errors: ['Account not found'] }
    const usageCount = countAccountUsage(entriesRef.current, code)
    if (usageCount > 0 && !opts?.force) {
      return {
        errors: [
          `“${accountLabel(code, existing)}” is used on ${usageCount} journal line${usageCount === 1 ? '' : 's'}. Delete those entries first, or force-remove.`,
        ],
        blocked: true,
        usageCount,
      }
    }
    if (existing.length <= 2) {
      return { errors: ['Keep at least two accounts so you can post double-entry.'] }
    }
    const next = existing.filter((a) => a.code !== code)
    accountsRef.current = next
    setChartOfAccounts(next)
    setAccounts(next)
    return { errors: [], usageCount }
  }, [])

  const addManualEntry = useCallback(() => {
    const id = uid('je')
    const fields = settingsRef.current.extractFields
    const chart = accountsRef.current
    const debit = pickDefaultAccount(chart, ['5200', '5000'])
    const credit = pickDefaultAccount(chart, ['1000', '2000'])
    const entry: JournalEntry = {
      id,
      date: new Date().toISOString().slice(0, 10),
      memo: '',
      lines: [
        { accountCode: debit, debit: 0, credit: 0 },
        { accountCode: credit, debit: 0, credit: 0 },
      ],
      status: 'draft',
      editRequired: true,
      source: 'manual',
      createdAt: new Date().toISOString(),
      tax: fields.tax ? 0 : undefined,
      category: fields.category ? '' : undefined,
      extractedFields: enabledExtractFields(settingsRef.current),
    }
    setEntries((prev) => [entry, ...prev])
    return id
  }, [])

  const postSimpleEntry = useCallback(
    (input: {
      date: string
      memo: string
      debitAccount: string
      creditAccount: string
      amount: number
      vendor?: string
    }) => {
      const amount = Math.round((Number(input.amount) + Number.EPSILON) * 100) / 100
      const entry: JournalEntry = {
        id: uid('je'),
        date: input.date,
        memo: input.memo.trim() || 'Manual entry',
        vendor: input.vendor,
        lines: [
          { accountCode: input.debitAccount, debit: amount, credit: 0 },
          { accountCode: input.creditAccount, debit: 0, credit: amount },
        ],
        status: 'approved',
        editRequired: false,
        source: 'manual',
        createdAt: new Date().toISOString(),
      }
      const errors = validateEntry(entry)
      if (input.debitAccount === input.creditAccount) {
        errors.push('Debit and credit accounts must differ')
      }
      if (!(amount > 0)) errors.push('Amount must be greater than zero')
      if (errors.length) return { errors }
      entriesRef.current = [entry, ...entriesRef.current]
      setEntries((prev) => [entry, ...prev])
      return { errors: [], entryId: entry.id }
    },
    [],
  )

  const postOpeningBalances = useCallback(
    (input: {
      date: string
      memo?: string
      amounts: OpeningBalanceAmount[]
      clearJournalFirst?: boolean
      setPeriodFrom?: boolean
    }) => {
      if (!input.date) return { errors: ['Date is required'] }

      const ensured = ensureOpeningBalanceEquity(accountsRef.current)
      if (ensured.created) {
        accountsRef.current = ensured.accounts
        setChartOfAccounts(ensured.accounts)
        setAccounts(ensured.accounts)
      }

      const { lines, errors: lineErrors } = buildOpeningBalanceLines(
        input.amounts,
        accountsRef.current,
        ensured.account.code,
      )
      if (lineErrors.length) return { errors: lineErrors }

      const entry: JournalEntry = {
        id: uid('je'),
        date: input.date,
        memo: (input.memo || '').trim() || 'Opening balances',
        lines,
        status: 'approved',
        editRequired: false,
        source: 'opening',
        createdAt: new Date().toISOString(),
      }
      const errors = validateEntry(entry)
      if (errors.length) return { errors }

      if (input.clearJournalFirst) {
        documentsRef.current = []
        setDocuments([])
        entriesRef.current = [entry]
        setEntries([entry])
        persistBooks(snapshot({ documents: [], entries: [entry], accounts: accountsRef.current }))
      } else {
        entriesRef.current = [entry, ...entriesRef.current]
        setEntries((prev) => [entry, ...prev])
        persistBooks(snapshot({ entries: entriesRef.current, accounts: accountsRef.current }))
      }

      if (input.setPeriodFrom) {
        setPeriod((prev) => ({ ...prev, from: input.date }))
      }

      return { errors: [], entryId: entry.id }
    },
    [persistBooks, snapshot],
  )

  const clearJournal = useCallback(() => {
    documentsRef.current = []
    entriesRef.current = []
    setDocuments([])
    setEntries([])
    persistBooks(snapshot({ documents: [], entries: [] }))
  }, [persistBooks, snapshot])

  const resetAccounts = useCallback(() => {
    const defaults = DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a }))
    accountsRef.current = defaults
    setChartOfAccounts(defaults)
    setAccounts(defaults)
    persistBooks(snapshot({ accounts: defaults }))
  }, [persistBooks, snapshot])

  const value = useMemo(
    () => ({
      documents,
      entries,
      accounts,
      period,
      settings,
      booksReady,
      persistError,
      setPeriod,
      updateSettings,
      addAccount,
      deleteAccount,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      postSimpleEntry,
      postOpeningBalances,
      clearJournal,
      resetAccounts,
      openaiConfigured,
      googleKeySaved,
      openaiKeySaved,
      saveGoogleKey,
      removeGoogleKey,
      saveOpenAiKey,
      removeOpenAiKey,
      preferredProvider,
    }),
    [
      documents,
      entries,
      accounts,
      period,
      settings,
      booksReady,
      persistError,
      updateSettings,
      addAccount,
      deleteAccount,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      postSimpleEntry,
      postOpeningBalances,
      clearJournal,
      resetAccounts,
      openaiConfigured,
      googleKeySaved,
      openaiKeySaved,
      saveGoogleKey,
      removeGoogleKey,
      saveOpenAiKey,
      removeOpenAiKey,
      preferredProvider,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const DEFAULT_BOOT_SETTINGS = normalizeSettings(null)

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp requires AppProvider')
  return ctx
}
