import { buildTrialBalance, formatMoney } from '../accounting'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'

export function TrialBalance() {
  const { entries, period } = useApp()
  const { rows, totalDebit, totalCredit } = buildTrialBalance(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Trial Balance</h1>
          <p>Proof that debits equal credits for the selected period.</p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code}>
                  <td>
                    {row.code} · {row.name}
                  </td>
                  <td>{row.type}</td>
                  <td className="num">{row.debit ? formatMoney(row.debit) : ''}</td>
                  <td className="num">{row.credit ? formatMoney(row.credit) : ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <strong>Totals</strong>
                </td>
                <td className="num">
                  <strong>{formatMoney(totalDebit)}</strong>
                </td>
                <td className="num">
                  <strong>{formatMoney(totalCredit)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {totalDebit !== totalCredit && (
          <p className="error">Trial balance is out of balance — check draft or unbalanced entries.</p>
        )}
        {!rows.length && <p className="muted">No approved balances in this period.</p>}
      </div>
    </div>
  )
}
