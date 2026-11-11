import type { Account, AccountType } from './types'

/** Contra plug for opening-balance journal entries (debit/credit to keep books balanced). */
export const OPENING_BALANCE_EQUITY_CODE = '3200'
export const OPENING_BALANCE_EQUITY_NAME = 'Opening Balance Equity'

export const DEFAULT_CHART_OF_ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset' },
  { code: '1500', name: 'Equipment', type: 'asset' },
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '3000', name: "Owner's Equity", type: 'equity' },
  { code: '3100', name: 'Owner Drawings', type: 'equity' },
  { code: OPENING_BALANCE_EQUITY_CODE, name: OPENING_BALANCE_EQUITY_NAME, type: 'equity' },
  { code: '4000', name: 'Service Revenue', type: 'revenue' },
  { code: '5000', name: 'Rent Expense', type: 'expense' },
  { code: '5100', name: 'Utilities Expense', type: 'expense' },
  { code: '5200', name: 'Office Supplies Expense', type: 'expense' },
  { code: '5300', name: 'Meals & Entertainment', type: 'expense' },
  { code: '5400', name: 'Travel Expense', type: 'expense' },
  { code: '5500', name: 'Software Expense', type: 'expense' },
]

/** @deprecated Prefer getChartOfAccounts() — kept as alias for default list. */
export const CHART_OF_ACCOUNTS = DEFAULT_CHART_OF_ACCOUNTS

const ACCOUNTS_KEY = 'receipt-ledger:accounts'

let liveChart: Account[] = [...DEFAULT_CHART_OF_ACCOUNTS]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
}

export function getChartOfAccounts(): Account[] {
  return liveChart
}

export function setChartOfAccounts(accounts: Account[]): void {
  liveChart = normalizeAccounts(accounts)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function normalizeAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a }))
  }
  const out: Account[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const code = String(rec.code || '').trim()
    const name = String(rec.name || '').trim()
    const type = String(rec.type || '').trim() as AccountType
    if (!code || !name) continue
    if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type)) continue
    if (seen.has(code)) continue
    seen.add(code)
    out.push({ code, name, type })
  }
  return out.length ? out : DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({ ...a }))
}

export function loadAccounts(): Account[] {
  const loaded = normalizeAccounts(readJson<unknown>(ACCOUNTS_KEY, null))
  liveChart = loaded
  return loaded.map((a) => ({ ...a }))
}

export function saveAccounts(accounts: Account[]): void {
  const normalized = normalizeAccounts(accounts)
  liveChart = normalized
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(normalized))
}

export function accountByCode(code: string, chart = liveChart): Account | undefined {
  return chart.find((a) => a.code === code)
}

/** User-facing account name only (codes stay on the value / for posting). */
export function accountLabel(code: string, chart = liveChart): string {
  const account = accountByCode(code, chart)
  return account ? account.name : code
}

const TYPE_CODE_BASE: Record<AccountType, number> = {
  asset: 1000,
  liability: 2000,
  equity: 3000,
  revenue: 4000,
  expense: 5000,
}

/** Generate next free internal code in the type's thousand range. */
export function nextAccountCode(type: AccountType, chart: Account[] = liveChart): string {
  const base = TYPE_CODE_BASE[type]
  const used = new Set(chart.map((a) => a.code))
  for (let n = base; n < base + 1000; n += 10) {
    const code = String(n)
    if (!used.has(code)) return code
  }
  for (let n = base; n < base + 1000; n++) {
    const code = String(n)
    if (!used.has(code)) return code
  }
  return `${base}_${crypto.randomUUID().slice(0, 4)}`
}

export function accountsSorted(chart: Account[] = liveChart): Account[] {
  return [...chart].sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name))
}

/** Ensure Opening Balance Equity exists so opening posts can balance (idempotent). */
export function ensureOpeningBalanceEquity(chart: Account[]): {
  accounts: Account[]
  created: boolean
  account: Account
} {
  const existing = chart.find((a) => a.code === OPENING_BALANCE_EQUITY_CODE)
  if (existing) {
    return { accounts: accountsSorted(chart), created: false, account: existing }
  }
  const byName = chart.find(
    (a) => a.type === 'equity' && a.name.toLowerCase() === OPENING_BALANCE_EQUITY_NAME.toLowerCase(),
  )
  if (byName) {
    return { accounts: accountsSorted(chart), created: false, account: byName }
  }
  const account: Account = {
    code: OPENING_BALANCE_EQUITY_CODE,
    name: OPENING_BALANCE_EQUITY_NAME,
    type: 'equity',
  }
  return { accounts: accountsSorted([...chart, account]), created: true, account }
}
