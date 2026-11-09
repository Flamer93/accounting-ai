import { mockExtract, normalizeFields } from '../server/extract.ts'
import {
  DEFAULT_SETTINGS,
  enabledExtractFields,
  normalizeSettings,
  toggleExtractField,
  toggleNavView,
} from '../src/settings.ts'

let failed = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

const blockedAmount = toggleExtractField(DEFAULT_SETTINGS, 'amount', false)
assert(blockedAmount.error, 'amount cannot be disabled')

const bothOff = toggleExtractField(
  { ...DEFAULT_SETTINGS, extractFields: { ...DEFAULT_SETTINGS.extractFields, creditAccount: false } },
  'debitAccount',
  false,
)
assert(bothOff.error, 'cannot disable last account side')

const taxOn = toggleExtractField(DEFAULT_SETTINGS, 'tax', true)
assert(taxOn.settings.extractFields.tax === true, 'tax can be enabled')

const navOff = toggleNavView(DEFAULT_SETTINGS, 'ledger', false)
assert(navOff.nav.ledger === false, 'ledger nav can hide')
assert(navOff.nav.journal === true, 'other nav stays')

const fields = enabledExtractFields(
  normalizeSettings({
    extractFields: {
      ...DEFAULT_SETTINGS.extractFields,
      vendor: false,
      memo: false,
      tax: true,
      category: true,
      creditAccount: false,
    },
  }),
)
assert(!fields.includes('vendor'), 'vendor excluded')
assert(fields.includes('amount'), 'amount included')
assert(fields.includes('debitAccount'), 'debit kept')
assert(!fields.includes('creditAccount'), 'credit excluded')
assert(fields.includes('tax') && fields.includes('category'), 'optional fields included')

const normalizedServer = normalizeFields(['amount', 'vendor', 'tax'])
assert(normalizedServer.includes('amount'), 'server forces amount')
assert(
  normalizedServer.includes('debitAccount') || normalizedServer.includes('creditAccount'),
  'server forces an account side',
)

const mock = mockExtract('receipt.png', 1200, normalizedServer)
assert(mock.source === 'mock', 'mock source')
assert(typeof mock.amount === 'number', 'amount present')
assert(mock.vendor !== undefined, 'vendor present when requested')
assert(mock.memo === undefined, 'memo omitted when not requested')
assert(mock.tax !== undefined, 'tax present when requested')
assert(mock.fields.includes('tax'), 'fields list includes tax')

if (failed) {
  console.error(`${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('settings + extract field verify passed')
