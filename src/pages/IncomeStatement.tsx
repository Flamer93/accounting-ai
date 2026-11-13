import { Link } from 'react-router-dom'
import { buildIncomeStatement } from '../accounting'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { StatementHeader } from '../components/StatementHeader'
import { useApp } from '../AppContext'
import { formatAmount } from '../moneyFormat'

export function IncomeStatement() {
  const { entries, period } = useApp()
  const statement = buildIncomeStatement(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Income Statement</h1>
          <p>Revenue and expenses from approved books.</p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PostEntryForm
          title="Add income-statement activity (posts journal entry)"
          defaultDebit="5300"
          defaultCredit="1000"
          compact
        />
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Tip: debit an expense &amp; credit Cash for costs; debit Cash &amp; credit Service Revenue for
          income. Or edit freely in the <Link to="/journal">Journal</Link>.
        </p>
      </div>

      <div className="books-sheet is-sheet">
        <StatementHeader title="Income Statement" yearEnded />
        <table className="is-classic">
          <tbody>
            <tr>
              <td colSpan={3} className="section-label">
                Revenues
              </td>
            </tr>
            {statement.revenue.rows.map((row, idx) => (
              <tr key={row.code}>
                <td className="indent">{row.name}</td>
                <td className="num inner">
                  {formatAmount(row.amount, idx === 0)}
                </td>
                <td className="num outer" />
              </tr>
            ))}
                {!statement.revenue.rows.length && (
              <tr>
                <td className="indent muted" colSpan={3}>
                  —
                </td>
              </tr>
            )}
            <tr>
              <td className="indent">Total Revenues:</td>
              <td className="num inner single-rule" />
              <td className="num outer">
                {statement.revenue.rows.length ? formatAmount(statement.revenue.total, true) : '—'}
              </td>
            </tr>

            <tr>
              <td colSpan={3} className="section-label">
                Expenses
              </td>
            </tr>
            {statement.expenses.rows.map((row, idx) => (
              <tr key={row.code}>
                <td className="indent">{row.name}</td>
                <td className="num inner">{formatAmount(row.amount, idx === 0)}</td>
                <td className="num outer" />
              </tr>
            ))}
                {!statement.expenses.rows.length && (
              <tr>
                <td className="indent muted" colSpan={3}>
                  —
                </td>
              </tr>
            )}
            <tr>
              <td className="indent">Total Expenses:</td>
              <td className="num inner single-rule" />
              <td className="num outer">
                {statement.expenses.rows.length ? formatAmount(statement.expenses.total) : '—'}
              </td>
            </tr>

            <tr>
              <td />
              <td />
              <td className="num outer single-rule" />
            </tr>
            <tr>
              <td>
                <strong>Net Income</strong>
              </td>
              <td />
              <td className="num outer double-rule">
                <strong>
                  {statement.revenue.rows.length || statement.expenses.rows.length
                    ? formatAmount(statement.netIncome, true)
                    : '—'}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
