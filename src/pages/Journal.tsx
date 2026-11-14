import { useEffect, useMemo, useState } from 'react'
import { accountLabel } from '../chartOfAccounts'
import { approvedEntries, inPeriod, journalRefMap, validateEntry } from '../accounting'
import { AccountSelect } from '../components/AccountSelect'
import { ClearBooksPanel } from '../components/ClearBooksPanel'
import { PeriodControls } from '../components/PeriodControls'
import { PostEntryForm } from '../components/PostEntryForm'
import { StatementHeader } from '../components/StatementHeader'
import { useApp } from '../AppContext'
import { useCompany } from '../CompanyContext'
import { companyHighlightKey } from '../companies'
import { formatAmount, formatShortDate } from '../moneyFormat'
import type { JournalEntry } from '../types'

function loadHighlights(companyId: string): string[] {
  try {
    const raw = localStorage.getItem(companyHighlightKey(companyId))
    if (!raw) return []
    // New format: JSON array. Legacy: single account code string.
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter((c): c is string => typeof c === 'string' && Boolean(c))
    }
    return raw.trim() ? [raw.trim()] : []
  } catch {
    return []
  }
}

function saveHighlights(companyId: string, codes: string[]) {
  try {
    const key = companyHighlightKey(companyId)
    if (!codes.length) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(codes))
  } catch {
    /* ignore */
  }
}

