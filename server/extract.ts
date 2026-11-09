export interface ExtractPayload {
  date: string
  vendor: string
  amount: number
  debitAccount: string
  creditAccount: string
  memo: string
  editRequired: boolean
  source: 'openai' | 'mock'
}

const MOCK_VENDORS = [
  { vendor: 'Maple Supply Co.', debit: '5200', memo: 'Office supplies purchase' },
  { vendor: 'City Power & Light', debit: '5100', memo: 'Utilities bill' },
  { vendor: 'Transit Pass Hub', debit: '5400', memo: 'Local travel' },
  { vendor: 'Green Bean Cafe', debit: '5300', memo: 'Client meeting meals' },
  { vendor: 'Cloud Desk Soft', debit: '5500', memo: 'Software subscription' },
  { vendor: 'Harbor Hardware', debit: '1500', memo: 'Small equipment purchase' },
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function mockExtract(filename: string, size: number): ExtractPayload {
  const h = hashString(`${filename}:${size}`)
  const pick = MOCK_VENDORS[h % MOCK_VENDORS.length]
  const day = (h % 27) + 1
  const amount = Math.round((25 + (h % 400) + (h % 100) / 100) * 100) / 100
  const date = `2026-02-${String(day).padStart(2, '0')}`

  return {
    date,
    vendor: pick.vendor,
    amount,
    debitAccount: pick.debit,
    creditAccount: '1000',
    memo: pick.memo,
    editRequired: true,
    source: 'mock',
  }
}

function stripDataUrl(dataUrl: string): { mime: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) {
    throw new Error('Expected a base64 data URL')
  }
  return { mime: match[1], base64: match[2] }
}

export async function openaiExtract(dataUrl: string, filename: string): Promise<ExtractPayload> {
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
        content:
          'You extract bookkeeping fields from receipt images. Reply with JSON only using keys: date (YYYY-MM-DD), vendor, amount (number), debitAccount (4-digit code from 1000 Cash, 1100 AR, 1500 Equipment, 2000 AP, 3000 Equity, 4000 Service Revenue, 5000 Rent, 5100 Utilities, 5200 Office Supplies, 5300 Meals, 5400 Travel, 5500 Software), creditAccount (usually 1000 Cash or 2000 AP), memo (short).',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract a journal suggestion from this receipt image named ${filename}.`,
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
  if (!parsed.date || !parsed.vendor || !Number.isFinite(amount)) {
    throw new Error('Incomplete extraction JSON')
  }

  return {
    date: String(parsed.date),
    vendor: String(parsed.vendor),
    amount,
    debitAccount: String(parsed.debitAccount || '5200'),
    creditAccount: String(parsed.creditAccount || '1000'),
    memo: String(parsed.memo || `Purchase from ${parsed.vendor}`),
    editRequired: false,
    source: 'openai',
  }
}

export async function extractFromUpload(opts: {
  filename: string
  size: number
  dataUrl: string
}): Promise<ExtractPayload> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiExtract(opts.dataUrl, opts.filename)
    } catch (err) {
      console.error('OpenAI extract failed, falling back to mock:', err)
      return mockExtract(opts.filename, opts.size)
    }
  }
  return mockExtract(opts.filename, opts.size)
}
