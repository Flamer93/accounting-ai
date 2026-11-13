import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../AppContext'
import { NAV_VIEW_META } from '../settings'

type Pill = { left: number; top: number; width: number; height: number; visible: boolean }

const HIDDEN_PILL: Pill = { left: 0, top: 0, width: 0, height: 0, visible: false }

export function Layout() {
  const { settings, booksReady, persistError } = useApp()
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<Pill>(HIDDEN_PILL)

  const links = [
    { to: '/add-transaction', label: 'Add a transaction', cta: true },
    ...NAV_VIEW_META.filter((view) => settings.nav[view.key]).map((view) => ({
      to: view.path,
      label: view.label,
      cta: false,
    })),
    { to: '/settings', label: 'Settings', cta: false },
  ]

  const updatePill = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLAnchorElement>('a.nav-link.active')
    if (!active) {
      setPill(HIDDEN_PILL)
      return
    }
    setPill({
      left: active.offsetLeft,
      top: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
      visible: true,
    })
  }, [])

  useLayoutEffect(() => {
    updatePill()
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => updatePill())
    ro.observe(nav)
    window.addEventListener('resize', updatePill)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updatePill)
    }
  }, [location.pathname, links.length, settings.nav, updatePill])

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" end>
          {settings.companyName.trim() || 'Accounting AI'}
        </NavLink>
        <nav className="nav" aria-label="Primary" ref={navRef}>
          <span
            className={`nav-pill${pill.visible ? ' is-visible' : ''}`}
            aria-hidden
            style={{
              transform: `translate(${pill.left}px, ${pill.top}px)`,
              width: pill.width,
              height: pill.height,
            }}
          />
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link${link.cta ? ' nav-cta' : ''}${isActive ? ' active' : ''}`
              }
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
