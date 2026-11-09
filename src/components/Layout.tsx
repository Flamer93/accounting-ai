import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../AppContext'
import { NAV_VIEW_META } from '../settings'

export function Layout() {
  const { settings, preferredProvider, openaiKeySaved, openaiConfigured } = useApp()

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

      {preferredProvider === 'google' && (
        <div className="status-banner">
          <span className="badge ok">Google extract</span>
          <span className="muted">
            Gemini will run on Extract using your browser-saved Google API key and Settings fields.
          </span>
        </div>
      )}
      {preferredProvider === 'openai' && (
        <div className="status-banner">
          <span className="badge ok">OpenAI extract</span>
          <span className="muted">
            {openaiKeySaved
              ? 'Using your browser-saved OpenAI API key (no Google key saved).'
              : openaiConfigured
                ? 'Using host OPENAI_API_KEY. Add a Google key in Settings to prefer Gemini.'
                : 'OpenAI extract ready.'}
          </span>
        </div>
      )}
      {preferredProvider === 'mock' && (
        <div className="status-banner">
          <span className="badge warn">Mock extract</span>
          <span className="muted">
            No Google or OpenAI key in Settings and no host OpenAI key. Extracts create editable sample drafts.
          </span>
        </div>
      )}

      <Outlet />
    </div>
  )
}
