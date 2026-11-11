import { useState } from 'react'
import { useApp } from '../AppContext'

/** Strong-confirm wipe for journal/docs; optional account reset. */
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
    const ok = window.confirm(
      `Start from scratch?\n\nThis permanently deletes ${entryCount} journal entr${entryCount === 1 ? 'y' : 'ies'}` +
        (docCount ? ` and ${docCount} document${docCount === 1 ? '' : 's'}` : '') +
        `.\n\nLedger, T-Accounts, Trial Balance, Income Statement, and Balance Sheet will be empty.\n\nCompany name and chart of accounts are kept.\n\nThis cannot be undone.`,
    )
    if (!ok) return
    const again = window.confirm('Confirm again: wipe ALL journal entries and linked documents?')
    if (!again) return
    clearJournal()
    setNotice('Journal cleared. All statements are empty.')
  }

  function onResetAccounts() {
    setNotice(null)
    const ok = window.confirm(
      'Reset chart of accounts to the default starter list?\n\nCustom accounts you added will be removed. Company name and journal entries are not changed.\n\nIf journal lines still reference deleted custom accounts, edit or clear those entries.',
    )
    if (!ok) return
    resetAccounts()
    setNotice('Chart of accounts restored to defaults.')
  }

  return (
    <div className={`clear-books ${compact ? 'compact' : ''}`}>
      {!compact && (
        <p className="muted" style={{ marginTop: 0 }}>
          Wipe the books to enter fresh data. Defaults keep your company name and accounts.
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
