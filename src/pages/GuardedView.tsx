import { Navigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import type { NavViewKey } from '../settings'
import type { ReactNode } from 'react'

export function GuardedView({ view, children }: { view: NavViewKey; children: ReactNode }) {
  const { settings } = useApp()
  if (!settings.nav[view]) return <Navigate to="/documents" replace />
  return children
}
