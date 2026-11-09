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
  /** Gemini model id that produced the result (Google extracts only). */
  model?: string
}

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
    date: 'date (YYYY-MM-DD — prefer printed transaction/invoice date)',
    vendor: 'vendor (merchant / store / payee name as printed)',
    amount: 'amount (number — final total charged, not subtotal unless that is the only total)',
    memo: 'memo (short description summarizing line items)',
    debitAccount:
      'debitAccount (4-digit code from 1000 Cash, 1100 AR, 1500 Equipment, 2000 AP, 3000 Equity, 4000 Service Revenue, 5000 Rent, 5100 Utilities, 5200 Office Supplies, 5300 Meals, 5400 Travel, 5500 Software)',
    creditAccount: 'creditAccount (usually 1000 Cash or 2000 AP)',
    tax: 'tax (number — sales tax / VAT if shown, else 0)',
    category: 'category (short spend category label)',
  }
  return fields.map((f) => specs[f]).join(', ')
}

function visionInstructions(filename: string, fields: ExtractFieldKey[]): string {
  return [
    'You are a careful receipt OCR and bookkeeping assistant.',
    `Receipt image filename: ${filename}.`,
    'Read the entire receipt carefully, including faint, small, skewed, or low-contrast text.',
    'Identify vendor/merchant, transaction date, line items, subtotal, tax, tip (if any), and grand total.',
    'Ignore decorative noise, ads, loyalty QR codes, and unrelated watermarks.',
    'Prefer the grand total / amount due for "amount". Include sales tax in "tax" when that field is requested.',
    'If a value is unclear, make the best grounded guess from visible digits/letters — do not invent unrelated merchants.',
    `Reply with JSON only (no markdown) using exactly these keys: ${fieldPrompt(fields)}.`,
  ].join(' ')
}

function parseExtractJson(content: string): Partial<ExtractPayload> {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed)
  const raw = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(raw) as Partial<ExtractPayload>
}

function toPayload(
  parsed: Partial<ExtractPayload>,
  fields: ExtractFieldKey[],
  source: ExtractSource,
  editRequired: boolean,
): ExtractPayload {
  const amount = Number(parsed.amount)
  if (!Number.isFinite(amount)) {
    throw new Error('Incomplete extraction JSON: amount required')
  }
  const taxNum = parsed.tax === undefined || parsed.tax === null ? undefined : Number(parsed.tax)
  return pickFields(
    {
      date: parsed.date ? String(parsed.date) : new Date().toISOString().slice(0, 10),
      vendor: parsed.vendor ? String(parsed.vendor) : 'Unknown vendor',
      amount,
      debitAccount: String(parsed.debitAccount || '5200'),
      creditAccount: String(parsed.creditAccount || '1000'),
      memo: parsed.memo ? String(parsed.memo) : 'Receipt purchase',
      tax: taxNum !== undefined && Number.isFinite(taxNum) ? taxNum : 0,
      category: parsed.category ? String(parsed.category) : 'General',
      editRequired,
      source,
    },
    fields,
  )
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
  mime: string,
  base64: string,
  prompt: string,
  deadlineMs: number,
): Promise<Response> {
  // Prefer header auth so the key never appears in the request URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: base64 } },
        ],
      },
    ],
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
): Promise<ExtractPayload> {
  if (!apiKey.trim()) throw new Error('Google API key is empty')

  const prepared = prepareImageForVision(dataUrl)
  const mime = prepared.mime
  if (!isVisionSupportedMime(mime) || mime === 'image/svg+xml') {
    throw new Error(
      `Google Gemini does not support ${mime || 'this file type'}. Upload a JPEG or PNG receipt photo (seed SVG demos cannot use Google extract).`,
    )
  }

  const prompt = visionInstructions(filename, fields)
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
        mime,
        prepared.base64,
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
): Promise<ExtractPayload> {
  if (!apiKey.trim()) {
    throw new Error('OpenAI API key is empty')
  }

  const prepared = prepareImageForVision(dataUrl)
  const mime = prepared.mime === 'image/jpg' ? 'image/jpeg' : prepared.mime
  if (!isVisionSupportedMime(mime)) {
    throw new Error(
      `OpenAI vision does not support ${mime || 'this file type'}. Upload a JPEG or PNG receipt photo.`,
    )
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
        content: [
          {
            type: 'text',
            text: `OCR this receipt carefully and return the structured JSON fields.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${prepared.base64}` },
          },
        ],
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
        ...toPayload(JSON.parse(content) as Partial<ExtractPayload>, fields, 'openai', false),
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
  fields?: unknown
  googleApiKey?: string
  openaiApiKey?: string
}): Promise<ExtractPayload> {
  const fields = normalizeFields(opts.fields)
  const googleKey = opts.googleApiKey?.trim() || ''
  const openaiKey = opts.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ''
  const openaiFromRequest = Boolean(opts.openaiApiKey?.trim())

  // Priority: Google → OpenAI (browser or host) → mock
  if (googleKey) {
    try {
      return await googleExtract(opts.dataUrl, opts.filename, fields, googleKey)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google extract failed'
      console.error('Google extract failed:', message)
      if (openaiKey) {
        try {
          const openai = await openaiExtract(opts.dataUrl, opts.filename, fields, openaiKey)
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
      return await openaiExtract(opts.dataUrl, opts.filename, fields, openaiKey)
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
