import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import type { Account } from '../types'

interface Props {
  /** Pre-select debit account (e.g. when posting from a T-account / ledger). */
  defaultDebit?: string
  /** Pre-select credit account. */
  defaultCredit?: string
  title?: string
  compact?: boolean
  onPosted?: (entryId: string) => void
}

function resolveCode(accounts: Account[], preferred?: string): string {
  if (preferred && accounts.some((a) => a.code === preferred)) return preferred
  return accounts[0]?.code || ''
}

/**
 * Shared double-entry composer. Posts an approved balanced journal entry so
 * Journal, Ledger, T-accounts, Trial Balance, IS, and BS all recompute.
 */
export function PostEntryForm({
  defaultDebit,
  defaultCredit,
  title = 'Post a journal entry',
  compact = false,
  onPosted,
}: Props) {
  const { postSimpleEntry, period, accounts } = useApp()
  const [date, setDate] = useState(period.to || period.from || '')
  const [memo, setMemo] = useState('')
  const [debitAccount, setDebitAccount] = useState(() => resolveCode(accounts, defaultDebit || '5200'))
  const [creditAccount, setCreditAccount] = useState(() =>
    resolveCode(accounts, defaultCredit || '1000'),
  )
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    setDebitAccount((prev) => resolveCode(accounts, prev || defaultDebit || '5200'))
    setCreditAccount((prev) => resolveCode(accounts, prev || defaultCredit || '1000'))
  }, [accounts, defaultDebit, defaultCredit])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (!accounts.length) {
      setError('Add accounts in Settings before posting.')
      return
    }
    const result = postSimpleEntry({
      date,
      memo: memo || 'Manual entry',
      debitAccount,
      creditAccount,
      amount: Number(amount),
    })
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setOk(`Posted ${result.entryId} — all books updated.`)
    setAmount('')
    setMemo('')
    onPosted?.(result.entryId!)
  }

  return (
    <form className={`post-entry ${compact ? 'compact' : ''}`} onSubmit={onSubmit}>
      <div className="post-entry-head">
        <strong>{title}</strong>
        <span className="muted">Debits one account, credits another — every statement updates.</span>
      </div>
      <div className="post-entry-grid">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Debit account</span>
          <select value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Credit account</span>
          <select value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Description</span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. Paid office rent"
          />
        </label>
      </div>
      <div className="cta-row">
        <button className="btn" type="submit" disabled={accounts.length < 2}>
          Post to books
        </button>
        {ok && <span className="badge ok">{ok}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </form>
  )
}
