export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  code: string
  name: string
  type: AccountType
}

export interface JournalLine {
  accountCode: string
  debit: number
  credit: number
}

export type EntryStatus = 'draft' | 'approved'

export interface JournalEntry {
  id: string
  date: string
  memo: string
  vendor?: string
  documentId?: string
  lines: JournalLine[]
  status: EntryStatus
  editRequired?: boolean
  source: 'seed' | 'extract' | 'manual'
  createdAt: string
  tax?: number
  category?: string
  extractSource?: 'google' | 'openai' | 'mock'
  extractedFields?: string[]
}

export interface DocumentRecord {
  id: string
  name: string
  mimeType: string
  dataUrl: string
  uploadedAt: string
  extractionStatus: 'pending' | 'extracted' | 'failed'
  editRequired?: boolean
  entryIds: string[]
  lastExtractSource?: 'google' | 'openai' | 'mock'
  lastExtractSummary?: string
}

export interface ExtractResult {
  date?: string
  vendor?: string
  amount: number
  debitAccount?: string
  creditAccount?: string
  memo?: string
  tax?: number
  category?: string
  editRequired: boolean
  source: 'google' | 'openai' | 'mock'
  fields: string[]
}

export interface PeriodFilter {
  from?: string
  to?: string
}
