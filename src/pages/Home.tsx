import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'

export function Home() {
  const { settings } = useApp()
  return (
    <section className="hero" aria-label="Company books">
      <div className="hero-copy">
        <div className="brand">{settings.companyName}</div>
        <h1>One journal. Every statement updates.</h1>
        <p>
          Enter a balanced entry in the <strong>Journal</strong>, or post from Ledger, T-Accounts, or
          Trial Balance. Income Statement and Balance Sheet recompute from the same books. AI receipt
          extract is parked under Settings → Advanced.
        </p>
        <div className="cta-row">
          <Link className="btn" to="/journal">
            Open journal
          </Link>
          <Link className="btn secondary" to="/trial-balance">
            Trial balance
          </Link>
          <Link className="btn ghost" to="/income-statement">
            Income statement
          </Link>
        </div>
      </div>
    </section>
  )
}
