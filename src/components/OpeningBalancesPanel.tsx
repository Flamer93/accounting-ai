import { useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import { formatMoney } from '../accounting'
import {
  ACCOUNT_TYPE_LABELS,
  OPENING_BALANCE_EQUITY_NAME,
  accountsSorted,
  ensureOpeningBalanceEquity,
} from '../chartOfAccounts'
import type { Account, AccountType } from '../types'

const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function OpeningBalancesPanel({ compact = false }: { compact?: boolean }) {
  const { accounts, period, postOpeningBalances, entries } = useApp()
  const [date, setDate] = useState(period.from || new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('Opening balances')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [clearFirst, setClearFirst] = useState(false)
  const [setPeriodFrom, setSetPeriodFrom] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const { chart, plugCode } = useMemo(() => {
    const ensured = ensureOpeningBalanceEquity(accounts)
    return { chart: accountsSorted(ensured.accounts), plugCode: ensured.account.code }
  }, [accounts])

  const editableAccounts = useMemo(
    () =>
      chart.filter(
        (a) =>
          a.code !== plugCode &&
          a.name.toLowerCase() !== OPENING_BALANCE_EQUITY_NAME.toLowerCase(),
      ),
    [chart, plugCode],
  )

  function setAmount(code: string, value: string) {
    setAmounts((prev) => ({ ...prev, [code]: value }))
  }

  function grouped(): { type: AccountType; accounts: Account[] }[] {
    return TYPE_ORDER.map((type) => ({
      type,
      accounts: editableAccounts.filter((a) => a.type === type),
    })).filter((g) => g.accounts.length > 0)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    const rows = editableAccounts
      .map((a) => ({
        accountCode: a.code,
        amount: Number(amounts[a.code] || 0),
      }))
      .filter((r) => r.amount > 0)

    if (clearFirst && entries.length) {
      const okClear = window.confirm(
        `Clear ${entries.length} journal entr${entries.length === 1 ? 'y' : 'ies'} before posting openings?`,
      )
      if (!okClear) return
    }

    const result = postOpeningBalances({
      date,
      memo,
      amounts: rows,
      clearJournalFirst: clearFirst,
      setPeriodFrom,
    })
    if (result.errors.length) {
      setError(result.errors.join(' · '))
      return
    }

    setOk(`Posted openings${rows.length ? ` (${rows.length} accounts)` : ''}.`)
    setAmounts({})
  }

  return (
    <form className={`opening-balances condensed ${compact ? 'compact' : ''}`} onSubmit={onSubmit}>
      {!compact && (
        <p className="muted settings-lead">
          Starting amounts on the normal side; difference plugs to {OPENING_BALANCE_EQUITY_NAME}{' '}
          (e.g. Cash {formatMoney(1500)}).
        </p>
      )}

      <div className="opening-meta-row">
        <label className="field">
          <span>As-of</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field opening-memo-field">
          <span>Memo</span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Opening balances"
          />
        </label>
      </div>

      <div className="opening-balances-options">
        <label className="check-row">
          <input
            type="checkbox"
            checked={setPeriodFrom}
            onChange={(e) => setSetPeriodFrom(e.target.checked)}
          />
          <span>Set period From to this date</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={clearFirst}
            onChange={(e) => setClearFirst(e.target.checked)}
          />
          <span>Clear journal first</span>
        </label>
      </div>

      <div className="opening-balances-grid condensed">
        {grouped().map((group) => (
          <div key={group.type} className="opening-balances-group">
            <h3 className="opening-balances-type">{ACCOUNT_TYPE_LABELS[group.type]}</h3>
            {group.accounts.map((account) => (
              <label key={account.code} className="opening-amount-row">
                <span>{account.name}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={amounts[account.code] ?? ''}
                  onChange={(e) => setAmount(account.code, e.target.value)}
                  aria-label={`${account.name} opening amount`}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      {!editableAccounts.length && (
        <p className="muted">Add accounts before setting openings.</p>
      )}

      <div className="cta-row">
        <button className="btn" type="submit" disabled={!editableAccounts.length}>
          Post openings
        </button>
        {ok && <span className="badge ok">{ok}</span>}
        {error && <span className="error">{error}</span>}
      </div>
    </form>
  )
}
