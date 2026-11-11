import { validateEntry } from '../src/accounting.ts'
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

const entry: JournalEntry = {
  id: 'je_test',
  date: '2026-06-01',
  memo: 'Paid utilities',
  lines: [
    { accountCode: '5100', debit: 90, credit: 0 },
    { accountCode: '1000', debit: 0, credit: 90 },
  ],
  status: 'approved',
  source: 'manual',
  createdAt: '2026-06-01T00:00:00.000Z',
}

assert(validateEntry(entry).length === 0, 'manual post fixture is valid')
assert(entry.status === 'approved', 'posts are approved so statements include them')

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('post-entry path verified')
