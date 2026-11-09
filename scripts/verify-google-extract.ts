import {
  extractFromUpload,
  GEMINI_MODEL_FALLBACKS,
  mockExtract,
  normalizeFields,
} from '../server/extract.ts'

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const tinySvg =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>',
  ).toString('base64')

let failed = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

assert(
  !GEMINI_MODEL_FALLBACKS.some((m) => m.includes('1.5')),
  'fallback list has no retired gemini-1.5 models',
)
assert(GEMINI_MODEL_FALLBACKS[0] === 'gemini-2.0-flash', 'prefers gemini-2.0-flash first')
console.log('gemini fallbacks:', GEMINI_MODEL_FALLBACKS.join(' → '))

const fields = normalizeFields(['date', 'vendor', 'amount', 'memo', 'debitAccount', 'creditAccount'])

const noKey = await extractFromUpload({
  filename: 'a.png',
  size: 10,
  dataUrl: tinyPng,
  fields,
})
assert(noKey.source === 'mock', 'no key → mock')

let svgError = ''
try {
  await extractFromUpload({
    filename: 'seed.svg',
    size: 10,
    dataUrl: tinySvg,
    fields,
    googleApiKey: 'bad-key-for-test',
  })
} catch (err) {
  svgError = err instanceof Error ? err.message : String(err)
}
assert(svgError.includes('Google failed'), 'SVG + Google key → hard Google error')
assert(!svgError.toLowerCase().includes('aiza'), 'error does not leak key material')
assert(svgError.toLowerCase().includes('svg') || svgError.toLowerCase().includes('jpeg'), 'mentions unsupported type')

let badKeyError = ''
try {
  await extractFromUpload({
    filename: 'receipt.png',
    size: 10,
    dataUrl: tinyPng,
    fields,
    googleApiKey: 'bad-key-for-test',
  })
} catch (err) {
  badKeyError = err instanceof Error ? err.message : String(err)
}
assert(badKeyError.includes('Google failed'), 'bad key + PNG → hard Google error (not silent mock)')
assert(!/aiza[0-9a-z_-]{8}/i.test(badKeyError), 'bad-key error redacts secrets')

const mock = mockExtract('x.png', 1, fields)
assert(mock.source === 'mock', 'direct mock still works')

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('google extract failure path verified')
