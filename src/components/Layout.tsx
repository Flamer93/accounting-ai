import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../AppContext'
import { NAV_VIEW_META } from '../settings'

export function Layout() {
  const { openaiConfigured, settings } = useApp()

  const links = [
    { to: '/documents', label: 'Documents' },
    ...NAV_VIEW_META.filter((view) => settings.nav[view.key]).map((view) => ({
      to: view.path,
      label: view.label,
    })),
    { to: '/settings', label: 'Settings' },
  ]

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
          <span className="badge warn">Mock extract</span>
          <span className="muted">
            AI is off — no <code>OPENAI_API_KEY</code> in the host env. Extracts create editable sample drafts.
            See Settings for field choices and AI status.
          </span>
        </div>
      )}
      {openaiConfigured === true && (
        <div className="status-banner">
          <span className="badge ok">AI extract ready</span>
          <span className="muted">
            OpenAI vision will run on Extract, using only the fields enabled in Settings.
          </span>
        </div>
      )}

      <Outlet />
    </div>
  )
}
