import { buildGeneralLedger, formatMoney } from '../accounting'
import { BooksPostingHint } from '../components/BooksPostingHint'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'

export function TAccounts() {
  const { entries, period } = useApp()
  const ledger = buildGeneralLedger(entries, period)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>T-Accounts</h1>
          <p>Classic debit / credit sides for each active account (approved entries only).</p>
        </div>
        <PeriodControls />
      </div>

      <BooksPostingHint compact />

      <div className="t-grid">
        {ledger.map((account) => (
          <article className="t-account" key={account.code}>
            <h3>
              {account.code} · {account.name}
            </h3>
            <div className="t-cols">
              <div>
                <div className="side-label">Debit</div>
                {account.lines
                  .filter((l) => l.debit > 0)
                  .map((l, i) => (
                    <div key={`d${i}`} className="muted">
                      {l.date} · {formatMoney(l.debit)}
                    </div>
                  ))}
              </div>
              <div>
                <div className="side-label">Credit</div>
                {account.lines
                  .filter((l) => l.credit > 0)
                  .map((l, i) => (
                    <div key={`c${i}`} className="muted">
                      {l.date} · {formatMoney(l.credit)}
                    </div>
                  ))}
              </div>
            </div>
            <div className="total-row" style={{ margin: '0 0.75rem 0.75rem' }}>
              <span>Balance</span>
              <span>{formatMoney(account.balance)}</span>
            </div>
          </article>
        ))}
      </div>
      {!ledger.length && (
        <div className="panel">
          <p className="muted">
            No approved activity in this period. Extract a receipt, then Approve &amp; post in the
            journal (or widen the period dates above).
          </p>
        </div>
      )}
    </div>
  )
}
