import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../AppContext'
import { useAuth } from '../firebase/AuthContext'
import { NAV_VIEW_META } from '../settings'

export function Layout() {
  const { settings, booksReady, persistError } = useApp()
  const { user, mode, signOutUser } = useAuth()

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
          <div className="account-chip">
            <span className="account-email" title={user?.email || undefined}>
              {user?.email || 'Signed in'}
            </span>
            {mode === 'mock' && <span className="badge warn">Mock auth</span>}
            <button type="button" className="btn secondary btn-compact" onClick={() => void signOutUser()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {mode === 'mock' && (
        <div className="auth-mock-banner inline-banner" role="status">
          <strong>Local mock auth</strong>
          <span>Firebase secrets are not set — data stays in this browser, scoped per mock account.</span>
        </div>
      )}
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
    </div>
  )
}
