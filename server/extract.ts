import { isVisionSupportedMime, prepareImageForVision } from './imagePrep.ts'

export type ExtractFieldKey =
  | 'date'
  | 'vendor'
  | 'amount'
  | 'memo'
  | 'debitAccount'
  | 'creditAccount'
  | 'tax'
  | 'category'

export type ExtractSource = 'google' | 'openai' | 'mock'

export interface ReceiptLineItem {
  description: string
  amount?: number
}

export interface ExtractPayload {
  date?: string
  vendor?: string
  amount: number
  debitAccount?: string
  creditAccount?: string
  memo?: string
  tax?: number
  category?: string
  editRequired: boolean
  source: ExtractSource
  fields: ExtractFieldKey[]
  /** Present when a preferred provider failed and a lower-priority provider was used. */
  warning?: string
  /** Gemini / OpenAI model id that produced the result. */
  model?: string
  /** Full OCR pass transcript — forces the model to read the whole image first. */
  rawText?: string
  /** Every purchased line before totals — intermediate evidence for amount/memo. */
  lineItems?: ReceiptLineItem[]
}

type VisionImage = { mime: string; base64: string; label: string }

/**
 * Prefer stronger Pro vision models for OCR, then flash fallbacks.
 * Skip retired 1.5 ids that 404 on v1beta.
 */
export const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-flash-latest',
] as const

const ALL_FIELDS: ExtractFieldKey[] = [
  'date',
  'vendor',
  'amount',
  'memo',
  'debitAccount',
  'creditAccount',
  'tax',
  'category',
]

