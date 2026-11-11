import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildTrialBalance } from '../accounting'
import { CHART_OF_ACCOUNTS } from '../chartOfAccounts'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { StatementHeader } from '../components/StatementHeader'
import { useApp } from '../AppContext'
import { formatAmount } from '../moneyFormat'

/**
 * Trial Balance is primarily a proof report. Editable “adjust” posts a balancing
 * journal entry (selected account vs offset) so the books stay double-entry.
 */
export function TrialBalance() {
  const { entries, period, postSimpleEntry } = useApp()
  const { rows, totalDebit, totalCredit } = buildTrialBalance(entries, period)
  const [adjustCode, setAdjustCode] = useState('')
  const [adjustSide, setAdjustSide] = useState<'debit' | 'credit'>('debit')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [offset, setOffset] = useState('1000')
  const [msg, setMsg] = useState<string | null>(null)

  function applyAdjust() {
    setMsg(null)
    if (!adjustCode) {
      setMsg('Pick an account to adjust.')
      return
    }
    const amount = Number(adjustAmount)
    if (!(amount > 0)) {
      setMsg('Enter a positive amount.')
      return
    }
    const debitAccount = adjustSide === 'debit' ? adjustCode : offset
    const creditAccount = adjustSide === 'debit' ? offset : adjustCode
    const result = postSimpleEntry({
      date: period.to || period.from || new Date().toISOString().slice(0, 10),
      memo: `Trial balance adjustment · ${adjustCode}`,
      debitAccount,
      creditAccount,
      amount,
    })
    if (result.errors.length) {
      setMsg(result.errors.join(' · '))
      return
    }
    setMsg(`Posted ${result.entryId}. All statements updated.`)
    setAdjustAmount('')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Trial Balance</h1>
          <p>
            Proof that debits equal credits. Adjustments below post journal entries — they do not
            edit cells in isolation.
          </p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PostEntryForm title="Post from trial balance" compact />
        <div className="tb-adjust">
          <strong>Careful adjust</strong>
          <span className="muted">
            Increases one account and offsets another (usually Cash) via a new journal entry.
          </span>
          <div className="post-entry-grid">
            <label className="field">
              <span>Account</span>
              <select value={adjustCode} onChange={(e) => setAdjustCode(e.target.value)}>
                <option value="">Select…</option>
                {CHART_OF_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Side</span>
              <select
                value={adjustSide}
                onChange={(e) => setAdjustSide(e.target.value as 'debit' | 'credit')}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Offset account</span>
              <select value={offset} onChange={(e) => setOffset(e.target.value)}>
                {CHART_OF_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cta-row">
            <button className="btn secondary" type="button" onClick={applyAdjust}>
              Post adjustment
            </button>
            {msg && <span className="muted">{msg}</span>}
          </div>
        </div>
      </div>

      <div className="books-sheet tb-sheet">
        <StatementHeader title="Unadjusted Trial Balance" variant="green" asOf />
        <table className="tb-classic">
          <thead>
            <tr>
              <th>Account</th>
              <th className="num underline-head">Debit</th>
              <th className="num underline-head">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.code}>
                <td>{row.name}</td>
                <td className="num">
                  {row.debit ? formatAmount(row.debit, idx === 0 || rows.findIndex((r) => r.debit) === idx) : ''}
                </td>
                <td className="num">
                  {row.credit
                    ? formatAmount(
                        row.credit,
                        rows.findIndex((r) => r.credit) === idx,
                      )
                    : ''}
                </td>
              </tr>
            ))}
            <tr className="tb-totals">
              <td>
                <strong>Totals</strong>
              </td>
              <td className="num double-rule">
                <strong>{formatAmount(totalDebit, true)}</strong>
              </td>
              <td className="num double-rule">
                <strong>{formatAmount(totalCredit, true)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {!rows.length && (
          <p className="muted" style={{ padding: '1rem' }}>
            Empty trial balance — no posted entries yet.{' '}
            <Link to="/journal">Post in the Journal</Link> to fill this format.
          </p>
        )}
        {rows.length > 0 && totalDebit !== totalCredit && (
          <p className="error" style={{ padding: '0 1rem 1rem' }}>
            Out of balance — check journal entries.
          </p>
        )}
      </div>
    </div>
  )
}
