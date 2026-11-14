/** Multi-company registry — each company has isolated books/settings/snapshots. */

export type CompanyMeta = {
  id: string
  name: string
  createdAt: string
}

const REGISTRY_KEY = 'receipt-ledger:companies-v1'
const ACTIVE_KEY = 'receipt-ledger:active-company-id'
const LEGACY_USER = 'local'

function newId(): string {
  try {
    return `co_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  } catch {
    return `co_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

function readRegistry(): CompanyMeta[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CompanyMeta[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c) => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.createdAt === 'string',
    )
  } catch {
    return []
  }
}

function writeRegistry(companies: CompanyMeta[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(companies))
}

export function companyBooksKey(companyId: string): string {
  return `receipt-ledger:company:${companyId}:books`
}

export function companySnapshotsKey(companyId: string): string {
  return `receipt-ledger:company:${companyId}:journal-snapshots-v1`
}

export function companyHighlightKey(companyId: string): string {
  return `receipt-ledger:company:${companyId}:journal-highlight-account`
}

function legacyBooksKey(): string {
  return `receipt-ledger:user:${LEGACY_USER}:books`
}

function legacySnapshotsKey(): string {
  return `receipt-ledger:user:${LEGACY_USER}:journal-snapshots-v1`
}

function legacyHighlightKey(): string {
  return `receipt-ledger:user:${LEGACY_USER}:journal-highlight-account`
}

function moveKey(from: string, to: string): void {
  if (from === to) return
  try {
    const raw = localStorage.getItem(from)
    if (raw == null) return
    if (localStorage.getItem(to) == null) {
      localStorage.setItem(to, raw)
    }
  } catch {
    /* ignore */
  }
}

/** Ensure at least one company exists; migrate legacy single-user books. Returns active company id. */
export function ensureCompaniesReady(): string {
  let companies = readRegistry()
  if (!companies.length) {
    let name = 'My Company'
    try {
      const raw = localStorage.getItem(legacyBooksKey())
      if (raw) {
        const parsed = JSON.parse(raw) as { settings?: { companyName?: string } }
        const fromBooks = parsed?.settings?.companyName?.trim()
        if (fromBooks) name = fromBooks
      }
    } catch {
      /* ignore */
    }
    const first: CompanyMeta = {
      id: newId(),
      name,
      createdAt: new Date().toISOString(),
    }
    companies = [first]
    writeRegistry(companies)
    moveKey(legacyBooksKey(), companyBooksKey(first.id))
    moveKey(legacySnapshotsKey(), companySnapshotsKey(first.id))
    moveKey(legacyHighlightKey(), companyHighlightKey(first.id))
    localStorage.setItem(ACTIVE_KEY, first.id)
    return first.id
  }

  let active = localStorage.getItem(ACTIVE_KEY) || ''
  if (!companies.some((c) => c.id === active)) {
    active = companies[0]!.id
    localStorage.setItem(ACTIVE_KEY, active)
  }
  return active
}

export function listCompanies(): CompanyMeta[] {
  ensureCompaniesReady()
  return readRegistry().slice().sort((a, b) => a.name.localeCompare(b.name))
}

export function getActiveCompanyId(): string {
  return ensureCompaniesReady()
}

export function setActiveCompanyId(id: string): void {
  const companies = readRegistry()
  if (!companies.some((c) => c.id === id)) {
    throw new Error('Company not found')
  }
  localStorage.setItem(ACTIVE_KEY, id)
}

export function getCompany(id: string): CompanyMeta | null {
  return readRegistry().find((c) => c.id === id) ?? null
}

export function createCompany(name: string): CompanyMeta {
  ensureCompaniesReady()
  const trimmed = name.trim() || 'New Company'
  const company: CompanyMeta = {
    id: newId(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  }
  const next = [...readRegistry(), company]
  writeRegistry(next)
  // Seed empty books with this company name (defaults filled on first normalize/load).
  try {
    const seed = {
      documents: [],
      entries: [],
      settings: { companyName: trimmed },
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(companyBooksKey(company.id), JSON.stringify(seed))
  } catch {
    /* first load will create defaults */
  }
  return company
}

export function renameCompany(id: string, name: string): CompanyMeta {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Company name is required')
  const companies = readRegistry()
  const idx = companies.findIndex((c) => c.id === id)
  if (idx < 0) throw new Error('Company not found')
  const updated = { ...companies[idx]!, name: trimmed }
  const next = companies.slice()
  next[idx] = updated
  writeRegistry(next)
  // Keep statement header / settings in sync when possible.
  try {
    const key = companyBooksKey(id)
    const raw = localStorage.getItem(key)
    if (raw) {
      const books = JSON.parse(raw) as { settings?: Record<string, unknown> }
      books.settings = { ...(books.settings || {}), companyName: trimmed }
      localStorage.setItem(key, JSON.stringify(books))
    }
  } catch {
    /* ignore */
  }
  return updated
}

export function deleteCompany(id: string): void {
  const companies = readRegistry()
  if (companies.length <= 1) {
    throw new Error('Keep at least one company.')
  }
  if (!companies.some((c) => c.id === id)) {
    throw new Error('Company not found')
  }
  writeRegistry(companies.filter((c) => c.id !== id))
  try {
    localStorage.removeItem(companyBooksKey(id))
    localStorage.removeItem(companySnapshotsKey(id))
    localStorage.removeItem(companyHighlightKey(id))
  } catch {
    /* ignore */
  }
  const active = localStorage.getItem(ACTIVE_KEY)
  if (active === id) {
    const nextActive = readRegistry()[0]!.id
    localStorage.setItem(ACTIVE_KEY, nextActive)
  }
}