const MOCK_VENDORS = [
  { vendor: 'Maple Supply Co.', debit: '5200', memo: 'Office supplies purchase', category: 'Supplies' },
  { vendor: 'City Power & Light', debit: '5100', memo: 'Utilities bill', category: 'Utilities' },
  { vendor: 'Transit Pass Hub', debit: '5400', memo: 'Local travel', category: 'Travel' },
  { vendor: 'Green Bean Cafe', debit: '5300', memo: 'Client meeting meals', category: 'Meals' },
  { vendor: 'Cloud Desk Soft', debit: '5500', memo: 'Software subscription', category: 'Software' },
  { vendor: 'Harbor Hardware', debit: '1500', memo: 'Small equipment purchase', category: 'Equipment' },
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function normalizeFields(input?: unknown): ExtractFieldKey[] {
  const requested = Array.isArray(input)
    ? input.filter((f): f is ExtractFieldKey => ALL_FIELDS.includes(f as ExtractFieldKey))
    : [...ALL_FIELDS.filter((f) => f !== 'tax' && f !== 'category')]
  const fields = new Set<ExtractFieldKey>(requested)
  fields.add('amount')
  if (!fields.has('debitAccount') && !fields.has('creditAccount')) {
    fields.add('debitAccount')
    fields.add('creditAccount')
  }
  return ALL_FIELDS.filter((f) => fields.has(f))
}

function pickFields(full: Omit<ExtractPayload, 'fields'>, fields: ExtractFieldKey[]): ExtractPayload {
  const out: ExtractPayload = {
    amount: full.amount,
    editRequired: full.editRequired,
    source: full.source,
    fields,
  }
  for (const key of fields) {
    if (key === 'amount') continue
    const value = full[key]
    if (value !== undefined) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  // Always include defaults for missing account sides so client can build double-entry
  if (!fields.includes('debitAccount')) out.debitAccount = full.debitAccount || '5200'
  if (!fields.includes('creditAccount')) out.creditAccount = full.creditAccount || '1000'
  return out
}

export function mockExtract(filename: string, size: number, fields: ExtractFieldKey[]): ExtractPayload {
  const h = hashString(`${filename}:${size}`)
  const pick = MOCK_VENDORS[h % MOCK_VENDORS.length]
  const day = (h % 27) + 1
  const amount = Math.round((25 + (h % 400) + (h % 100) / 100) * 100) / 100
  const date = `2026-02-${String(day).padStart(2, '0')}`
  const tax = Math.round(amount * 0.08 * 100) / 100

  return pickFields(
    {
      date,
      vendor: pick.vendor,
      amount,
      debitAccount: pick.debit,
      creditAccount: '1000',
      memo: pick.memo,
      tax,
      category: pick.category,
      editRequired: true,
      source: 'mock',
    },
    fields,
  )
}

function fieldPrompt(fields: ExtractFieldKey[]): string {
  const specs: Record<ExtractFieldKey, string> = {
    date: 'date (YYYY-MM-DD — prefer printed transaction/invoice date near the header or footer)',
    vendor: 'vendor (merchant / store / payee name from the header)',
    amount:
      'amount (number — MUST be the final TOTAL / Amount Due / Grand Total charged; never a single early line item or subtotal unless that is the only total on the receipt)',
    memo: 'memo (short description summarizing ALL line items, not only the first one)',
    debitAccount:
      'debitAccount (4-digit code from 1000 Cash, 1100 AR, 1500 Equipment, 2000 AP, 3000 Equity, 4000 Service Revenue, 5000 Rent, 5100 Utilities, 5200 Office Supplies, 5300 Meals, 5400 Travel, 5500 Software)',
    creditAccount: 'creditAccount (usually 1000 Cash or 2000 AP)',
    tax: 'tax (number — sales tax / VAT / GST if shown anywhere on the receipt, else 0)',
    category: 'category (short spend category label based on the full purchase)',
  }
  return fields.map((f) => specs[f]).join(', ')
}

function visionInstructions(filename: string, fields: ExtractFieldKey[]): string {
  return [
    'You are a meticulous receipt OCR and bookkeeping assistant.',
    `Receipt image filename: ${filename}.`,
    'FULL-IMAGE SCAN (mandatory): read the entire image top→bottom and left→right before answering.',
    'Do NOT stop after the header or the first few line items. Tall/long receipts must be read all the way through the footer.',
    'Capture in order: header/vendor, address/phone if present, date/time, EVERY purchased line item, subtotal, discounts, tax, tip/gratuity, TOTAL/amount due, payment method, change, and footer.',
    'If a second image is attached, it is a bottom detail crop of the same receipt — use it to confirm totals/tax/tip/payment that may be small or faint; reconcile with the full image (full image wins on conflicts about which lines exist).',
    'Ignore decorative noise, ads, loyalty QR codes, barcodes-as-art, and unrelated watermarks — but still scan past them.',
    'amount must be the final TOTAL charged (labels like TOTAL, AMOUNT DUE, GRAND TOTAL, BALANCE DUE). Do not use the first line-item price as amount.',
    'If a value is unclear, make the best grounded guess from visible digits/letters — do not invent unrelated merchants or items.',
    'First fill intermediate OCR evidence, then the accounting fields.',
    `Reply with JSON only (no markdown) using ALL of these keys: rawText (string — near-complete transcript of readable text top to bottom), lineItems (array of {description, amount?} for every purchased item, excluding subtotal/tax/tip/total rows), tip (number, 0 if none), ${fieldPrompt(fields)}.`,
  ].join(' ')
}

function visionUserPrompt(hasBottomCrop: boolean): string {
  const parts = [
    'Scan the full receipt image completely (top→bottom, left→right).',
    'Transcribe into rawText, list every line item in lineItems, then fill the accounting fields.',
    'Use the final TOTAL for amount — not the first line.',
  ]
  if (hasBottomCrop) {
    parts.push(
      'A second image is the bottom portion only — use it to verify total, tax, tip, and payment lines.',
    )
  }
  return parts.join(' ')
}

type ParsedVisionJson = Partial<ExtractPayload> & {
  tip?: number
  lineItems?: unknown
  rawText?: unknown
}

function parseExtractJson(content: string): ParsedVisionJson {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed)
  const raw = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(raw) as ParsedVisionJson
}

function normalizeLineItems(raw: unknown): ReceiptLineItem[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const rec = row as Record<string, unknown>
      const description = String(rec.description || rec.name || rec.item || '').trim()
      if (!description) return null
      const amountRaw = rec.amount ?? rec.price ?? rec.total
      const amount = amountRaw === undefined || amountRaw === null ? undefined : Number(amountRaw)
      return {
        description,
        amount: amount !== undefined && Number.isFinite(amount) ? amount : undefined,
      } satisfies ReceiptLineItem
    })
    .filter((row): row is ReceiptLineItem => Boolean(row))
  return items.length ? items : undefined
}

