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
  loadDocuments,
  loadEntries,
  saveDocuments,
  saveEntries,
  uid,
} from './storage'
import type { DocumentRecord, ExtractResult, JournalEntry, PeriodFilter } from './types'

interface AppState {
  documents: DocumentRecord[]
  entries: JournalEntry[]
  period: PeriodFilter
  setPeriod: (period: PeriodFilter) => void
  addDocument: (file: File, dataUrl: string) => DocumentRecord
  extractDocument: (documentId: string) => Promise<void>
  deleteDocument: (documentId: string) => void
  updateEntry: (entry: JournalEntry) => string[]
  approveEntry: (entryId: string) => string[]
  deleteEntry: (entryId: string) => void
  addManualEntry: () => string
  openaiConfigured: boolean | null
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [period, setPeriod] = useState<PeriodFilter>({ from: '2026-01-01', to: '2026-12-31' })
  const [openaiConfigured, setOpenaiConfigured] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const documentsRef = useRef(documents)
  const entriesRef = useRef(entries)

  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    setDocuments(loadDocuments())
    setEntries(loadEntries())
    setReady(true)
    fetch('/api/health')
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
      documents.find((d) => d.id === documentId) ||
      loadDocuments().find((d) => d.id === documentId)
    if (!doc) throw new Error('Document not found')

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl: doc.dataUrl,
        filename: doc.name,
        size: doc.dataUrl.length,
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

    const entry: JournalEntry = {
      id: uid('je'),
      date: result.date,
      memo: result.memo,
      vendor: result.vendor,
      documentId: doc.id,
      lines: [
        { accountCode: result.debitAccount, debit: result.amount, credit: 0 },
        { accountCode: result.creditAccount, debit: 0, credit: result.amount },
      ],
      status: 'draft',
      editRequired: result.editRequired || result.source === 'mock',
      source: 'extract',
      createdAt: new Date().toISOString(),
    }

    setEntries((prev) => [entry, ...prev])
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              extractionStatus: 'extracted',
              editRequired: entry.editRequired,
              entryIds: [...d.entryIds, entry.id],
            }
          : d,
      ),
    )
  }, [documents])

  const updateEntry = useCallback((entry: JournalEntry) => {
    const errors = validateEntry(entry)
    if (errors.length) return errors
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...entry, editRequired: false } : e)))
    return []
  }, [])

  const approveEntry = useCallback((entryId: string) => {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return ['Entry not found']
    const errors = validateEntry(entry)
    if (errors.length) return errors
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, status: 'approved', editRequired: false } : e,
      ),
    )
    return []
  }, [entries])

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
    }
    setEntries((prev) => [entry, ...prev])
    return id
  }, [])

  const value = useMemo(
    () => ({
      documents,
      entries,
      period,
      setPeriod,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      openaiConfigured,
    }),
    [
      documents,
      entries,
      period,
      addDocument,
      extractDocument,
      deleteDocument,
      updateEntry,
      approveEntry,
      deleteEntry,
      addManualEntry,
      openaiConfigured,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp requires AppProvider')
  return ctx
}
