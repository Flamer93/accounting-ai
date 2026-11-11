import type { Account } from './types'

export const CHART_OF_ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset' },
  { code: '1500', name: 'Equipment', type: 'asset' },
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '3000', name: "Owner's Equity", type: 'equity' },
  { code: '3100', name: 'Owner Drawings', type: 'equity' },
  { code: '4000', name: 'Service Revenue', type: 'revenue' },
  { code: '5000', name: 'Rent Expense', type: 'expense' },
  { code: '5100', name: 'Utilities Expense', type: 'expense' },
  { code: '5200', name: 'Office Supplies Expense', type: 'expense' },
  { code: '5300', name: 'Meals & Entertainment', type: 'expense' },
  { code: '5400', name: 'Travel Expense', type: 'expense' },
  { code: '5500', name: 'Software Expense', type: 'expense' },
]

export const accountByCode = (code: string): Account | undefined =>
  CHART_OF_ACCOUNTS.find((a) => a.code === code)

/** User-facing account name only (codes stay on the value / for posting). */
export const accountLabel = (code: string): string => {
  const account = accountByCode(code)
  return account ? account.name : code
}