function toPayload(
  parsed: ParsedVisionJson,
  fields: ExtractFieldKey[],
  source: ExtractSource,
  editRequired: boolean,
): ExtractPayload {
  const amount = Number(parsed.amount)
  if (!Number.isFinite(amount)) {
    throw new Error('Incomplete extraction JSON: amount required')
  }
  const taxNum = parsed.tax === undefined || parsed.tax === null ? undefined : Number(parsed.tax)
  const lineItems = normalizeLineItems(parsed.lineItems)
  const rawText = typeof parsed.rawText === 'string' ? parsed.rawText.trim() : undefined
  let memo = parsed.memo ? String(parsed.memo) : ''
  if ((!memo || memo === 'Receipt purchase') && lineItems?.length) {
    memo = lineItems
      .map((i) => i.description)
      .slice(0, 6)
      .join(', ')
  }
  if (!memo) memo = 'Receipt purchase'

  const payload = pickFields(
    {
      date: parsed.date ? String(parsed.date) : new Date().toISOString().slice(0, 10),
      vendor: parsed.vendor ? String(parsed.vendor) : 'Unknown vendor',
      amount,
      debitAccount: String(parsed.debitAccount || '5200'),
      creditAccount: String(parsed.creditAccount || '1000'),
      memo,
      tax: taxNum !== undefined && Number.isFinite(taxNum) ? taxNum : 0,
      category: parsed.category ? String(parsed.category) : 'General',
      editRequired,
      source,
    },
    fields,
  )
  if (rawText) payload.rawText = rawText.slice(0, 8000)
  if (lineItems) payload.lineItems = lineItems
  return payload
}

function prepareVisionImages(dataUrl: string, bottomDataUrl?: string): VisionImage[] {
  const primary = prepareImageForVision(dataUrl)
  const images: VisionImage[] = [
    { mime: primary.mime === 'image/jpg' ? 'image/jpeg' : primary.mime, base64: primary.base64, label: 'full' },
  ]
  if (bottomDataUrl) {
    const bottom = prepareImageForVision(bottomDataUrl)
    images.push({
      mime: bottom.mime === 'image/jpg' ? 'image/jpeg' : bottom.mime,
      base64: bottom.base64,
      label: 'bottom',
    })
  }
  return images
}

