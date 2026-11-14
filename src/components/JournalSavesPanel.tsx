import { useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import { formatShortDate } from '../moneyFormat'

export function JournalSavesPanel() {
  const {
    period,
    entries,
    journalSnapshots,
    saveJournalForDate,
    restoreJournalSnapshot,
    deleteJournalSnapshot,
  } = useApp()
  const [asOfDate, setAsOfDate] = useState(
    () => period.from || new Date().toISOString().slice(0, 10),
  )
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const result = saveJournalForDate({ asOfDate, name: name.trim() || undefined })
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    const count = result.snapshot?.entries.length ?? entries.length
    setMessage(`Saved “${result.snapshot!.name}” (${count} entries).`)
    setName('')
  }

  function onRestore(id: string, label: string) {
    setError(null)
    setMessage(null)
    const result = restoreJournalSnapshot(id)
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setMessage(`Restored “${label}”.`)
  }

  function onDelete(id: string, label: string) {
    setError(null)
    setMessage(null)
    deleteJournalSnapshot(id)
    setMessage(`Deleted “${label}”.`)
  }

  return (
    <div className="journal-saves">
      <p className="muted settings-lead">
        Save the current journal for a date, then restore it later from this list.
      </p>

      <form className="journal-saves-form" onSubmit={onSave}>
        <label className="field">
          <span>Date</span>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>Name (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Month-end March"
          />
        </label>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn">
            Save journal
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="table-wrap">
        <table className="ledger journal-saves-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Entries</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {journalSnapshots.map((snap) => (
              <tr key={snap.id}>
                <td>{formatShortDate(snap.asOfDate)}</td>
                <td>{snap.name}</td>
                <td className="muted">{snap.entries.length}</td>
                <td className="num journal-saves-actions">
                  <button
                    type="button"
                    className="btn secondary btn-compact"
                    onClick={() => onRestore(snap.id, snap.name)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="btn danger btn-compact"
                    onClick={() => onDelete(snap.id, snap.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!journalSnapshots.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No saved journals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
