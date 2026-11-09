import { buildIncomeStatement, formatMoney } from '../accounting'
import { BooksPostingHint } from '../components/BooksPostingHint'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'

export function IncomeStatement() {
  const { entries, period } = useApp()
  const statement = buildIncomeStatement(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Income Statement</h1>
          <p>Revenue and expenses for the selected period (approved entries only).</p>
        </div>
        <PeriodControls />
      </div>

      <BooksPostingHint compact />

      <div className="panel">
        <div className="statement-block">
          <h2>Revenue</h2>
          <div className="table-wrap">
            <table className="ledger">
              <tbody>
                {statement.revenue.rows.map((row) => (
                  <tr key={row.code}>
                    <td>
                      {row.code} · {row.name}
                    </td>
                    <td className="num">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
                {!statement.revenue.rows.length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No revenue posted
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="total-row">
            <span>Total revenue</span>
            <span>{formatMoney(statement.revenue.total)}</span>
          </div>
        </div>

        <div className="statement-block">
          <h2>Expenses</h2>
          <div className="table-wrap">
            <table className="ledger">
              <tbody>
                {statement.expenses.rows.map((row) => (
                  <tr key={row.code}>
                    <td>
                      {row.code} · {row.name}
                    </td>
                    <td className="num">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
                {!statement.expenses.rows.length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No expenses posted
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="total-row">
            <span>Total expenses</span>
            <span>{formatMoney(statement.expenses.total)}</span>
          </div>
        </div>

        <div className="total-row">
          <span>Net income</span>
          <span>{formatMoney(statement.netIncome)}</span>
        </div>
      </div>
    </div>
  )
}