export function Journal() {
  const { companyId } = useCompany()
  const {
    entries,
    accounts,
    period,
    updateEntry,
    approveEntry,
    deleteEntry,
    addManualEntry,
    saveJournalForDate,
  } = useApp()
  const [drafts, setDrafts] = useState<Record<string, JournalEntry>>({})
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [showComposer, setShowComposer] = useState(true)
  const [showClear, setShowClear] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [highlightAccounts, setHighlightAccounts] = useState(() => loadHighlights(companyId))

  useEffect(() => {
    setHighlightAccounts(loadHighlights(companyId))
  }, [companyId])

  function onSaveForDate() {
    const asOfDate = period.from || new Date().toISOString().slice(0, 10)
    const result = saveJournalForDate({ asOfDate })
    if (result.errors.length) {
      setSaveNote(result.errors.join(' · '))
      return
    }
    setSaveNote(`Saved journal for ${asOfDate}. Restore anytime in Settings → Saved journals.`)
  }

  const refs = useMemo(() => journalRefMap(entries, period), [entries, period])
  const visible = entries
    .filter((e) => inPeriod(e.date, period))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  const posted = approvedEntries(entries, period)

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

  function approveAndPost(entry: JournalEntry) {
    const next = current(entry)
    const errs = validateEntry(next)
    if (errs.length) {
      setErrors((prev) => ({ ...prev, [entry.id]: errs }))
      return
    }
    const approveErrs = approveEntry(entry.id, next)
    setErrors((prev) => ({ ...prev, [entry.id]: approveErrs }))
    if (!approveErrs.length) {
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
          <h1 className="page-title">Journal</h1>
          <p>Post entries here. All statements update from the same approved books.</p>
        </div>
        <div className="cta-row">
          <PeriodControls />
          <label className="field journal-highlight-field">
            <span>Highlight accounts</span>
            <AccountSelect
              accounts={accounts}
              multiple
              size={Math.min(8, Math.max(4, accounts.length || 4))}
              value={highlightAccounts}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions, (o) => o.value).filter(Boolean)
                setHighlightAccounts(next)
                saveHighlights(companyId, next)
              }}
            />
            <span className="journal-highlight-hint">
              {highlightAccounts.length
                ? `${highlightAccounts.length} selected · Cmd/Ctrl-click to toggle`
                : 'Cmd/Ctrl-click to select one or more'}
            </span>
          </label>
          <button className="btn secondary" type="button" onClick={() => setShowComposer((v) => !v)}>
            {showComposer ? 'Hide composer' : 'New entry'}
          </button>
          <button className="btn secondary" type="button" onClick={() => addManualEntry()}>
            Blank draft
          </button>
          <button className="btn secondary" type="button" onClick={onSaveForDate}>
            Save for date
          </button>
          <button className="btn danger" type="button" onClick={() => setShowClear((v) => !v)}>
            {showClear ? 'Hide clear' : 'Clear journal'}
          </button>
        </div>
      </div>

      {saveNote && (
        <p className="muted" style={{ marginTop: 0 }}>
          {saveNote}
        </p>
      )}

      {showClear && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2 className="settings-subhead">Start from scratch</h2>
          <ClearBooksPanel />
        </div>
      )}

      {showComposer && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <PostEntryForm title="Quick post (approved immediately)" />
        </div>
      )}

      <div className="books-sheet journal-sheet">
        <StatementHeader title="General Journal" />
        <div className="table-wrap">
          <table className="journal-classic">
            <thead>
              <tr>
                <th className="col-date">Date</th>
                <th className="col-desc">Description</th>
                <th className="col-pr">PR</th>
                <th className="col-amt">Amount (Dr. $)</th>
                <th className="col-amt">Amount (Cr. $)</th>
              </tr>
            </thead>
            <tbody>
              {posted.map((entry) => {
                const debitLines = entry.lines.filter((l) => (l.debit || 0) > 0)
                const creditLines = entry.lines.filter((l) => (l.credit || 0) > 0)
                const rowSpan = Math.max(debitLines.length + creditLines.length, 1) + 1
                const hit =
                  highlightAccounts.length > 0 &&
                  entry.lines.some((l) => highlightAccounts.includes(l.accountCode))
                return (
                  <FragmentRows
                    key={entry.id}
                    entry={entry}
                    debitLines={debitLines}
                    creditLines={creditLines}
                    rowSpan={rowSpan}
                    pr={refs.get(entry.id) || ''}
                    highlight={hit}
                    highlightAccounts={highlightAccounts}
                  />
                )
              })}
              {!posted.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No entries yet. Post above — formats stay blank until you enter real dates and
                    amounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visible.some((e) => e.status !== 'approved') && (
        <div className="panel" style={{ marginTop: '1.25rem' }}>
          <h2 className="settings-subhead">Drafts (not on statements yet)</h2>
          {visible
            .filter((e) => e.status !== 'approved')
            .map((entry) => {
              const e = current(entry)
              return (
                <div className="entry-editor entry-draft" key={entry.id}>
                  <div className="cta-row" style={{ justifyContent: 'space-between' }}>
                    <span className="badge pending">Draft</span>
                    <div className="cta-row">
                      <button className="btn secondary" type="button" onClick={() => save(entry)}>
                        Save
                      </button>
                      <button className="btn" type="button" onClick={() => approveAndPost(entry)}>
                        Approve &amp; post
                      </button>
                      <button className="btn danger" type="button" onClick={() => deleteEntry(entry.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="fields">
                    <label className="field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={e.date}
                        onChange={(ev) => patch(entry, { ...e, date: ev.target.value })}
                      />
                    </label>
                    <label className="field" style={{ gridColumn: 'span 2' }}>
                      <span>Memo</span>
                      <input
                        value={e.memo}
                        onChange={(ev) => patch(entry, { ...e, memo: ev.target.value })}
                      />
                    </label>
                  </div>
                  {e.lines.map((line, idx) => (
                    <div className="line-row" key={`${entry.id}_${idx}`}>
                      <label className="field">
                        <span>Account</span>
                        <input value={accountLabel(line.accountCode)} readOnly />
                      </label>
                      <label className="field">
                        <span>Debit</span>
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(ev) => {
                            const debit = Number(ev.target.value || 0)
                            const lines = e.lines.map((l, i) =>
                              i === idx ? { ...l, debit, credit: debit ? 0 : l.credit } : l,
                            )
                            patch(entry, { ...e, lines })
                          }}
                        />
                      </label>
                      <label className="field">
                        <span>Credit</span>
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(ev) => {
                            const credit = Number(ev.target.value || 0)
                            const lines = e.lines.map((l, i) =>
                              i === idx ? { ...l, credit, debit: credit ? 0 : l.debit } : l,
                            )
                            patch(entry, { ...e, lines })
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  {errors[entry.id]?.length ? (
                    <div className="error">{errors[entry.id].join(' · ')}</div>
                  ) : null}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function FragmentRows({
  entry,
  debitLines,
  creditLines,
  pr,
  highlight,
  highlightAccounts,
}: {
  entry: JournalEntry
  debitLines: JournalEntry['lines']
  creditLines: JournalEntry['lines']
  rowSpan: number
  pr: string
  highlight: boolean
  highlightAccounts: string[]
}) {
  const rows: Array<{ kind: 'debit' | 'credit' | 'narr'; line?: JournalEntry['lines'][0] }> = [
    ...debitLines.map((line) => ({ kind: 'debit' as const, line })),
    ...creditLines.map((line) => ({ kind: 'credit' as const, line })),
    { kind: 'narr' as const },
  ]

  return (
    <>
      {rows.map((row, idx) => {
        const lineHit =
          highlightAccounts.length > 0 &&
          Boolean(row.line?.accountCode) &&
          highlightAccounts.includes(row.line!.accountCode)
        const classes = [
          row.kind === 'narr' ? 'journal-narr' : '',
          highlight ? 'journal-entry-hit' : '',
          lineHit ? 'journal-line-hit' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <tr key={`${entry.id}_${idx}`} className={classes || undefined}>
            <td className="col-date">{idx === 0 ? formatShortDate(entry.date) : ''}</td>
            <td className={`col-desc ${row.kind === 'credit' ? 'credit-indent' : ''}`}>
              {row.kind === 'narr'
                ? `(${entry.memo || entry.vendor || 'Entry'})`
                : accountLabel(row.line!.accountCode)}
            </td>
            <td className="col-pr">{idx === 0 ? pr : ''}</td>
            <td className="col-amt num">
              {row.kind === 'debit' && row.line ? formatAmount(row.line.debit || 0) : ''}
            </td>
            <td className="col-amt num">
              {row.kind === 'credit' && row.line ? formatAmount(row.line.credit || 0) : ''}
            </td>
          </tr>
        )
      })}
    </>
  )
}
