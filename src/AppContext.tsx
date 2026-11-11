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
import { validateEntry } from './accounting'
import { apiFetch } from './apiClient'
import {
  accountLabel,
  accountsSorted,
  loadAccounts,
  nextAccountCode,
  saveAccounts,
  setChartOfAccounts,
} from './chartOfAccounts'
import { cascadeRemoveDocument } from './documentCascade'
import {
  clearGoogleApiKey,
  hasGoogleApiKey,
  loadGoogleApiKey,
  saveGoogleApiKey,
} from './googleKey'
import {
  clearOpenAiApiKey,
  hasOpenAiApiKey,
  loadOpenAiApiKey,
  saveOpenAiApiKey,
} from './openaiKey'
import {
  enabledExtractFields,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type AppSettings,
} from './settings'
import { normalizeReceiptImage } from './normalizeReceiptImage'
import {
  loadDocuments,
  loadEntries,
  saveDocuments,
  saveEntries,
  uid,
} from './storage'
import type { Account, AccountType, DocumentRecord, ExtractResult, JournalEntry, PeriodFilter } from './types'

export type ExtractProvider = 'google' | 'openai' | 'mock' | null

interface AppState {
  documents: DocumentRecord[]
  entries: JournalEntry[]
  accounts: Account[]
  period: PeriodFilter
  settings: AppSettings
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_BOOT_SETTINGS)
  const [period, setPeriod] = useState<PeriodFilter>({})
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null)
  const [googleKeySaved, setGoogleKeySaved] = useState(false)
  const [openaiKeySaved, setOpenaiKeySaved] = useState(false)
  const [ready, setReady] = useState(false)
  const documentsRef = useRef(documents)
  const entriesRef = useRef(entries)
  const settingsRef = useRef(settings)
  const accountsRef = useRef(accounts)

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

  useEffect(() => {
    setDocuments(loadDocuments())
    setEntries(loadEntries())
    setAccounts(loadAccounts())
    setSettings(loadSettings())
    setGoogleKeySaved(hasGoogleApiKey())
    setOpenaiKeySaved(hasOpenAiApiKey())
    setReady(true)
    const headers: HeadersInit = {}
    const googleKey = loadGoogleApiKey()
    const openaiKey = loadOpenAiApiKey()
    if (googleKey) headers['X-Google-Api-Key'] = googleKey
    if (openaiKey) headers['X-OpenAI-Api-Key'] = openaiKey
    apiFetch('/api/health', { headers }, 10_000)
      .then((r) => r.json())
      .then((j: { openaiConfigured?: boolean }) => setOpenaiConfigured(Boolean(j.openaiConfigured)))
      .catch(() => setOpenaiConfigured(false))
  }, [])

  useEffect(() => {
    if (!ready) return
    saveDocuments(documents)
  }, [documents, ready])

  useEffect(() => {
    if (!ready) return
    saveEntries(entries)
  }, [entries, ready])

  useEffect(() => {
    if (!ready) return
    saveSettings(settings)
  }, [settings, ready])

  useEffect(() => {
    if (!ready) return
    saveAccounts(accounts)
  }, [accounts, ready])

  const updateSettings = useCallback((next: AppSettings) => {
    const normalized = normalizeSettings(next)
    settingsRef.current = normalized
    saveSettings(normalized)
    setSettings(normalized)
  }, [])

  const saveGoogleKey = useCallback((key: string) => {
    saveGoogleApiKey(key)
    setGoogleKeySaved(hasGoogleApiKey())
  }, [])

  const removeGoogleKey = useCallback(() => {
    clearGoogleApiKey()
    setGoogleKeySaved(false)
  }, [])

  const saveOpenAiKey = useCallback((key: string) => {
    saveOpenAiApiKey(key)
    setOpenaiKeySaved(hasOpenAiApiKey())
  }, [])

  const removeOpenAiKey = useCallback(() => {
    clearOpenAiApiKey()
    setOpenaiKeySaved(false)
  }, [])

  const preferredProvider: ExtractProvider = googleKeySaved
    ? 'google'
    : openaiKeySaved || openaiConfigured
      ? 'openai'
      : openaiConfigured === null && !openaiKeySaved
        ? null
        : 'mock'

  const addDocument = useCallback((file: File, dataUrl: string) => {
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
      saveDocuments(next)
      return next
    })
    return doc
  }, [])

  const extractDocument = useCallback(async (documentId: string) => {
    const doc =
      documentsRef.current.find((d) => d.id === documentId) ||
      loadDocuments().find((d) => d.id === documentId)
    if (!doc) throw new Error('Document not found')

    const fields = enabledExtractFields(settingsRef.current)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const googleKey = loadGoogleApiKey()
    const openaiKey = loadOpenAiApiKey()
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

    setEntries((prev) => [entry, ...prev])
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              extractionStatus: 'extracted',
              editRequired: entry.status !== 'approved' && Boolean(entry.editRequired),
              entryIds: [...d.entryIds, entry.id],
              lastExtractSource: result.source,
              lastExtractSummary: summaryParts.join(' · '),
            }
          : d,
      ),
    )
    return { entry, warning: result.warning }
  }, [])

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

  const deleteDocument = useCallback((documentId: string) => {
    const next = cascadeRemoveDocument(documentsRef.current, entriesRef.current, documentId)
    documentsRef.current = next.documents
    entriesRef.current = next.entries
    saveDocuments(next.documents)
    saveEntries(next.entries)
    setDocuments(next.documents)
    setEntries(next.entries)
  }, [])

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

  const value = useMemo(
    () => ({
      documents,
      entries,
      accounts,
      period,
      settings,
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
