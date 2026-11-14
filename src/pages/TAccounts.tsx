import { useState } from 'react'
import { buildGeneralLedger } from '../accounting'
import { AccountSelect } from '../components/AccountSelect'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { useApp } from '../AppContext'
import { formatAmount, formatShortDate } from '../moneyFormat'

export function TAccounts() {
  const { entries, period, accounts } = useApp()
  const ledger = buildGeneralLedger(entries, period)
  const [focus, setFocus] = useState(ledger[0]?.code || '1000')
  const selectAccounts = ledger.length
    ? ledger.map((a) => ({ code: a.code, name: a.name, type: a.type }))
    : accounts

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>T-Accounts</h1>
          <p>Debit and credit sides. Posts update the journal and statements.</p>
        </div>
        <PeriodControls />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PostEntryForm
          title="Post to a T-account"
          defaultDebit={focus}
          defaultCredit={focus === '1000' ? '3000' : '1000'}
          compact
        />
        <label className="field" style={{ marginTop: '0.75rem', maxWidth: 280 }}>
          <span>Highlight account</span>
          <AccountSelect
            accounts={selectAccounts}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
        </label>
      </div>

      <div className="t-grid classic-t">
        {ledger.map((account) => {
          const debits = account.lines.filter((l) => l.debit > 0)
          const credits = account.lines.filter((l) => l.credit > 0)
          const normalDebit = account.type === 'asset' || account.type === 'expense'
          const showBalLeft = normalDebit ? account.balance >= 0 : account.balance < 0
          const balAbs = Math.abs(account.balance)

          return (
            <article
              className={`t-account classic ${account.code === focus ? 'focused' : ''}`}
              key={account.code}
              onClick={() => setFocus(account.code)}
            >
              <h3>{account.name}</h3>
              <div className="t-side-labels">
                <span>Debit</span>
                <span>Credit</span>
              </div>
              <div className="t-cols">
                <div>
                  <div className="t-subhead">
                    <span>Date</span>
                    <span>Amt</span>
                  </div>
                  {debits.map((l, i) => (
                    <div className="t-row" key={`d${i}`}>
                      <span>{formatShortDate(l.date)}</span>
                      <span>{formatAmount(l.debit, true)}</span>
                    </div>
                  ))}
                  {showBalLeft && balAbs > 0 && (
                    <div className="t-row bal">
                      <span>Bal</span>
                      <span>{formatAmount(balAbs, true)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="t-subhead">
                    <span>Date</span>
                    <span>Amt</span>
                  </div>
                  {credits.map((l, i) => (
                    <div className="t-row" key={`c${i}`}>
                      <span>{formatShortDate(l.date)}</span>
                      <span>{formatAmount(l.credit, true)}</span>
                    </div>
                  ))}
                  {!showBalLeft && balAbs > 0 && (
                    <div className="t-row bal">
                      <span>Bal</span>
                      <span>{formatAmount(balAbs, true)}</span>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {!ledger.length && (
        <div className="panel">
          <p className="muted">
            No T-accounts yet. Post an entry above or in the Journal — accounts appear as you enter
            them.
          </p>
        </div>
      )}
    </div>
  )
}
