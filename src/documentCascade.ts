import type { DocumentRecord, JournalEntry } from './types'

/** Remove a document and every journal entry tied to it (by documentId or entryIds). */
export function cascadeRemoveDocument(
  documents: DocumentRecord[],
  entries: JournalEntry[],
  documentId: string,
): { documents: DocumentRecord[]; entries: JournalEntry[] } {
  const doc = documents.find((d) => d.id === documentId)
  const linkedIds = new Set<string>(doc?.entryIds ?? [])
  for (const entry of entries) {
    if (entry.documentId === documentId) linkedIds.add(entry.id)
  }
  return {
    documents: documents.filter((d) => d.id !== documentId),
    entries: entries.filter((e) => !linkedIds.has(e.id) && e.documentId !== documentId),
  }
}
