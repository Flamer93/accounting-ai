import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'

export function Home() {
  const { settings } = useApp()
  const company = settings.companyName.trim()
  return (
    <section className="hero" aria-label="Company books">
      <div className="hero-copy">
        <div className="brand">{company || 'Accounting AI'}</div>
        <h1>Blank books. Your entries only.</h1>
        <p>
          No sample company, dates, or amounts. Set your company name in Settings, then post in the{' '}
          <strong>Journal</strong> (or Ledger / T-Accounts / Trial Balance). Income Statement and
          Balance Sheet stay empty until you enter real data.
        </p>
        <div className="cta-row">
          <Link className="btn" to="/journal">
            Open journal
          </Link>
          <Link className="btn secondary" to="/settings">
            Company settings
          </Link>
          <Link className="btn ghost" to="/trial-balance">
            Trial balance
          </Link>
        </div>
      </div>
    </section>
  )
}
