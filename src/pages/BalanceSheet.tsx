import { Link } from 'react-router-dom'
import { buildBalanceSheet } from '../accounting'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { StatementHeader } from '../components/StatementHeader'
import { useApp } from '../AppContext'
import { formatAmount } from '../moneyFormat'

export function BalanceSheet() {
  const { entries, period } = useApp()
  const sheet = buildBalanceSheet(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Balance Sheet</h1>
          <p>
            Condensed statement from approved books. Optional post below creates a journal entry
            (e.g. buy equipment on cash). Prefer the <Link to="/journal">Journal</Link> for complex
            entries.
          </p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PostEntryForm
          title="Add balance-sheet activity (posts journal entry)"
          defaultDebit="1500"
          defaultCredit="1000"
          compact
        />
      </div>

      <div className="books-sheet bs-sheet">
        <StatementHeader title="CONDENSED BALANCE SHEET" variant="apple" asOf />

        <div className="bs-band">ASSETS:</div>
        <table className="bs-apple">
          <tbody>
            {sheet.assets.rows.map((row, idx) => (
              <tr key={row.code} className={idx % 2 ? 'alt' : undefined}>
                <td className="indent">{row.name}</td>
                <td className="num">{formatAmount(row.amount, idx === 0)}</td>
              </tr>
            ))}
            {!sheet.assets.rows.length && (
              <tr>
                <td className="indent muted">—</td>
                <td className="num muted">—</td>
              </tr>
            )}
            <tr className="subtotal">
              <td>Total assets</td>
              <td className="num double-rule">
                {sheet.assets.rows.length ? formatAmount(sheet.totalAssets, true) : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="bs-band">LIABILITIES AND SHAREHOLDERS&apos; EQUITY:</div>
        <table className="bs-apple">
          <tbody>
            <tr>
              <td colSpan={2} className="cat">
                Current liabilities:
              </td>
            </tr>
            {sheet.liabilities.rows.map((row, idx) => (
              <tr key={row.code} className={idx % 2 ? 'alt' : undefined}>
                <td className="indent">{row.name}</td>
                <td className="num">{formatAmount(row.amount, idx === 0)}</td>
              </tr>
            ))}
            {!sheet.liabilities.rows.length && (
              <tr>
                <td className="indent muted">—</td>
                <td className="num muted">—</td>
              </tr>
            )}
            <tr className="subtotal">
              <td className="indent">Total liabilities</td>
              <td className="num single-rule-above">
                {sheet.liabilities.rows.length ? formatAmount(sheet.liabilities.total, true) : '—'}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="cat">
                Shareholders&apos; equity:
              </td>
            </tr>
            {sheet.equity.rows.map((row, idx) => (
              <tr key={row.code} className={idx % 2 ? 'alt' : undefined}>
                <td className="indent">{row.name}</td>
                <td className="num">{formatAmount(row.amount, idx === 0)}</td>
              </tr>
            ))}
            {!sheet.equity.rows.length && (
              <tr>
                <td className="indent muted">—</td>
                <td className="num muted">—</td>
              </tr>
            )}
            <tr className="subtotal">
              <td className="indent">Total shareholders&apos; equity</td>
              <td className="num single-rule-above">
                {sheet.equity.rows.length ? formatAmount(sheet.equity.total) : '—'}
              </td>
            </tr>
            <tr className="grand">
              <td>Total liabilities and shareholders&apos; equity</td>
              <td className="num double-rule">
                {sheet.assets.rows.length || sheet.liabilities.rows.length || sheet.equity.rows.length
                  ? formatAmount(sheet.totalLiabilitiesAndEquity, true)
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        {(sheet.assets.rows.length ||
          sheet.liabilities.rows.length ||
          sheet.equity.rows.length) &&
          sheet.totalAssets !== sheet.totalLiabilitiesAndEquity && (
            <p className="error" style={{ padding: '0.75rem 1rem' }}>
              Imbalance: assets {formatAmount(sheet.totalAssets, true)} vs L+E{' '}
              {formatAmount(sheet.totalLiabilitiesAndEquity, true)}.
            </p>
          )}
      </div>
    </div>
  )
}
