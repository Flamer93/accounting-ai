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
    setMessage(`Added “${result.account!.name}”.`)
    setName('')
  }

  function onDelete(code: string, accountName: string) {
    setError(null)
    setMessage(null)
    const used = usageCount(entries, code)
    if (used > 0) {
      const force = window.confirm(
        `“${accountName}” is used on ${used} journal line${used === 1 ? '' : 's'}.\n\nForce-remove anyway?`,
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
    if (!window.confirm(`Delete “${accountName}”?`)) return
    const result = deleteAccount(code)
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setMessage(`Removed “${accountName}”.`)
  }

  return (
    <div className="accounts-manager condensed">
      <form className="coa-add-row" onSubmit={onAdd}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          required
          aria-label="Account name"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          aria-label="Account type"
        >
          {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((key) => (
            <option key={key} value={key}>
              {ACCOUNT_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
        <button className="btn btn-compact" type="submit">
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="table-wrap">
        <table className="ledger accounts-table condensed">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Use</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((account) => {
              const used = usageCount(entries, account.code)
              return (
                <tr key={account.code}>
                  <td>{account.name}</td>
                  <td className="muted">{ACCOUNT_TYPE_LABELS[account.type]}</td>
                  <td className="muted">{used || '—'}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn danger btn-compact"
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
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
