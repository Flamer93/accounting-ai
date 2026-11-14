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
  source: 'seed' | 'extract' | 'manual' | 'opening'
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
  warning?: string
  model?: string
  rawText?: string
  lineItems?: Array<{ description: string; amount?: number }>
}

/** One drafted journal line from a worksheet / narrative transaction-list scan. */
export interface WorksheetEntryDraft {
  date: string
  memo: string
  amount: number
  debitAccount: string
  creditAccount: string
  debitAccountName?: string
  creditAccountName?: string
  vendor?: string
  reference?: string
  /** Client-only: include in bulk post. */
  include?: boolean
  id?: string
}

export interface WorksheetSuggestedAccount {
  name: string
  type: AccountType
  code?: string
}

export interface WorksheetExtractResult {
  entries: WorksheetEntryDraft[]
  suggestedAccounts: WorksheetSuggestedAccount[]
  source: 'google' | 'openai' | 'mock'
  editRequired: boolean
  rawText?: string
  warning?: string
  model?: string
}

export interface PeriodFilter {
  from?: string
  to?: string
}
