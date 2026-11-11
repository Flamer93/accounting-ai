import type { DocumentRecord, JournalEntry } from './types'

/**
 * Seed/demo data removed — the app opens as a blank books template.
 * Kept as an empty factory so older imports/scripts do not break.
 */
export function createSeedData(): { documents: DocumentRecord[]; entries: JournalEntry[] } {
  return { documents: [], entries: [] }
}
