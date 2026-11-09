import { buildGeneralLedger, formatMoney } from '../accounting'
import { BooksPostingHint } from '../components/BooksPostingHint'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'

export function Ledger() {
  const { entries, period } = useApp()
  const ledger = buildGeneralLedger(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>General Ledger</h1>
          <p>Account-by-account activity from approved journal entries.</p>
        </div>
        <PeriodControls />
      </div>

      <BooksPostingHint compact />

      <div className="panel">
        {ledger.map((account) => (
          <div key={account.code} className="statement-block">
            <h2>
              {account.code} · {account.name}
            </h2>
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Memo</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {account.lines.map((line, idx) => (
                    <tr key={`${account.code}_${idx}`}>
                      <td>{line.date}</td>
                      <td>{line.memo}</td>
                      <td className="num">{line.debit ? formatMoney(line.debit) : ''}</td>
                      <td className="num">{line.credit ? formatMoney(line.credit) : ''}</td>
                      <td className="num">{formatMoney(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!ledger.length && <p className="muted">No approved activity in this period.</p>}
      </div>
    </div>
  )
}
