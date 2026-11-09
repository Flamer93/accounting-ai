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
import { cascadeRemoveDocument } from './documentCascade'
import {
  clearGoogleApiKey,
  hasGoogleApiKey,
  loadGoogleApiKey,
  saveGoogleApiKey,
} from './googleKey'
import {
  enabledExtractFields,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type AppSettings,
} from './settings'
import {
  loadDocuments,
  loadEntries,
  saveDocuments,
  saveEntries,
  uid,
} from './storage'
import type { DocumentRecord, ExtractResult, JournalEntry, PeriodFilter } from './types'

export type ExtractProvider = 'google' | 'openai' | 'mock' | null

interface AppState {
  documents: DocumentRecord[]
  entries: JournalEntry[]
  period: PeriodFilter
  settings: AppSettings
  setPeriod: (period: PeriodFilter) => void
  updateSettings: (next: AppSettings) => void
  addDocument: (file: File, dataUrl: string) => DocumentRecord
  extractDocument: (documentId: string) => Promise<ExtractOutcome>
  deleteDocument: (documentId: string) => void
  updateEntry: (entry: JournalEntry) => string[]
  approveEntry: (entryId: string) => string[]
  deleteEntry: (entryId: string) => void
  addManualEntry: () => string
  openaiConfigured: boolean | null
  googleKeySaved: boolean
  saveGoogleKey: (key: string) => void
  removeGoogleKey: () => void
  preferredProvider: ExtractProvider
}

const Ctx = createContext<AppState | null>(null)

function entryFromExtract(docId: string, result: ExtractResult): JournalEntry {
  const amount = Number(result.amount) || 0
  const debit = result.debitAccount || '5200'
  const credit = result.creditAccount || '1000'
  return {
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
    editRequired: result.editRequired || result.source === 'mock',
    source: 'extract',
    createdAt: new Date().toISOString(),
    tax: result.tax,
    category: result.category,
    extractSource: result.source,
    extractedFields: result.fields,
  }
}

export type ExtractOutcome = {
  entry: JournalEntry
  warning?: string
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_BOOT_SETTINGS)
  const [period, setPeriod] = useState<PeriodFilter>({ from: '2026-01-01', to: '2026-12-31' })
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null)
  const [googleKeySaved, setGoogleKeySaved] = useState(false)
  const [ready, setReady] = useState(false)
  const documentsRef = useRef(documents)
  const entriesRef = useRef(entries)
  const settingsRef = useRef(settings)

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
    setDocuments(loadDocuments())
    setEntries(loadEntries())
    setSettings(loadSettings())
    setGoogleKeySaved(hasGoogleApiKey())
    setReady(true)
    const headers: HeadersInit = {}
    const googleKey = loadGoogleApiKey()
    if (googleKey) headers['X-Google-Api-Key'] = googleKey
    fetch('/api/health', { headers })
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

  const preferredProvider: ExtractProvider = googleKeySaved
    ? 'google'
    : openaiConfigured
      ? 'openai'
      : openaiConfigured === null
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
    // Send via header and body so a proxy that strips custom headers still works
    if (googleKey) headers['X-Google-Api-Key'] = googleKey

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dataUrl: doc.dataUrl,
        filename: doc.name,
        size: doc.dataUrl.length,
        fields,
        ...(googleKey ? { googleApiKey: googleKey } : {}),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, extractionStatus: 'failed' } : d)),
      )
      throw new Error((err as { error?: string }).error || 'Extract failed')
    }
    const result = (await res.json()) as ExtractResult
    if (googleKey && result.source === 'mock') {
      throw new Error(
        'Google key was sent but the server returned a mock extract. Check that /api/extract received the key.',
      )
    }
    const entry = entryFromExtract(doc.id, result)
    const sourceLabel =
      result.source === 'google' ? 'Google extract' : result.source === 'openai' ? 'OpenAI extract' : 'Mock extract'
    const summaryParts = [
      sourceLabel,
      `$${Number(result.amount).toFixed(2)}`,
      result.vendor,
      result.memo,
      result.warning,
    ].filter(Boolean)

    setEntries((prev) => [entry, ...prev])
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              extractionStatus: 'extracted',
              editRequired: entry.editRequired,
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

  const approveEntry = useCallback((entryId: string) => {
    const entry = entriesRef.current.find((e) => e.id === entryId)
    if (!entry) return ['Entry not found']
    const errors = validateEntry(entry)
    if (errors.length) return errors
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, status: 'approved', editRequired: false } : e,
      ),
    )
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

  const addManualEntry = useCallback(() => {
    const id = uid('je')
    const fields = settingsRef.current.extractFields
    const entry: JournalEntry = {
      id,
      date: new Date().toISOString().slice(0, 10),
      memo: '',
      lines: [
        { accountCode: '5200', debit: 0, credit: 0 },
        { accountCode: '1000', debit: 0, credit: 0 },
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

  const value = useMemo(
    () => ({
      documents,
      entries,
      period,
      settings,
      setPeriod,
      updateSettings,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      openaiConfigured,
      googleKeySaved,
      saveGoogleKey,
      removeGoogleKey,
      preferredProvider,
    }),
    [
      documents,
      entries,
      period,
      settings,
      updateSettings,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      openaiConfigured,
      googleKeySaved,
      saveGoogleKey,
      removeGoogleKey,
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