function sanitizeProviderError(text: string): string {
  // Strip accidental key-looking query params if an upstream echoes a URL
  return text
    .replace(/key=[^&\s"']+/gi, 'key=REDACTED')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, 'REDACTED')
    .slice(0, 240)
}

const GEMINI_ATTEMPT_TIMEOUT_MS = 90_000
const GEMINI_TOTAL_BUDGET_MS = 180_000
const GEMINI_RETRYABLE = new Set([429, 503])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  images: VisionImage[],
  prompt: string,
  deadlineMs: number,
): Promise<Response> {
  // Prefer header auth so the key never appears in the request URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  for (const image of images) {
    if (image.label === 'bottom') {
      parts.push({
        text: 'Bottom detail crop of the same receipt (totals / tax / tip / payment zone):',
      })
    } else {
      parts.push({ text: 'Full receipt image (scan entirely):' })
    }
    parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } })
  }
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })

  let lastStatusError = `Google Gemini request failed (${model})`
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadlineMs - Date.now()
    if (remaining <= 0) {
      throw new Error(`Google Gemini timed out after ${GEMINI_TOTAL_BUDGET_MS / 1000}s total budget`)
    }
    const attemptTimeout = Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), attemptTimeout)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: controller.signal,
      })
      if (GEMINI_RETRYABLE.has(response.status)) {
        const text = sanitizeProviderError(await response.text())
        lastStatusError = `Google Gemini error ${response.status} (${model}): ${text}`
        const backoff = 500 * 3 ** attempt
        await sleep(Math.min(backoff, Math.max(0, deadlineMs - Date.now())))
        continue
      }
      return response
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Google Gemini timed out after ${Math.round(attemptTimeout / 1000)}s (${model}). Try a smaller JPEG/PNG or retry.`,
        )
      }
      const message = err instanceof Error ? err.message : 'Google Gemini network error'
      // Upstream network blips — brief retry
      lastStatusError = `Google Gemini network error (${model}): ${sanitizeProviderError(message)}`
      const backoff = 500 * 3 ** attempt
      await sleep(Math.min(backoff, Math.max(0, deadlineMs - Date.now())))
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(lastStatusError)
}

export async function googleExtract(
  dataUrl: string,
  filename: string,
  fields: ExtractFieldKey[],
  apiKey: string,
  bottomDataUrl?: string,
): Promise<ExtractPayload> {
  if (!apiKey.trim()) throw new Error('Google API key is empty')

  const images = prepareVisionImages(dataUrl, bottomDataUrl)
  for (const image of images) {
    if (!isVisionSupportedMime(image.mime) || image.mime === 'image/svg+xml') {
      throw new Error(
        `Google Gemini does not support ${image.mime || 'this file type'}. Upload a JPEG or PNG receipt photo (seed SVG demos cannot use Google extract).`,
      )
    }
  }

  const prompt = `${visionInstructions(filename, fields)} ${visionUserPrompt(images.length > 1)}`
  const deadlineMs = Date.now() + GEMINI_TOTAL_BUDGET_MS

  let lastError = 'Google Gemini request failed'
  for (const model of GEMINI_MODEL_FALLBACKS) {
    if (Date.now() >= deadlineMs) {
      throw new Error(`Google Gemini timed out after ${GEMINI_TOTAL_BUDGET_MS / 1000}s total budget`)
    }
    try {
      const response = await callGeminiModel(
        model,
        apiKey,
        images,
        prompt,
        deadlineMs,
      )
      if (!response.ok) {
        const text = sanitizeProviderError(await response.text())
        lastError = `Google Gemini error ${response.status} (${model}): ${text}`
        // Only walk the fallback list for missing/retired model ids
        if (response.status === 404) continue
        throw new Error(lastError)
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        error?: { message?: string }
      }
      if (json.error?.message) {
        lastError = `Google Gemini error (${model}): ${sanitizeProviderError(json.error.message)}`
        if (/not found|not supported/i.test(json.error.message)) continue
        throw new Error(lastError)
      }
      const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
      if (!content) {
        lastError = `Empty Google Gemini response (${model})`
        continue
      }
      const payload = toPayload(parseExtractJson(content), fields, 'google', false)
      return { ...payload, model }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Gemini request failed'
      lastError = message
      // Model-not-found style messages can continue; timeouts / hard errors stop the chain
      if (/error 404|\(404\)|not found/i.test(message) && !/timed out/i.test(message)) {
        continue
      }
      throw err instanceof Error ? err : new Error(message)
    }
  }

  throw new Error(lastError)
}

const OPENAI_ATTEMPT_TIMEOUT_MS = 90_000
const OPENAI_RETRYABLE = new Set([429, 503])

export async function openaiExtract(
  dataUrl: string,
  filename: string,
  fields: ExtractFieldKey[],
  apiKey = process.env.OPENAI_API_KEY || '',
  bottomDataUrl?: string,
): Promise<ExtractPayload> {
  if (!apiKey.trim()) {
    throw new Error('OpenAI API key is empty')
  }

  const images = prepareVisionImages(dataUrl, bottomDataUrl)
  for (const image of images) {
    if (!isVisionSupportedMime(image.mime)) {
      throw new Error(
        `OpenAI vision does not support ${image.mime || 'this file type'}. Upload a JPEG or PNG receipt photo.`,
      )
    }
  }

  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: visionUserPrompt(images.length > 1),
    },
  ]
  for (const image of images) {
    if (image.label === 'bottom') {
      userContent.push({
        type: 'text',
        text: 'Bottom detail crop of the same receipt (totals / tax / tip / payment zone):',
      })
    } else {
      userContent.push({ type: 'text', text: 'Full receipt image (scan entirely):' })
    }
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${image.mime};base64,${image.base64}` },
    })
  }

  const body = JSON.stringify({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: visionInstructions(filename, fields),
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
  })

  let lastError = 'OpenAI request failed'
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OPENAI_ATTEMPT_TIMEOUT_MS)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      })
      if (OPENAI_RETRYABLE.has(response.status)) {
        const text = sanitizeProviderError(await response.text())
        lastError = `OpenAI error ${response.status}: ${text}`
        await sleep(500 * 3 ** attempt)
        continue
      }
      if (!response.ok) {
        const text = sanitizeProviderError(await response.text())
        throw new Error(`OpenAI error ${response.status}: ${text}`)
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('Empty OpenAI response')

      return {
        ...toPayload(parseExtractJson(content), fields, 'openai', false),
        model: 'gpt-4o',
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `OpenAI timed out after ${OPENAI_ATTEMPT_TIMEOUT_MS / 1000}s. Try a smaller JPEG/PNG or retry.`,
        )
      }
      if (err instanceof Error && err.message.startsWith('OpenAI error')) throw err
      lastError = err instanceof Error ? sanitizeProviderError(err.message) : 'OpenAI network error'
      await sleep(500 * 3 ** attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(lastError)
}

