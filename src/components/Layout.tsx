import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../AppContext'
import { NAV_VIEW_META } from '../settings'

export function Layout() {
  const { settings, booksReady, persistError } = useApp()

  const links = [
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
            {settings.companyName.trim() || 'Accounting AI'}
          </NavLink>
          <span className="brand-sub">Blank books template — enter once, every statement updates</span>
        </div>
        <div className="topbar-right">
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
        </div>
      </header>

      <main className="app-main">
        {persistError && (
          <div className="auth-mock-banner inline-banner persist-error" role="alert">
            <strong>Sync issue</strong>
            <span>{persistError}</span>
          </div>
        )}
        {!booksReady ? (
          <div className="panel">
            <p className="muted">Loading your books…</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
