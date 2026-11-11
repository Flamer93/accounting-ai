import { accountByCode, accountLabel, getChartOfAccounts } from './chartOfAccounts'
import type { AccountType, JournalEntry, JournalLine, PeriodFilter } from './types'

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function lineTotals(lines: JournalLine[]): { debit: number; credit: number } {
  return lines.reduce(
    (acc, line) => ({
      debit: roundMoney(acc.debit + (line.debit || 0)),
      credit: roundMoney(acc.credit + (line.credit || 0)),
    }),
    { debit: 0, credit: 0 },
  )
}

export function isBalanced(lines: JournalLine[]): boolean {
  const { debit, credit } = lineTotals(lines)
  return debit > 0 && debit === credit
}

export function validateEntry(entry: Pick<JournalEntry, 'date' | 'lines'>): string[] {
  const errors: string[] = []
  const chart = getChartOfAccounts()
  if (!entry.date) errors.push('Date is required')
  if (!entry.lines.length) errors.push('At least one line is required')
  for (const line of entry.lines) {
    if (!accountByCode(line.accountCode, chart)) {
      errors.push(`Unknown account ${accountLabel(line.accountCode, chart)}`)
    }
    if ((line.debit || 0) < 0 || (line.credit || 0) < 0) {
      errors.push('Amounts cannot be negative')
    }
    if ((line.debit || 0) > 0 && (line.credit || 0) > 0) {
      errors.push('A line cannot have both debit and credit')
    }
  }
  if (!isBalanced(entry.lines)) {
    errors.push('Debits must equal credits')
  }
  return errors
}

export function inPeriod(date: string, period?: PeriodFilter): boolean {
  if (!period) return true
  if (period.from && date < period.from) return false
  if (period.to && date > period.to) return false
  return true
}