export async function extractFromUpload(opts: {
  filename: string
  size: number
  dataUrl: string
  bottomDataUrl?: string
  fields?: unknown
  googleApiKey?: string
  openaiApiKey?: string
}): Promise<ExtractPayload> {
  const fields = normalizeFields(opts.fields)
  const googleKey = opts.googleApiKey?.trim() || ''
  const openaiKey = opts.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ''
  const openaiFromRequest = Boolean(opts.openaiApiKey?.trim())
  const bottom = opts.bottomDataUrl

  // Priority: Google → OpenAI (browser or host) → mock
  if (googleKey) {
    try {
      return await googleExtract(opts.dataUrl, opts.filename, fields, googleKey, bottom)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google extract failed'
      console.error('Google extract failed:', message)
      if (openaiKey) {
        try {
          const openai = await openaiExtract(opts.dataUrl, opts.filename, fields, openaiKey, bottom)
          return {
            ...openai,
            warning: `Google failed: ${message}. Using OpenAI.`,
          }
        } catch (openaiErr) {
          const openaiMessage =
            openaiErr instanceof Error ? openaiErr.message : 'OpenAI extract failed'
          console.error('OpenAI fallback failed:', openaiMessage)
          throw new Error(`Google failed: ${message}`)
        }
      }
      throw new Error(`Google failed: ${message}`)
    }
  }

  if (openaiKey) {
    try {
      return await openaiExtract(opts.dataUrl, opts.filename, fields, openaiKey, bottom)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OpenAI extract failed'
      console.error('OpenAI extract failed:', message)
      // Browser or host key present — never silent-mock
      throw new Error(
        openaiFromRequest || process.env.OPENAI_API_KEY
          ? `OpenAI failed: ${message}`
          : message,
      )
    }
  }

  return mockExtract(opts.filename, opts.size, fields)
}

/** ---- Worksheet / narrative transaction-list extract ---- */

export type WorksheetAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface WorksheetSuggestedAccount {
  name: string
  type: WorksheetAccountType
  /** Optional preferred code; client may assign one. */
  code?: string
}

export interface WorksheetEntryDraft {
  date: string
  memo: string
  amount: number
  debitAccount: string
  creditAccount: string
  debitAccountName?: string
  creditAccountName?: string
  vendor?: string
  reference?: string
}

export interface WorksheetExtractPayload {
  entries: WorksheetEntryDraft[]
  suggestedAccounts: WorksheetSuggestedAccount[]
  source: ExtractSource
  editRequired: boolean
  rawText?: string
  warning?: string
  model?: string
}

function chartPrompt(accounts: Array<{ code: string; name: string; type: string }>): string {
  if (!accounts.length) {
    return '1000 Cash (asset), 1100 Accounts Receivable (asset), 1500 Equipment (asset), 2000 Accounts Payable (liability), 3000 Owner Equity (equity), 3100 Owner Drawings (equity), 4000 Service Revenue (revenue), 5000 Rent Expense, 5100 Utilities Expense, 5200 Office Supplies Expense, 5300 Meals, 5400 Travel / Automobile Expense, 5500 Software (expense)'
  }
  return accounts.map((a) => `${a.code} ${a.name} (${a.type})`).join('; ')
}

