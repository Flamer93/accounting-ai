/**
 * Sanity-check full-receipt vision instructions and image-prep helpers
 * without calling any provider APIs.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let failed = 0
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1
    console.error('FAIL', msg)
  } else {
    console.log('ok', msg)
  }
}

const extractSrc = readFileSync(resolve('server/extract.ts'), 'utf8')
const normalizeSrc = readFileSync(resolve('src/normalizeReceiptImage.ts'), 'utf8')

assert(extractSrc.includes('FULL-IMAGE SCAN'), 'prompt requires full-image scan')
assert(extractSrc.includes('top→bottom'), 'prompt scans top→bottom')
assert(extractSrc.includes('rawText'), 'prompt requires rawText intermediate')
assert(extractSrc.includes('lineItems'), 'prompt requires lineItems intermediate')
assert(/final TOTAL|Grand Total|AMOUNT DUE/i.test(extractSrc), 'prompt prefers final TOTAL for amount')
assert(extractSrc.includes('Do NOT stop after the header'), 'prompt forbids stopping early')
assert(extractSrc.includes('bottomDataUrl'), 'extract accepts bottom detail crop')
assert(extractSrc.includes('visionUserPrompt'), 'shared user prompt for Google/OpenAI')
assert(extractSrc.includes('prepareVisionImages'), 'both providers use prepareVisionImages')

assert(normalizeSrc.includes('MAX_EDGE_TALL'), 'tall receipts get higher max edge')
assert(normalizeSrc.includes('Never crop the primary'), 'primary image is never cropped')
assert(normalizeSrc.includes('BOTTOM_FRACTION') || normalizeSrc.includes('bottom'), 'bottom detail crop for tall receipts')
assert(!normalizeSrc.includes('sx = width / 2'), 'no accidental horizontal crop of primary')

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.log('vision full-scan instructions verified')
