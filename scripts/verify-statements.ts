/**
 * Confirms statement engines only include approved entries, and that approving
 * a balanced extract draft surfaces it on T-accounts / TB / BS / IS.
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
const { entries: seedEntries } = createSeedData()

const seedApproved = seedEntries.filter((e) => e.status === 'approved')
const seedDrafts = seedEntries.filter((e) => e.status !== 'approved')
assert(seedApproved.length >= 1, 'seed has approved entries')
assert(seedDrafts.length >= 1, 'seed has at least one draft')

const seedLedger = buildGeneralLedger(seedEntries, period)
assert(seedLedger.length > 0, 'seed approved activity appears on ledger/T-accounts')

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
assert(buildTrialBalance(draftOnly, period).rows.length === 0, 'drafts excluded from trial balance')
assert(
  buildIncomeStatement(draftOnly, period).expenses.total === 0,
  'drafts excluded from income statement totals',
)
assert(buildBalanceSheet(draftOnly, period).assets.total === 0, 'drafts excluded from balance sheet')

const posted: JournalEntry = {
  ...draftOnly[0],
  id: 'je_posted_cafe',
  status: 'approved',
  editRequired: false,
}

const withPosted = [...seedEntries, posted]
const beforeExpense = buildIncomeStatement(seedEntries, period).expenses.total
const afterExpense = buildIncomeStatement(withPosted, period).expenses.total
assert(afterExpense === beforeExpense + 42, 'approving a balanced entry increases IS expenses')

const tb = buildTrialBalance(withPosted, period)
assert(tb.rows.some((r) => r.code === '5300'), 'trial balance includes Meals after approve')
assert(tb.totalDebit === tb.totalCredit, 'trial balance stays in balance after approve')

const tAccounts = buildGeneralLedger(withPosted, period)
const meals = tAccounts.find((a) => a.code === '5300')
assert(Boolean(meals?.lines.some((l) => l.debit === 42)), 'T-accounts show posted debit')

const outsidePeriod: JournalEntry = {
  ...posted,
  id: 'je_outside',
  date: '2025-06-01',
}
const outsideLedger = buildGeneralLedger([...seedEntries, outsidePeriod], period)
const seedCodes = new Set(seedLedger.map((a) => a.code))
assert(
  !outsideLedger.some((a) => a.code === '5300' && !seedCodes.has('5300')),
  'approved entry outside period is filtered out of statements',
)

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('statement posting path verified')
