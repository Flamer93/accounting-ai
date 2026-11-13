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
        <NavLink to="/" className="brand">
          {settings.companyName.trim() || 'Accounting AI'}
        </NavLink>
        <nav className="nav" aria-label="Primary">
          <NavLink
            to="/add-transaction"
            className={({ isActive }) => `nav-cta${isActive ? ' active' : ''}`}
          >
            Add a transaction
          </NavLink>
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

      <main className="app-main">
        {persistError && (
          <div className="inline-alert" role="alert">
            {persistError}
          </div>
        )}
        {!booksReady ? (
          <div className="panel">
            <p className="muted">Loading books…</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
