import { useMemo, useState } from 'react'
import {
  accountTypeLabel,
  buildGeneralLedger,
  journalRefMap,
} from '../accounting'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { StatementHeader } from '../components/StatementHeader'
import { useApp } from '../AppContext'
import { formatAmount, formatShortDate } from '../moneyFormat'

export function Ledger() {
  const { entries, period } = useApp()
  const ledger = buildGeneralLedger(entries, period)
  const refs = useMemo(() => journalRefMap(entries, period), [entries, period])
  const [focus, setFocus] = useState(ledger[0]?.code || '1000')
  const account = ledger.find((a) => a.code === focus) || ledger[0]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>General Ledger</h1>
          <p>
            Per-account activity from approved journal entries. Add a line below to post a new
            double-entry that updates every statement.
          </p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PostEntryForm
          title="Post ledger line (creates balancing journal entry)"
          defaultDebit={focus}
          defaultCredit={focus === '1000' ? '4000' : '1000'}
          compact
        />
      </div>

      <div className="books-sheet ledger-sheet">
        <StatementHeader title="General Ledger" variant="ledger" />
        <div className="ledger-meta">
          <label>
            Account Name{' '}
            <select value={account?.code || focus} onChange={(e) => setFocus(e.target.value)}>
              {ledger.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
              {!ledger.length && <option value={focus}>Cash</option>}
            </select>
          </label>
          <div>
            <strong>Account number:</strong> {account?.code || '—'}
          </div>
          <div className="ledger-period">
            Journal Period: {period.from?.slice(0, 4) || '—'}
            {period.to && period.to.slice(0, 4) !== period.from?.slice(0, 4)
              ? `–${period.to.slice(0, 4)}`
              : ''}
          </div>
        </div>

        <table className="gl-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Description</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th className="num">Balance</th>
              <th>Journal Reference</th>
              <th>Account Code</th>
            </tr>
          </thead>
          <tbody>
            {(account?.lines || []).map((line, idx) => (
              <tr key={`${account?.code}_${idx}`}>
                <td>{idx + 1}</td>
                <td>{formatShortDate(line.date)}</td>
                <td>{line.memo}</td>
                <td className="num">{line.debit ? formatAmount(line.debit, true) : ''}</td>
                <td className="num">{line.credit ? formatAmount(line.credit, true) : ''}</td>
                <td className="num">{formatAmount(line.balance, true)}</td>
                <td>{refs.get(line.entryId) || ''}</td>
                <td>{account ? accountTypeLabel(account.type) : ''}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 6 - (account?.lines.length || 0)) }).map((_, i) => (
              <tr key={`empty_${i}`} className="empty-row">
                <td>{(account?.lines.length || 0) + i + 1}</td>
                <td colSpan={7} />
              </tr>
            ))}
            {!account?.lines.length && (
              <tr>
                <td colSpan={8} className="muted">
                  No posted activity for this account in the period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
