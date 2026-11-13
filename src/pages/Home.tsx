import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'

export function Home() {
  const { settings } = useApp()
  const company = settings.companyName.trim()
  return (
    <section className="hero" aria-label="Company books">
      <div className="hero-copy">
        <p className="hero-kicker">Accounting AI</p>
        <h1>{company || 'Your books'}</h1>
        <p>Post once in the journal. Ledger, trial balance, and statements stay in sync.</p>
        <div className="cta-row">
          <Link className="btn" to="/journal">
            Open journal
          </Link>
          <Link className="btn ghost" to="/settings">
            Settings
          </Link>
        </div>
      </div>
    </section>
  )
}
