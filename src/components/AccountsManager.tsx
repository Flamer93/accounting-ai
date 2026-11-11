import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import { ACCOUNT_TYPE_LABELS, accountsSorted } from '../chartOfAccounts'
import type { AccountType } from '../types'

function usageCount(entries: { lines: { accountCode: string }[] }[], code: string): number {
  let n = 0
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountCode === code) n += 1
    }
  }
  return n
}

export function AccountsManager() {
  const { accounts, entries, addAccount, deleteAccount } = useApp()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('expense')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = useMemo(() => accountsSorted(accounts), [accounts])

  function onAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const result = addAccount({ name, type })
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setMessage(`Added “${result.account!.name}”. Dropdowns update immediately.`)
    setName('')
  }

  function onDelete(code: string, accountName: string) {
    setError(null)
    setMessage(null)
    const used = usageCount(entries, code)
    if (used > 0) {
      const force = window.confirm(
        `“${accountName}” is used on ${used} journal line${used === 1 ? '' : 's'}.\n\nForce-remove anyway? Those lines keep the old account until you edit them.`,
      )
      if (!force) return
      const result = deleteAccount(code, { force: true })
      if (result.errors.length) {
        setError(result.errors.join(' · '))
        return
      }
      setMessage(`Removed “${accountName}”.`)
      return
    }
    if (!window.confirm(`Delete account “${accountName}”?`)) return
    const result = deleteAccount(code)
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setMessage(`Removed “${accountName}”.`)
  }

  return (
    <div className="accounts-manager">
      <p className="muted" style={{ marginTop: 0 }}>
        Names only in the UI. Add or remove accounts here — Journal and every statement dropdown
        uses this list.
      </p>

      <form className="post-entry-grid" onSubmit={onAdd} style={{ marginBottom: '1rem' }}>
        <label className="field">
          <span>Account name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Advertising Expense"
            required
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((key) => (
              <option key={key} value={key}>
                {ACCOUNT_TYPE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button className="btn" type="submit">
            Add account
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="table-wrap">
        <table className="ledger accounts-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>In use</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((account) => {
              const used = usageCount(entries, account.code)
              return (
                <tr key={account.code}>
                  <td>{account.name}</td>
                  <td>{ACCOUNT_TYPE_LABELS[account.type]}</td>
                  <td className="muted">{used ? `${used} line${used === 1 ? '' : 's'}` : '—'}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => onDelete(account.code, account.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No accounts yet. Add at least two to post entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
