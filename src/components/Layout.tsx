import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../AppContext'

const links = [
  { to: '/documents', label: 'Documents' },
  { to: '/journal', label: 'Journal' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/t-accounts', label: 'T-Accounts' },
  { to: '/trial-balance', label: 'Trial Balance' },
  { to: '/balance-sheet', label: 'Balance Sheet' },
  { to: '/income-statement', label: 'Income Statement' },
]

export function Layout() {
  const { openaiConfigured } = useApp()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <NavLink to="/" className="brand">
            Receipt Ledger
          </NavLink>
          <span className="brand-sub">Photo receipts → clean statements</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {openaiConfigured === false && (
        <div className="status-banner">
          <span className="badge warn">Sample / mock extract</span>
          <span className="muted">
            OPENAI_API_KEY is not set. Uploads use a deterministic extractor — review and edit before approving.
          </span>
        </div>
      )}
      {openaiConfigured === true && (
        <div className="status-banner">
          <span className="badge ok">OpenAI extract ready</span>
          <span className="muted">Vision extraction will run when you extract a document.</span>
        </div>
      )}

      <Outlet />
    </div>
  )
}
