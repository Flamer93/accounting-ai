import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { AccountSelect } from '../components/AccountSelect'
import { WorksheetScanPanel } from '../components/WorksheetScanPanel'
import type { Account } from '../types'

type TxKind =
  | 'expense-cash'
  | 'expense-ap'
  | 'revenue-cash'
  | 'owner-invest'
  | 'owner-draw'
  | 'custom'

const KINDS: { id: TxKind; label: string; hint: string }[] = [
  { id: 'expense-cash', label: 'Pay expense', hint: 'Debit expense · Credit Cash' },
  { id: 'expense-ap', label: 'Expense on account', hint: 'Debit expense · Credit AP' },
  { id: 'revenue-cash', label: 'Receive revenue', hint: 'Debit Cash · Credit revenue' },
  { id: 'owner-invest', label: 'Owner investment', hint: 'Debit Cash · Credit equity' },
  { id: 'owner-draw', label: 'Owner drawings', hint: 'Debit drawings · Credit Cash' },
  { id: 'custom', label: 'Custom', hint: 'Pick both accounts' },
]

function firstOfType(accounts: Account[], type: Account['type'], preferred?: string): string {
  if (preferred && accounts.some((a) => a.code === preferred)) return preferred
  return accounts.find((a) => a.type === type)?.code || accounts[0]?.code || ''
}

function resolveSides(
  kind: TxKind,
  category: string,
  payment: string,
): { debit: string; credit: string } {
  switch (kind) {
    case 'revenue-cash':
    case 'owner-invest':
      // Cash (or bank) debited; category is the credit side.
      return { debit: payment, credit: category }
    case 'expense-cash':
    case 'expense-ap':
    case 'owner-draw':
    case 'custom':
    default:
      return { debit: category, credit: payment }
  }
}

/**
 * One place to post typical business transactions through the books.
 */
export function AddTransaction() {
  const { postSimpleEntry, period, accounts } = useApp()
  const [kind, setKind] = useState<TxKind>('expense-cash')
  const [date, setDate] = useState(period.to || period.from || new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState(() => firstOfType(accounts, 'expense', '5200'))
  const [payment, setPayment] = useState(() => firstOfType(accounts, 'asset', '1000'))
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const expenses = useMemo(() => accounts.filter((a) => a.type === 'expense'), [accounts])
  const revenues = useMemo(() => accounts.filter((a) => a.type === 'revenue'), [accounts])
  const assets = useMemo(() => accounts.filter((a) => a.type === 'asset'), [accounts])
  const equities = useMemo(() => accounts.filter((a) => a.type === 'equity'), [accounts])

  const categoryAccounts =
    kind === 'revenue-cash'
      ? revenues
      : kind === 'owner-invest' || kind === 'owner-draw'
        ? equities
        : kind === 'custom'
          ? accounts
          : expenses

  const paymentAccounts =
    kind === 'expense-ap'
      ? accounts.filter((a) => a.type === 'liability')
      : kind === 'custom'
        ? accounts
        : assets

  const preview = resolveSides(kind, category, payment)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (accounts.length < 2) {
      setError('Add accounts in Settings before posting.')
      return
    }
    const sides = resolveSides(kind, category, payment)
    const result = postSimpleEntry({
      date,
      memo: memo || KINDS.find((k) => k.id === kind)?.label || 'Transaction',
      debitAccount: sides.debit,
      creditAccount: sides.credit,
      amount: Number(amount),
    })
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }
    setOk(`Posted ${result.entryId} — journal, ledger, and statements updated.`)
    setAmount('')
    setMemo('')
  }

  return (
    <div className="add-tx-page">
      <div className="page-head">
        <div>
          <h1>Add a transaction</h1>
          <p>
            Record a typical business expense or other entry. It posts straight through the journal
            so every statement stays in sync.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <WorksheetScanPanel />
      </div>

      <div className="panel add-tx-panel">
        <form className="add-tx" onSubmit={onSubmit}>
          <fieldset className="tx-kinds">
            <legend className="sr-only">Transaction type</legend>
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={`tx-kind ${kind === k.id ? 'active' : ''}`}
                onClick={() => {
                  setKind(k.id)
                  if (k.id === 'expense-cash' || k.id === 'expense-ap') {
                    setCategory(firstOfType(accounts, 'expense', category))
                    setPayment(
                      k.id === 'expense-ap'
                        ? firstOfType(accounts, 'liability', '2000')
                        : firstOfType(accounts, 'asset', '1000'),
                    )
                  } else if (k.id === 'revenue-cash') {
                    setCategory(firstOfType(accounts, 'revenue', '4000'))
                    setPayment(firstOfType(accounts, 'asset', '1000'))
                  } else if (k.id === 'owner-invest') {
                    setCategory(firstOfType(accounts, 'equity', '3000'))
                    setPayment(firstOfType(accounts, 'asset', '1000'))
                  } else if (k.id === 'owner-draw') {
                    setCategory(firstOfType(accounts, 'equity', '3100'))
                    setPayment(firstOfType(accounts, 'asset', '1000'))
                  }
                }}
              >
                <strong>{k.label}</strong>
                <span>{k.hint}</span>
              </button>
            ))}
          </fieldset>

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
              <span>
                {kind === 'revenue-cash'
                  ? 'Revenue account'
                  : kind === 'owner-invest' || kind === 'owner-draw'
                    ? 'Equity account'
                    : kind === 'custom'
                      ? 'Debit account'
                      : 'Expense / category'}
              </span>
              <AccountSelect
                accounts={categoryAccounts.length ? categoryAccounts : accounts}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>
                {kind === 'expense-ap'
                  ? 'Payable account'
                  : kind === 'custom'
                    ? 'Credit account'
                    : 'Paid from / received to'}
              </span>
              <AccountSelect
                accounts={paymentAccounts.length ? paymentAccounts : accounts}
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Description</span>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Paid office rent for March"
              />
            </label>
          </div>

          <p className="muted add-tx-preview">
            Will post: debit{' '}
            <strong>{accounts.find((a) => a.code === preview.debit)?.name || preview.debit}</strong>
            {' · '}
            credit{' '}
            <strong>
              {accounts.find((a) => a.code === preview.credit)?.name || preview.credit}
            </strong>
          </p>

          <div className="cta-row">
            <button className="btn" type="submit" disabled={accounts.length < 2}>
              Post to books
            </button>
            <Link className="btn secondary" to="/journal">
              Open journal
            </Link>
            {ok && <span className="badge ok">{ok}</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
