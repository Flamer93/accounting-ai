/**
 * Confirms statement engines only include approved entries, blank seed is empty,
 * and approving a balanced entry surfaces it on T-accounts / TB / BS / IS.
 */
import {
  approvedEntries,
  buildBalanceSheet,
  buildGeneralLedger,
  buildIncomeStatement,
  buildTrialBalance,
  validateEntry,
} from '../src/accounting.ts'
import { createSeedData } from '../src/seed.ts'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings.ts'
import type { JournalEntry } from '../src/types.ts'

let failed = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

const period = { from: '2026-01-01', to: '2026-12-31' }
const { documents, entries: seedEntries } = createSeedData()
assert(documents.length === 0, 'blank template has no seed documents')
assert(seedEntries.length === 0, 'blank template has no seed journal entries')
assert(DEFAULT_SETTINGS.companyName === '', 'default company name is blank')
assert(normalizeSettings(null).companyName === '', 'normalized settings keep blank company')

assert(buildGeneralLedger([], period).length === 0, 'empty books → empty ledger')
assert(buildTrialBalance([], period).rows.length === 0, 'empty books → empty trial balance')
assert(buildIncomeStatement([], period).netIncome === 0, 'empty books → zero net income')
assert(buildBalanceSheet([], period).totalAssets === 0, 'empty books → zero assets')

const draftOnly: JournalEntry[] = [
  {
    id: 'je_draft_only',
    date: '2026-03-15',
    memo: 'Should not post',
    vendor: 'Hidden Cafe',
    lines: [
      { accountCode: '5300', debit: 42, credit: 0 },
      { accountCode: '1000', debit: 0, credit: 42 },
    ],
    status: 'draft',
    editRequired: true,
    source: 'extract',
    createdAt: '2026-03-15T12:00:00.000Z',
    extractSource: 'mock',
  },
]

assert(validateEntry(draftOnly[0]).length === 0, 'draft-only fixture is balanced/valid')
assert(approvedEntries(draftOnly, period).length === 0, 'drafts excluded from approvedEntries')
assert(buildGeneralLedger(draftOnly, period).length === 0, 'drafts excluded from T-accounts/ledger')

const posted: JournalEntry = {
  ...draftOnly[0],
  id: 'je_posted_cafe',
  status: 'approved',
  editRequired: false,
}

const afterExpense = buildIncomeStatement([posted], period).expenses.total
assert(afterExpense === 42, 'approving a balanced entry increases IS expenses')

const tb = buildTrialBalance([posted], period)
assert(tb.rows.some((r) => r.code === '5300'), 'trial balance includes Meals after approve')
assert(tb.totalDebit === tb.totalCredit, 'trial balance stays in balance after approve')

const tAccounts = buildGeneralLedger([posted], period)
const meals = tAccounts.find((a) => a.code === '5300')
assert(Boolean(meals?.lines.some((l) => l.debit === 42)), 'T-accounts show posted debit')

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('blank template + statement posting path verified')
