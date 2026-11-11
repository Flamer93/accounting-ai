import {
  DEFAULT_CHART_OF_ACCOUNTS,
  nextAccountCode,
  normalizeAccounts,
} from '../src/chartOfAccounts.ts'

let failed = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

assert(DEFAULT_CHART_OF_ACCOUNTS.length >= 2, 'default chart has accounts')
assert(
  normalizeAccounts([]).length === DEFAULT_CHART_OF_ACCOUNTS.length,
  'empty normalize falls back to defaults',
)

const code = nextAccountCode('expense', DEFAULT_CHART_OF_ACCOUNTS)
assert(/^5\d{3}$/.test(code), `expense code generated in 5xxx range (${code})`)
assert(
  !DEFAULT_CHART_OF_ACCOUNTS.some((a) => a.code === code),
  'generated code is unused',
)

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('accounts chart helpers verified')
