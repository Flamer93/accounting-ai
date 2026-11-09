import { useState } from 'react'
import { formatMoney, inPeriod, lineTotals, validateEntry } from '../accounting'
import { CHART_OF_ACCOUNTS } from '../chartOfAccounts'
import { PeriodControls } from '../components/PeriodControls'
import { useApp } from '../AppContext'
import type { JournalEntry } from '../types'

export function Journal() {
  const { entries, period, updateEntry, approveEntry, deleteEntry, addManualEntry } = useApp()
  const [drafts, setDrafts] = useState<Record<string, JournalEntry>>({})
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const visible = entries
    .filter((e) => inPeriod(e.date, period))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  function current(entry: JournalEntry): JournalEntry {
    return drafts[entry.id] ?? entry
  }

  function patch(entry: JournalEntry, next: JournalEntry) {
    setDrafts((prev) => ({ ...prev, [entry.id]: next }))
    setErrors((prev) => ({ ...prev, [entry.id]: validateEntry(next) }))
  }

  function save(entry: JournalEntry) {
    const next = current(entry)
    const errs = updateEntry(next)
    setErrors((prev) => ({ ...prev, [entry.id]: errs }))
    if (!errs.length) {
      setDrafts((prev) => {
        const copy = { ...prev }
        delete copy[entry.id]
        return copy
      })
    }
  }

  function approve(entry: JournalEntry) {
    const next = current(entry)
    const saveErrs = updateEntry(next)
    if (saveErrs.length) {
      setErrors((prev) => ({ ...prev, [entry.id]: saveErrs }))
      return
    }
    const errs = approveEntry(entry.id)
    setErrors((prev) => ({ ...prev, [entry.id]: errs }))
    if (!errs.length) {
      setDrafts((prev) => {
        const copy = { ...prev }
        delete copy[entry.id]
        return copy
      })
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>General Journal</h1>
          <p>Review extracted drafts, fix accounts, then approve into the books.</p>
        </div>
        <div className="cta-row">
          <PeriodControls />
          <button className="btn" onClick={() => addManualEntry()}>
            New entry
          </button>
        </div>
      </div>

      <div className="panel">
        {visible.map((entry) => {
          const e = current(entry)
          const totals = lineTotals(e.lines)
          return (
            <div className="entry-editor" key={entry.id}>
              <div className="cta-row" style={{ justifyContent: 'space-between' }}>
                <div className="cta-row">
                  {e.status === 'approved' ? (
                    <span className="badge ok">Approved</span>
                  ) : (
                    <span className="badge pending">Draft</span>
                  )}
                  {e.editRequired && <span className="badge warn">Edit required</span>}
                  <span className="muted">{e.source}</span>
                </div>
                <div className="cta-row">
                  <button className="btn secondary" onClick={() => save(entry)}>
                    Save
                  </button>
                  {e.status !== 'approved' && (
                    <button className="btn" onClick={() => approve(entry)}>
                      Approve
                    </button>
                  )}
                  <button className="btn danger" onClick={() => deleteEntry(entry.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="fields">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={e.date}
                    onChange={(ev) => patch(entry, { ...e, date: ev.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Vendor</label>
                  <input
                    value={e.vendor || ''}
                    onChange={(ev) => patch(entry, { ...e, vendor: ev.target.value })}
                  />
                </div>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Memo</label>
                  <input
                    value={e.memo}
                    onChange={(ev) => patch(entry, { ...e, memo: ev.target.value })}
                  />
                </div>
              </div>

              <div className="lines">
                {e.lines.map((line, idx) => (
                  <div className="line-row" key={`${entry.id}_${idx}`}>
                    <div className="field">
                      <label>Account</label>
                      <select
                        value={line.accountCode}
                        onChange={(ev) => {
                          const lines = e.lines.map((l, i) =>
                            i === idx ? { ...l, accountCode: ev.target.value } : l,
                          )
                          patch(entry, { ...e, lines })
                        }}
                      >
                        {CHART_OF_ACCOUNTS.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Debit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit || ''}
                        onChange={(ev) => {
                          const debit = Number(ev.target.value || 0)
                          const lines = e.lines.map((l, i) =>
                            i === idx ? { ...l, debit, credit: debit ? 0 : l.credit } : l,
                          )
                          patch(entry, { ...e, lines })
                        }}
                      />
                    </div>
                    <div className="field">
                      <label>Credit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit || ''}
                        onChange={(ev) => {
                          const credit = Number(ev.target.value || 0)
                          const lines = e.lines.map((l, i) =>
                            i === idx ? { ...l, credit, debit: credit ? 0 : l.debit } : l,
                          )
                          patch(entry, { ...e, lines })
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="muted">
                Totals · Debit {formatMoney(totals.debit)} · Credit {formatMoney(totals.credit)}
              </div>
              {errors[entry.id]?.length ? (
                <div className="error">{errors[entry.id].join(' · ')}</div>
              ) : null}
            </div>
          )
        })}
        {!visible.length && <p className="muted">No journal entries in this period.</p>}
      </div>
    </div>
  )
}
