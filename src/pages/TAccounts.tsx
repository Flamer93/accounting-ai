import { buildGeneralLedger, formatMoney } from '../accounting'
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
          <p>Classic debit / credit sides for each active account.</p>
        </div>
        <PeriodControls />
      </div>

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
          <p className="muted">No approved activity in this period.</p>
        </div>
      )}
    </div>
  )
}
