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
}

const GOOGLE_SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
])

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

function stripDataUrl(dataUrl: string): { mime: string; base64: string } {
  const base64Match = /^data:([^;,]+(?:;[^;,]+)*)?;base64,(.+)$/s.exec(dataUrl)
  if (base64Match) {
    const mime = base64Match[1].split(';')[0].trim()
    return { mime, base64: base64Match[2] }
  }

  // Seed demos and some browsers use URL-encoded (non-base64) data URLs
  const plainMatch = /^data:([^;,]+(?:;[^;,]+)*)?,(.*)$/s.exec(dataUrl)
  if (plainMatch) {
    const mime = (plainMatch[1] || 'application/octet-stream').split(';')[0].trim()
    const decoded = decodeURIComponent(plainMatch[2])
    return { mime, base64: Buffer.from(decoded, 'utf8').toString('base64') }
  }

  throw new Error('Expected a data URL image')
}

function fieldPrompt(fields: ExtractFieldKey[]): string {
  const specs: Record<ExtractFieldKey, string> = {
    date: 'date (YYYY-MM-DD)',
    vendor: 'vendor (string)',
    amount: 'amount (number)',
    memo: 'memo (short string)',
    debitAccount:
      'debitAccount (4-digit code from 1000 Cash, 1100 AR, 1500 Equipment, 2000 AP, 3000 Equity, 4000 Service Revenue, 5000 Rent, 5100 Utilities, 5200 Office Supplies, 5300 Meals, 5400 Travel, 5500 Software)',
    creditAccount: 'creditAccount (usually 1000 Cash or 2000 AP)',
    tax: 'tax (number, sales tax if present, else 0)',
    category: 'category (short spend category label)',
  }
  return fields.map((f) => specs[f]).join(', ')
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

async function callGeminiModel(
  model: string,
  apiKey: string,
  mime: string,
  base64: string,
  prompt: string,
): Promise<Response> {
  // Prefer header auth so the key never appears in the request URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
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
    }),
  })
}

export async function googleExtract(
  dataUrl: string,
  filename: string,
  fields: ExtractFieldKey[],
  apiKey: string,
): Promise<ExtractPayload> {
  if (!apiKey.trim()) throw new Error('Google API key is empty')

  const { mime, base64 } = stripDataUrl(dataUrl)
  const normalizedMime = mime.toLowerCase().split(';')[0].trim()
  if (!GOOGLE_SUPPORTED_MIME.has(normalizedMime)) {
    throw new Error(
      `Google Gemini does not support ${normalizedMime || 'this file type'}. Upload a JPEG or PNG receipt photo (seed SVG demos cannot use Google extract).`,
    )
  }

  const prompt = `Extract bookkeeping fields from this receipt image named ${filename}. Reply with JSON only (no markdown) using these keys: ${fieldPrompt(fields)}.`

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError = 'Google Gemini request failed'
  for (const model of models) {
    const response = await callGeminiModel(model, apiKey, normalizedMime, base64, prompt)
    if (!response.ok) {
      const text = sanitizeProviderError(await response.text())
      lastError = `Google Gemini error ${response.status} (${model}): ${text}`
      // Try next model on not-found / unsupported
      if (response.status === 404 || response.status === 400) continue
      throw new Error(lastError)
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }
    if (json.error?.message) {
      lastError = `Google Gemini error (${model}): ${sanitizeProviderError(json.error.message)}`
      continue
    }
    const content = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
    if (!content) {
      lastError = `Empty Google Gemini response (${model})`
      continue
    }
    return toPayload(parseExtractJson(content), fields, 'google', false)
  }

  throw new Error(lastError)
}

export async function openaiExtract(
  dataUrl: string,
  filename: string,
  fields: ExtractFieldKey[],
  apiKey = process.env.OPENAI_API_KEY || '',
): Promise<ExtractPayload> {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const { mime, base64 } = stripDataUrl(dataUrl)

  const body = {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract bookkeeping fields from receipt images. Reply with JSON only using these keys: ${fieldPrompt(fields)}.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract the requested journal fields from this receipt image named ${filename}.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${base64}` },
          },
        ],
      },
    ],
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')

  return toPayload(JSON.parse(content) as Partial<ExtractPayload>, fields, 'openai', false)
}

export async function extractFromUpload(opts: {
  filename: string
  size: number
  dataUrl: string
  fields?: unknown
  googleApiKey?: string
}): Promise<ExtractPayload> {
  const fields = normalizeFields(opts.fields)
  const googleKey = opts.googleApiKey?.trim() || ''

  // When the user supplied a Google key, never silently degrade to mock.
  if (googleKey) {
    try {
      return await googleExtract(opts.dataUrl, opts.filename, fields, googleKey)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google extract failed'
      console.error('Google extract failed:', message)
      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = await openaiExtract(opts.dataUrl, opts.filename, fields)
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

  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiExtract(opts.dataUrl, opts.filename, fields)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OpenAI extract failed'
      console.error('OpenAI extract failed, falling back to mock:', message)
      return {
        ...mockExtract(opts.filename, opts.size, fields),
        warning: `OpenAI failed: ${message}. Using mock.`,
      }
    }
  }

  return mockExtract(opts.filename, opts.size, fields)
}
