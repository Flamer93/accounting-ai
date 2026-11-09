import { buildBalanceSheet, formatMoney } from '../accounting'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'

function Section({
  title,
  rows,
  total,
}: {
  title: string
  rows: { code: string; name: string; amount: number }[]
  total: number
}) {
  return (
    <div className="statement-block">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table className="ledger">
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td>
                  {row.code} · {row.name}
                </td>
                <td className="num">{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="total-row">
        <span>Total {title}</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export function BalanceSheet() {
  const { entries, period } = useApp()
  const sheet = buildBalanceSheet(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Balance Sheet</h1>
          <p>Assets versus liabilities and equity as of the period end.</p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel">
        <Section title="Assets" rows={sheet.assets.rows} total={sheet.assets.total} />
        <Section title="Liabilities" rows={sheet.liabilities.rows} total={sheet.liabilities.total} />
        <Section title="Equity" rows={sheet.equity.rows} total={sheet.equity.total} />
        <div className="total-row">
          <span>Total liabilities & equity</span>
          <span>{formatMoney(sheet.totalLiabilitiesAndEquity)}</span>
        </div>
        {sheet.totalAssets !== sheet.totalLiabilitiesAndEquity && (
          <p className="error">
            Balance sheet imbalance: assets {formatMoney(sheet.totalAssets)} vs L+E{' '}
            {formatMoney(sheet.totalLiabilitiesAndEquity)}.
          </p>
        )}
      </div>
    </div>
  )
}
