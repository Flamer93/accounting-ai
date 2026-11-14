import { useState, type FormEvent } from 'react'
import { useCompany } from '../CompanyContext'
import { useApp } from '../AppContext'

/**
 * Create / rename / switch / delete companies. Each company keeps its own books.
 */
export function CompaniesPanel() {
  const { companies, companyId, switchCompany, createCompany, renameCompany, deleteCompany } =
    useCompany()
  const { settings, updateSettings } = useApp()
  const [newName, setNewName] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const created = createCompany(newName)
      setNewName('')
      setMessage(`Created “${created.name}” and switched to it.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create company')
    }
  }

  function onRenameActive(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      const name = renameDraft.trim() || settings.companyName.trim()
      if (!name) {
        setError('Enter a company name.')
        return
      }
      const updated = renameCompany(companyId, name)
      updateSettings({ ...settings, companyName: updated.name })
      setRenameDraft('')
      setMessage(`Renamed to “${updated.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename company')
    }
  }

  function onDelete(id: string, name: string) {
    setError(null)
    setMessage(null)
    if (companies.length <= 1) {
      setError('Keep at least one company.')
      return
    }
    const ok = window.confirm(
      `Delete “${name}”?\n\nIts journal, accounts, and saved journals will be removed from this device.`,
    )
    if (!ok) return
    try {
      deleteCompany(id)
      setMessage(`Deleted “${name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete company')
    }
  }

  return (
    <div className="companies-panel">
      <p className="muted settings-lead">
        Each company keeps its own books, settings, openings, and saved journals. API keys stay on
        this device and are shared.
      </p>

      <label className="field">
        <span>Active company</span>
        <select
          value={companyId}
          onChange={(e) => {
            setError(null)
            setMessage(null)
            switchCompany(e.target.value)
            setMessage('Switched company.')
          }}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <form className="settings-form companies-rename-form" onSubmit={onRenameActive}>
        <label className="field">
          <span>Rename active company</span>
          <input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            placeholder={settings.companyName.trim() || 'Company name'}
          />
        </label>
        <button type="submit" className="btn secondary">
          Rename
        </button>
      </form>

      <form className="settings-form companies-create-form" onSubmit={onCreate}>
        <label className="field">
          <span>New company</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Homick Consulting"
          />
        </label>
        <button type="submit" className="btn">
          Add company
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>Company</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  {c.id === companyId ? <span className="muted"> · active</span> : null}
                </td>
                <td className="num journal-saves-actions">
                  {c.id !== companyId && (
                    <button
                      type="button"
                      className="btn secondary btn-compact"
                      onClick={() => {
                        switchCompany(c.id)
                        setMessage(`Switched to “${c.name}”.`)
                      }}
                    >
                      Switch
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn danger btn-compact"
                    disabled={companies.length <= 1}
                    onClick={() => onDelete(c.id, c.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
