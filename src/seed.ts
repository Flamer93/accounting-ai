import type { DocumentRecord, JournalEntry } from './types'

function receiptSvg(vendor: string, amount: string, date: string, accent: string): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f3eb"/>
      <stop offset="100%" stop-color="#ebe4d6"/>
    </linearGradient>
  </defs>
  <rect width="420" height="560" fill="url(#g)"/>
  <rect x="28" y="28" width="364" height="504" rx="8" fill="#fffdf8" stroke="${accent}" stroke-width="2"/>
  <text x="210" y="90" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#1a1f1c">${vendor}</text>
  <text x="210" y="126" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#5c655e">RECEIPT</text>
  <line x1="60" y1="150" x2="360" y2="150" stroke="#d7d0c4" stroke-width="1"/>
  <text x="60" y="190" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#3a403c">Date: ${date}</text>
  <text x="60" y="230" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#3a403c">Item: Business purchase</text>
  <text x="60" y="290" font-family="Georgia, serif" font-size="34" fill="${accent}">${amount}</text>
  <text x="60" y="340" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#6b746e">Thank you for your business</text>
  <rect x="60" y="380" width="300" height="10" rx="4" fill="#e8e1d4"/>
  <rect x="60" y="404" width="220" height="10" rx="4" fill="#e8e1d4"/>
  <rect x="60" y="428" width="260" height="10" rx="4" fill="#e8e1d4"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function createSeedData(): { documents: DocumentRecord[]; entries: JournalEntry[] } {
  const now = new Date().toISOString()

  const docs: DocumentRecord[] = [
    {
      id: 'doc_seed_office',
      name: 'office-depot-supplies.svg',
      mimeType: 'image/svg+xml',
      dataUrl: receiptSvg('Office Harbor', '$84.50', '2026-01-08', '#3d8b6e'),
      uploadedAt: now,
      extractionStatus: 'extracted',
      entryIds: ['je_seed_1'],
    },
    {
      id: 'doc_seed_rent',
      name: 'studio-rent-january.svg',
      mimeType: 'image/svg+xml',
      dataUrl: receiptSvg('North Loft Studio', '$1,200.00', '2026-01-01', '#2f5d50'),
      uploadedAt: now,
      extractionStatus: 'extracted',
      entryIds: ['je_seed_2'],
    },
    {
      id: 'doc_seed_software',
      name: 'design-tools-subscription.svg',
      mimeType: 'image/svg+xml',
      dataUrl: receiptSvg('Pixel Forge', '$49.00', '2026-01-12', '#1f6f8b'),
      uploadedAt: now,
      extractionStatus: 'extracted',
      entryIds: ['je_seed_3'],
    },
  ]

  const entries: JournalEntry[] = [
    {
      id: 'je_seed_0',
      date: '2026-01-01',
      memo: 'Owner capital contribution',
      vendor: 'Owner',
      lines: [
        { accountCode: '1000', debit: 5000, credit: 0 },
        { accountCode: '3000', debit: 0, credit: 5000 },
      ],
      status: 'approved',
      source: 'seed',
      createdAt: now,
    },
    {
      id: 'je_seed_1',
      date: '2026-01-08',
      memo: 'Printer paper and pens',
      vendor: 'Office Harbor',
      documentId: 'doc_seed_office',
      lines: [
        { accountCode: '5200', debit: 84.5, credit: 0 },
        { accountCode: '1000', debit: 0, credit: 84.5 },
      ],
      status: 'approved',
      source: 'seed',
      createdAt: now,
    },
    {
      id: 'je_seed_2',
      date: '2026-01-01',
      memo: 'January studio rent',
      vendor: 'North Loft Studio',
      documentId: 'doc_seed_rent',
      lines: [
        { accountCode: '5000', debit: 1200, credit: 0 },
        { accountCode: '1000', debit: 0, credit: 1200 },
      ],
      status: 'approved',
      source: 'seed',
      createdAt: now,
    },
    {
      id: 'je_seed_3',
      date: '2026-01-12',
      memo: 'Design tools subscription',
      vendor: 'Pixel Forge',
      documentId: 'doc_seed_software',
      lines: [
        { accountCode: '5500', debit: 49, credit: 0 },
        { accountCode: '1000', debit: 0, credit: 49 },
      ],
      status: 'approved',
      source: 'seed',
      createdAt: now,
    },
    {
      id: 'je_seed_4',
      date: '2026-01-15',
      memo: 'Client project payment',
      vendor: 'Brightside Co.',
      lines: [
        { accountCode: '1000', debit: 2500, credit: 0 },
        { accountCode: '4000', debit: 0, credit: 2500 },
      ],
      status: 'approved',
      source: 'seed',
      createdAt: now,
    },
    {
      id: 'je_seed_5',
      date: '2026-01-18',
      memo: 'Client lunch — review required',
      vendor: 'Cedar Table',
      lines: [
        { accountCode: '5300', debit: 62.4, credit: 0 },
        { accountCode: '1000', debit: 0, credit: 62.4 },
      ],
      status: 'draft',
      editRequired: true,
      source: 'seed',
      createdAt: now,
    },
  ]

  return { documents: docs, entries }
}
