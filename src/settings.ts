export type NavViewKey =
  | 'journal'
  | 'ledger'
  | 'tAccounts'
  | 'trialBalance'
  | 'balanceSheet'
  | 'incomeStatement'

export type ExtractFieldKey =
  | 'date'
  | 'vendor'
  | 'amount'
  | 'memo'
  | 'debitAccount'
  | 'creditAccount'
  | 'tax'
  | 'category'

export interface AppSettings {
  companyName: string
  nav: Record<NavViewKey, boolean>
  extractFields: Record<ExtractFieldKey, boolean>
}

export const NAV_VIEW_META: { key: NavViewKey; label: string; path: string }[] = [
  { key: 'journal', label: 'Journal', path: '/journal' },
  { key: 'ledger', label: 'Ledger', path: '/ledger' },
  { key: 'tAccounts', label: 'T-Accounts', path: '/t-accounts' },
  { key: 'trialBalance', label: 'Trial Balance', path: '/trial-balance' },
  { key: 'balanceSheet', label: 'Balance Sheet', path: '/balance-sheet' },
  { key: 'incomeStatement', label: 'Income Statement', path: '/income-statement' },
]

export const EXTRACT_FIELD_META: {
  key: ExtractFieldKey
  label: string
  description: string
  locked?: boolean
}[] = [
  { key: 'amount', label: 'Amount', description: 'Required for every entry.', locked: true },
  { key: 'date', label: 'Date', description: 'Transaction date from the receipt.' },
  { key: 'vendor', label: 'Vendor', description: 'Merchant or payee name.' },
  { key: 'memo', label: 'Memo', description: 'Short description of the purchase.' },
  { key: 'debitAccount', label: 'Debit account', description: 'Suggested debit account code.' },
  { key: 'creditAccount', label: 'Credit account', description: 'Suggested credit account code.' },
  { key: 'tax', label: 'Tax', description: 'Sales tax amount if present.' },
  { key: 'category', label: 'Category', description: 'Free-form spend category label.' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "Paul's Guitar Shop, Inc.",
  nav: {
    journal: true,
    ledger: true,
    tAccounts: true,
    trialBalance: true,
    balanceSheet: true,
    incomeStatement: true,
  },
  extractFields: {
    date: true,
    vendor: true,
    amount: true,
    memo: true,
    debitAccount: true,
    creditAccount: true,
    tax: false,
    category: false,
  },
}

const SETTINGS_KEY = 'receipt-ledger:settings'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function normalizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const nav = { ...DEFAULT_SETTINGS.nav, ...(raw?.nav ?? {}) }
  const extractFields = { ...DEFAULT_SETTINGS.extractFields, ...(raw?.extractFields ?? {}) }
  extractFields.amount = true
  if (!extractFields.debitAccount && !extractFields.creditAccount) {
    extractFields.debitAccount = true
    extractFields.creditAccount = true
  }
  const companyName =
    typeof raw?.companyName === 'string' && raw.companyName.trim()
      ? raw.companyName.trim()
      : DEFAULT_SETTINGS.companyName
  return { companyName, nav, extractFields }
}

export function loadSettings(): AppSettings {
  return normalizeSettings(readJson<Partial<AppSettings> | null>(SETTINGS_KEY, null))
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)))
}

export function enabledExtractFields(settings: AppSettings): ExtractFieldKey[] {
  return (Object.keys(settings.extractFields) as ExtractFieldKey[]).filter(
    (key) => settings.extractFields[key],
  )
}

/** Apply a field toggle with required-minimum enforcement. Returns null if blocked. */
export function toggleExtractField(
  settings: AppSettings,
  key: ExtractFieldKey,
  enabled: boolean,
): { settings: AppSettings; error?: string } {
  if (key === 'amount' && !enabled) {
    return { settings, error: 'Amount is required for extraction.' }
  }
  const nextFields = { ...settings.extractFields, [key]: enabled, amount: true }
  if (!nextFields.debitAccount && !nextFields.creditAccount) {
    return {
      settings,
      error: 'Keep at least one of debit account or credit account enabled.',
    }
  }
  return { settings: normalizeSettings({ ...settings, extractFields: nextFields }) }
}

export function toggleNavView(settings: AppSettings, key: NavViewKey, enabled: boolean): AppSettings {
  return normalizeSettings({
    ...settings,
    nav: { ...settings.nav, [key]: enabled },
  })
}
