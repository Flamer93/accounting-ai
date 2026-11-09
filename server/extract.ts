export type ExtractFieldKey =
  | 'date'
  | 'vendor'
  | 'amount'
  | 'memo'
  | 'debitAccount'
  | 'creditAccount'
  | 'tax'
  | 'category'

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
  source: 'openai' | 'mock'
  fields: ExtractFieldKey[]
}

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
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) {
    throw new Error('Expected a base64 data URL')
  }
  return { mime: match[1], base64: match[2] }
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

export async function openaiExtract(
  dataUrl: string,
  filename: string,
  fields: ExtractFieldKey[],
): Promise<ExtractPayload> {
  const apiKey = process.env.OPENAI_API_KEY
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

  const parsed = JSON.parse(content) as Partial<ExtractPayload>
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
      editRequired: false,
      source: 'openai',
    },
    fields,
  )
}

export async function extractFromUpload(opts: {
  filename: string
  size: number
  dataUrl: string
  fields?: unknown
}): Promise<ExtractPayload> {
  const fields = normalizeFields(opts.fields)
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiExtract(opts.dataUrl, opts.filename, fields)
    } catch (err) {
      console.error('OpenAI extract failed, falling back to mock:', err)
      return mockExtract(opts.filename, opts.size, fields)
    }
  }
  return mockExtract(opts.filename, opts.size, fields)
}