function worksheetInstructions(
  filename: string,
  accounts: Array<{ code: string; name: string; type: string }>,
  defaultYear: string,
): string {
  return [
    'You are a meticulous bookkeeping assistant reading a PHOTO of a worksheet / textbook page of narrative business transactions (journalize problems).',
    `Image filename: ${filename}.`,
    'FULL-IMAGE SCAN (mandatory): read the entire page top→bottom. Capture every dated transaction in the list (e.g. Dec. 1, 4, 8…).',
    'Ignore struck-through instruction lines and decorative marks, but still read every transaction narrative.',
    'Carry forward the month heading (e.g. Dec.) onto each day number. If a year is not printed, use ' +
      defaultYear +
      '.',
    'Dates must be YYYY-MM-DD.',
    'Split compound narratives that clearly contain two separate payments (two amounts / two cheques) into SEPARATE entries.',
    'Map accounts to this chart when possible: ' + chartPrompt(accounts) + '.',
    'If the page asks to open a new account (Interest Expense, Kelly Motors payable, Automobile Expense, Advertising, etc.), put it in suggestedAccounts and use a sensible new code in the 5xxx expense / 2xxx liability ranges that does not collide with the chart.',
    'Cash payments (Cheque …) credit Cash. Purchases on Invoice … usually credit Accounts Payable (or a named payable). Owner withdrawals debit Drawings. Revenue/sales debit Cash or AR and credit revenue.',
    'amount must be a positive number (the transaction amount).',
    'Reply with JSON only (no markdown) shaped as:',
    '{"rawText":"…","suggestedAccounts":[{"name":"…","type":"expense|liability|asset|equity|revenue","code":"optional"}],"entries":[{"date":"YYYY-MM-DD","memo":"short description","amount":0,"debitAccount":"code","creditAccount":"code","debitAccountName":"…","creditAccountName":"…","vendor":"optional","reference":"Cheque/Invoice # optional"}]}',
    'Include EVERY transaction you can read. Prefer grounded account titles from the page + chart over inventing unrelated ones.',
  ].join(' ')
}

function normalizeWorksheetEntry(raw: unknown): WorksheetEntryDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const amount = Number(rec.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const debitAccount = String(rec.debitAccount || '').trim()
  const creditAccount = String(rec.creditAccount || '').trim()
  if (!debitAccount || !creditAccount || debitAccount === creditAccount) return null
  let date = String(rec.date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = new Date().toISOString().slice(0, 10)
  }
  const memo = String(rec.memo || rec.description || 'Worksheet entry').trim() || 'Worksheet entry'
  return {
    date,
    memo,
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    debitAccount,
    creditAccount,
    debitAccountName: rec.debitAccountName ? String(rec.debitAccountName) : undefined,
    creditAccountName: rec.creditAccountName ? String(rec.creditAccountName) : undefined,
    vendor: rec.vendor ? String(rec.vendor) : undefined,
    reference: rec.reference ? String(rec.reference) : undefined,
  }
}

function normalizeSuggestedAccounts(raw: unknown): WorksheetSuggestedAccount[] {
  if (!Array.isArray(raw)) return []
  const out: WorksheetSuggestedAccount[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const name = String(rec.name || '').trim()
    const type = String(rec.type || '').trim() as WorksheetAccountType
    if (!name) continue
    if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type)) continue
    const code = rec.code ? String(rec.code).trim() : undefined
    out.push({ name, type, code })
  }
  return out
}

function toWorksheetPayload(
  parsed: Record<string, unknown>,
  source: ExtractSource,
  editRequired: boolean,
): WorksheetExtractPayload {
  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map(normalizeWorksheetEntry).filter((e): e is WorksheetEntryDraft => Boolean(e))
    : []
  if (!entries.length) {
    throw new Error('No journalizable transactions found in the worksheet image')
  }
  const rawText = typeof parsed.rawText === 'string' ? parsed.rawText.trim().slice(0, 12000) : undefined
  return {
    entries,
    suggestedAccounts: normalizeSuggestedAccounts(parsed.suggestedAccounts),
    source,
    editRequired,
    rawText,
  }
}

