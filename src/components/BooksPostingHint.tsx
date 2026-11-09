import { Link } from 'react-router-dom'
import { approvedEntries, inPeriod } from '../accounting'
import { useApp } from '../AppContext'

/** Explains why statements may look empty: drafts are excluded until Approve & post. */
export function BooksPostingHint({ compact = false }: { compact?: boolean }) {
  const { entries, period } = useApp()
  const inScope = entries.filter((e) => inPeriod(e.date, period))
  const drafts = inScope.filter((e) => e.status !== 'approved')
  const posted = approvedEntries(entries, period)
  const approvedOutside = entries.filter(
    (e) => e.status === 'approved' && !inPeriod(e.date, period),
  )

  if (!drafts.length && !approvedOutside.length) return null

  return (
    <div className={`status-banner ${drafts.length ? 'warn-banner' : ''}`}>
      {drafts.length > 0 && (
        <>
          <span className="badge warn">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</span>
          <span className="muted">
            {compact
              ? 'Drafts are not in T-accounts or statements until you Approve & post.'
              : 'Statements, T-accounts, ledger, and trial balance only include approved entries. Review drafts in the journal, then Approve & post.'}
          </span>
          <Link className="btn" to="/journal">
            Approve in Journal
          </Link>
        </>
      )}
      {!drafts.length && approvedOutside.length > 0 && (
        <>
          <span className="badge pending">{approvedOutside.length} outside period</span>
          <span className="muted">
            {approvedOutside.length} approved entr{approvedOutside.length === 1 ? 'y is' : 'ies are'}{' '}
            outside the selected dates
            {posted.length === 0 ? ' — widen the period to see them on statements.' : '.'}
          </span>
        </>
      )}
    </div>
  )
}
