import { useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import { CHART_OF_ACCOUNTS } from '../chartOfAccounts'
import type { AccountType } from '../types'

interface Props {
  /** Pre-select debit account (e.g. when posting from a T-account / ledger). */
  defaultDebit?: string
  /** Pre-select credit account. */
  defaultCredit?: string
  /** Prefer accounts of this type on the “focus” side. */
  focusType?: AccountType
  title?: string
  compact?: boolean
  onPosted?: (entryId: string) => void
}

/**
 * Shared double-entry composer. Posts an approved balanced journal entry so
 * Journal, Ledger, T-accounts, Trial Balance, IS, and BS all recompute.
 */
export function PostEntryForm({
  defaultDebit = '5200',
  defaultCredit = '1000',
  title = 'Post a journal entry',
  compact = false,
  onPosted,
}: Props) {
  const { postSimpleEntry, period } = useApp()
  const [date, setDate] = useState(period.to || new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [debitAccount, setDebitAccount] = useState(defaultDebit)
  const [creditAccount, setCreditAccount] = useState(defaultCredit)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
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
          <select value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)}>
            {CHART_OF_ACCOUNTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Credit account</span>
          <select value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)}>
            {CHART_OF_ACCOUNTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
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
        <button className="btn" type="submit">
          Post to books
        </button>
        {ok && <span className="badge ok">{ok}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </form>
  )
}
