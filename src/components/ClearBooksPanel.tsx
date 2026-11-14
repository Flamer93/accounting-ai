import { useState } from 'react'
import { useApp } from '../AppContext'

/** One-click wipe for journal/docs; optional account reset — no confirm dialogs. */
export function ClearBooksPanel({ compact = false }: { compact?: boolean }) {
  const { entries, documents, clearJournal, resetAccounts } = useApp()
  const [notice, setNotice] = useState<string | null>(null)

  function onClearJournal() {
    setNotice(null)
    const entryCount = entries.length
    const docCount = documents.length
    if (!entryCount && !docCount) {
      setNotice('Books are already empty.')
      return
    }
    clearJournal()
    setNotice(
      `Cleared ${entryCount} journal entr${entryCount === 1 ? 'y' : 'ies'}` +
        (docCount ? ` and ${docCount} document${docCount === 1 ? '' : 's'}` : '') +
        '. Statements are empty.',
    )
  }

  function onResetAccounts() {
    setNotice(null)
    resetAccounts()
    setNotice('Chart of accounts restored to defaults.')
  }

  return (
    <div className={`clear-books ${compact ? 'compact' : ''}`}>
      {!compact && (
        <p className="muted" style={{ marginTop: 0 }}>
          Wipe the books to enter fresh data. Actions apply immediately — company name is kept.
        </p>
      )}
      <div className="cta-row">
        <button type="button" className="btn danger" onClick={onClearJournal}>
          Clear journal &amp; start over
        </button>
        <button type="button" className="btn secondary" onClick={onResetAccounts}>
          Reset accounts too
        </button>
      </div>
      {notice && <p className="muted">{notice}</p>}
    </div>
  )
}