export function mockWorksheetExtract(
  filename: string,
  size: number,
  defaultYear: string,
): WorksheetExtractPayload {
  const y = /^\d{4}$/.test(defaultYear) ? defaultYear : '2026'
  void hashString(`${filename}:${size}`)
  return {
    source: 'mock',
    editRequired: true,
    suggestedAccounts: [
      { name: 'Automobile Expense', type: 'expense', code: '5600' },
      { name: 'Interest Expense', type: 'expense', code: '5700' },
      { name: 'Advertising Expense', type: 'expense', code: '5800' },
    ],
    rawText: 'Mock worksheet extract (add a Google or OpenAI API key in Settings for live AI scan).',
    entries: [
      {
        date: `${y}-12-01`,
        memo: 'Paid automobile repairs, Cheque 125',
        amount: 50,
        debitAccount: '5600',
        creditAccount: '1000',
        debitAccountName: 'Automobile Expense',
        creditAccountName: 'Cash',
        reference: 'Cheque 125',
      },
      {
        date: `${y}-12-01`,
        memo: 'B. Fenato withdrew cash for personal use, Cheque 126',
        amount: 150,
        debitAccount: '3100',
        creditAccount: '1000',
        debitAccountName: 'Owner Drawings',
        creditAccountName: 'Cash',
        reference: 'Cheque 126',
      },
      {
        date: `${y}-12-04`,
        memo: 'Paid Bell Canada telephone bill, Cheque 128',
        amount: 175,
        debitAccount: '5100',
        creditAccount: '1000',
        debitAccountName: 'Utilities Expense',
        creditAccountName: 'Cash',
        vendor: 'Bell Canada',
        reference: 'Cheque 128',
      },
      {
        date: `${y}-12-08`,
        memo: 'Purchased cleaning supplies from Acme Supply, Invoice 742',
        amount: 120,
        debitAccount: '5200',
        creditAccount: '2000',
        debitAccountName: 'Office Supplies Expense',
        creditAccountName: 'Accounts Payable',
        vendor: 'Acme Supply',
        reference: 'Invoice 742',
      },
      {
        date: `${y}-12-12`,
        memo: 'Paid hydro bill, Cheque 132',
        amount: 290,
        debitAccount: '5100',
        creditAccount: '1000',
        debitAccountName: 'Utilities Expense',
        creditAccountName: 'Cash',
        reference: 'Cheque 132',
      },
      {
        date: `${y}-12-12`,
        memo: 'Paid water bill, Cheque 133',
        amount: 175,
        debitAccount: '5100',
        creditAccount: '1000',
        debitAccountName: 'Utilities Expense',
        creditAccountName: 'Cash',
        reference: 'Cheque 133',
      },
      {
        date: `${y}-12-18`,
        memo: 'Bank interest on loan charged to business account',
        amount: 350,
        debitAccount: '5700',
        creditAccount: '1000',
        debitAccountName: 'Interest Expense',
        creditAccountName: 'Cash',
      },
      {
        date: `${y}-12-31`,
        memo: 'Paid salaries for the rest of the month, Cheque 139',
        amount: 1365,
        debitAccount: '5010',
        creditAccount: '1000',
        debitAccountName: 'Salaries Expense',
        creditAccountName: 'Cash',
        reference: 'Cheque 139',
      },
    ],
  }
}

async function googleWorksheetExtract(
  dataUrl: string,
  filename: string,
  apiKey: string,
  accounts: Array<{ code: string; name: string; type: string }>,
  defaultYear: string,
): Promise<WorksheetExtractPayload> {
  if (!apiKey.trim()) throw new Error('Google API key is empty')
  const images = prepareVisionImages(dataUrl)
  for (const image of images) {
    if (!isVisionSupportedMime(image.mime) || image.mime === 'image/svg+xml') {
      throw new Error(
        `Google Gemini does not support ${image.mime || 'this file type'}. Upload a JPEG or PNG photo.`,
      )
    }
  }
  const prompt = worksheetInstructions(filename, accounts, defaultYear)
  const deadlineMs = Date.now() + GEMINI_TOTAL_BUDGET_MS
  let lastError = 'Google Gemini worksheet extract failed'
  for (const model of GEMINI_MODEL_FALLBACKS) {
    if (Date.now() >= deadlineMs) {
      throw new Error(`Google Gemini timed out after ${GEMINI_TOTAL_BUDGET_MS / 1000}s total budget`)
    }
    try {
      const response = await callGeminiModel(model, apiKey, images, prompt, deadlineMs)
      if (!response.ok) {
        const text = sanitizeProviderError(await response.text())
        lastError = `Google Gemini error ${response.status} (${model}): ${text}`
        if (response.status === 404) continue
        throw new Error(lastError)
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        error?: { message?: string }
      }
      if (json.error?.message) {
        lastError = `Google Gemini error (${model}): ${sanitizeProviderError(json.error.message)}`
        if (/not found|not supported/i.test(json.error.message)) continue
        throw new Error(lastError)
      }
      const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
      if (!content) {
        lastError = `Empty Google Gemini response (${model})`
        continue
      }
      const payload = toWorksheetPayload(parseExtractJson(content) as Record<string, unknown>, 'google', false)
      return { ...payload, model }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Gemini request failed'
      lastError = message
      if (/error 404|\(404\)|not found/i.test(message) && !/timed out/i.test(message)) continue
      throw err instanceof Error ? err : new Error(message)
    }
  }
  throw new Error(lastError)
}

