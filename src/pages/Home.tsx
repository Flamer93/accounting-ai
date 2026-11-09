import { Link } from 'react-router-dom'

export function Home() {
  return (
    <section className="hero" aria-label="Receipt Ledger">
      <div className="hero-copy">
        <div className="brand">Receipt Ledger</div>
        <h1>Turn receipt photos into a living set of books.</h1>
        <p>
          Upload documents, extract entries, approve the journal, then read the ledger,
          T-accounts, trial balance, balance sheet, and income statement.
        </p>
        <div className="cta-row">
          <Link className="btn" to="/documents">
            Open documents
          </Link>
          <Link className="btn ghost" to="/income-statement">
            View statements
          </Link>
        </div>
      </div>
    </section>
  )
}