export function approvedEntries(entries: JournalEntry[], period?: PeriodFilter): JournalEntry[] {
  return entries
    .filter((e) => e.status === 'approved' && inPeriod(e.date, period))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

export interface LedgerLine {
  date: string
  entryId: string
  memo: string
  debit: number
  credit: number
  balance: number
}

export interface LedgerAccount {
  code: string
  name: string
  type: AccountType
  lines: LedgerLine[]
  debitTotal: number
  creditTotal: number
  balance: number
}

function normalBalanceSign(type: AccountType): 1 | -1 {
  return type === 'asset' || type === 'expense' ? 1 : -1
}

export function buildGeneralLedger(entries: JournalEntry[], period?: PeriodFilter): LedgerAccount[] {
  const approved = approvedEntries(entries, period)
  const map = new Map<string, LedgerAccount>()

  for (const account of getChartOfAccounts()) {
    map.set(account.code, {
      code: account.code,
      name: account.name,
      type: account.type,
      lines: [],
      debitTotal: 0,
      creditTotal: 0,
      balance: 0,
    })
  }

  for (const entry of approved) {
    for (const line of entry.lines) {
      const ledger = map.get(line.accountCode)
      if (!ledger) continue
      const sign = normalBalanceSign(ledger.type)
      const delta = (line.debit || 0) - (line.credit || 0)
      ledger.debitTotal = roundMoney(ledger.debitTotal + (line.debit || 0))
      ledger.creditTotal = roundMoney(ledger.creditTotal + (line.credit || 0))
      ledger.balance = roundMoney(ledger.balance + delta * sign)
      ledger.lines.push({
        date: entry.date,
        entryId: entry.id,
        memo: entry.memo || entry.vendor || '',
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: ledger.balance,
      })
    }
  }

  return [...map.values()].filter((a) => a.lines.length > 0 || a.debitTotal > 0 || a.creditTotal > 0)
}

export interface TrialBalanceRow {
  code: string
  name: string
  type: AccountType
  debit: number
  credit: number
}

export function buildTrialBalance(entries: JournalEntry[], period?: PeriodFilter): {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
} {
  const ledger = buildGeneralLedger(entries, period)
  const rows: TrialBalanceRow[] = []

  for (const account of ledger) {
    const raw = account.debitTotal - account.creditTotal
    if (raw === 0) continue
    if (raw > 0) {
      rows.push({
        code: account.code,
        name: account.name,
        type: account.type,
        debit: roundMoney(raw),
        credit: 0,
      })
    } else {
      rows.push({
        code: account.code,
        name: account.name,
        type: account.type,
        debit: 0,
        credit: roundMoney(-raw),
      })
    }
  }

  const totalDebit = roundMoney(rows.reduce((s, r) => s + r.debit, 0))
  const totalCredit = roundMoney(rows.reduce((s, r) => s + r.credit, 0))
  return { rows, totalDebit, totalCredit }
}

export interface StatementSection {
  label: string
  rows: { code: string; name: string; amount: number }[]
  total: number
}

export function buildIncomeStatement(entries: JournalEntry[], period?: PeriodFilter): {
  revenue: StatementSection
  expenses: StatementSection
  netIncome: number
} {
  const ledger = buildGeneralLedger(entries, period)
  const revenueRows = ledger
    .filter((a) => a.type === 'revenue')
    .map((a) => ({ code: a.code, name: a.name, amount: a.balance }))
  const expenseRows = ledger
    .filter((a) => a.type === 'expense')
    .map((a) => ({ code: a.code, name: a.name, amount: a.balance }))

  const revenueTotal = roundMoney(revenueRows.reduce((s, r) => s + r.amount, 0))
  const expenseTotal = roundMoney(expenseRows.reduce((s, r) => s + r.amount, 0))

  return {
    revenue: { label: 'Revenue', rows: revenueRows, total: revenueTotal },
    expenses: { label: 'Expenses', rows: expenseRows, total: expenseTotal },
    netIncome: roundMoney(revenueTotal - expenseTotal),
  }
}

export function buildBalanceSheet(entries: JournalEntry[], period?: PeriodFilter): {
  assets: StatementSection
  liabilities: StatementSection
  equity: StatementSection
  totalAssets: number
  totalLiabilitiesAndEquity: number
} {
  const ledger = buildGeneralLedger(entries, period)
  const income = buildIncomeStatement(entries, period)

  const assets = ledger
    .filter((a) => a.type === 'asset')
    .map((a) => ({ code: a.code, name: a.name, amount: a.balance }))
  const liabilities = ledger
    .filter((a) => a.type === 'liability')
    .map((a) => ({ code: a.code, name: a.name, amount: a.balance }))
  const equityAccounts = ledger
    .filter((a) => a.type === 'equity')
    .map((a) => ({ code: a.code, name: a.name, amount: a.balance }))

  if (income.netIncome !== 0) {
    equityAccounts.push({
      code: '3900',
      name: 'Net Income (current period)',
      amount: income.netIncome,
    })
  }

  const totalAssets = roundMoney(assets.reduce((s, r) => s + r.amount, 0))
  const totalLiabilities = roundMoney(liabilities.reduce((s, r) => s + r.amount, 0))
  const totalEquity = roundMoney(equityAccounts.reduce((s, r) => s + r.amount, 0))

  return {
    assets: { label: 'Assets', rows: assets, total: totalAssets },
    liabilities: { label: 'Liabilities', rows: liabilities, total: totalLiabilities },
    equity: { label: 'Equity', rows: equityAccounts, total: totalEquity },
    totalAssets,
    totalLiabilitiesAndEquity: roundMoney(totalLiabilities + totalEquity),
  }
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n)
}

/** Stable journal references J1, J2… by approved chronological order. */
export function journalRefMap(entries: JournalEntry[], period?: PeriodFilter): Map<string, string> {
  const approved = approvedEntries(entries, period)
  const map = new Map<string, string>()
  approved.forEach((entry, idx) => {
    map.set(entry.id, `J${idx + 1}`)
  })
  return map
}

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'asset':
      return 'Asset'
    case 'liability':
      return 'Liability'
    case 'equity':
      return 'Equity'
    case 'revenue':
      return 'Revenue'
    case 'expense':
      return 'Expense'
    default:
      return type
  }
}