async function openaiWorksheetExtract(
  dataUrl: string,
  filename: string,
  apiKey: string,
  accounts: Array<{ code: string; name: string; type: string }>,
  defaultYear: string,
): Promise<WorksheetExtractPayload> {
  if (!apiKey.trim()) throw new Error('OpenAI API key is empty')
  const images = prepareVisionImages(dataUrl)
  for (const image of images) {
    if (!isVisionSupportedMime(image.mime)) {
      throw new Error(
        `OpenAI vision does not support ${image.mime || 'this file type'}. Upload a JPEG or PNG photo.`,
      )
    }
  }
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: 'Scan this worksheet / transaction-list image completely and return the JSON.' },
  ]
  for (const image of images) {
    userContent.push({ type: 'text', text: 'Worksheet image:' })
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${image.mime};base64,${image.base64}` },
    })
  }
  const body = JSON.stringify({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: worksheetInstructions(filename, accounts, defaultYear),
      },
      { role: 'user', content: userContent },
    ],
  })

  let lastError = 'OpenAI worksheet extract failed'
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OPENAI_ATTEMPT_TIMEOUT_MS)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      })
      if (OPENAI_RETRYABLE.has(response.status)) {
        const text = sanitizeProviderError(await response.text())
        lastError = `OpenAI error ${response.status}: ${text}`
        await sleep(500 * 3 ** attempt)
        continue
      }
      if (!response.ok) {
        const text = sanitizeProviderError(await response.text())
        throw new Error(`OpenAI error ${response.status}: ${text}`)
      }
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('Empty OpenAI response')
      return {
        ...toWorksheetPayload(parseExtractJson(content) as Record<string, unknown>, 'openai', false),
        model: 'gpt-4o',
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `OpenAI timed out after ${OPENAI_ATTEMPT_TIMEOUT_MS / 1000}s. Try a clearer JPEG/PNG or retry.`,
        )
      }
      if (err instanceof Error && err.message.startsWith('OpenAI error')) throw err
      lastError = err instanceof Error ? sanitizeProviderError(err.message) : 'OpenAI network error'
      await sleep(500 * 3 ** attempt)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(lastError)
}

export async function extractWorksheetFromUpload(opts: {
  filename: string
  size: number
  dataUrl: string
  accounts?: Array<{ code: string; name: string; type: string }>
  defaultYear?: string
  googleApiKey?: string
  openaiApiKey?: string
}): Promise<WorksheetExtractPayload> {
  const accounts = Array.isArray(opts.accounts) ? opts.accounts : []
  const defaultYear = String(opts.defaultYear || new Date().getFullYear())
  const googleKey = opts.googleApiKey?.trim() || ''
  const openaiKey = opts.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ''
  const openaiFromRequest = Boolean(opts.openaiApiKey?.trim())

  if (googleKey) {
    try {
      return await googleWorksheetExtract(opts.dataUrl, opts.filename, googleKey, accounts, defaultYear)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google extract failed'
      console.error('Google worksheet extract failed:', message)
      if (openaiKey) {
        try {
          const openai = await openaiWorksheetExtract(
            opts.dataUrl,
            opts.filename,
            openaiKey,
            accounts,
            defaultYear,
          )
          return { ...openai, warning: `Google failed: ${message}. Using OpenAI.` }
        } catch (openaiErr) {
          const openaiMessage =
            openaiErr instanceof Error ? openaiErr.message : 'OpenAI extract failed'
          console.error('OpenAI worksheet fallback failed:', openaiMessage)
          throw new Error(`Google failed: ${message}`)
        }
      }
      throw new Error(`Google failed: ${message}`)
    }
  }

  if (openaiKey) {
    try {
      return await openaiWorksheetExtract(opts.dataUrl, opts.filename, openaiKey, accounts, defaultYear)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OpenAI extract failed'
      console.error('OpenAI worksheet extract failed:', message)
      throw new Error(
        openaiFromRequest || process.env.OPENAI_API_KEY ? `OpenAI failed: ${message}` : message,
      )
    }
  }

  return mockWorksheetExtract(opts.filename, opts.size || opts.dataUrl.length, defaultYear)
}
