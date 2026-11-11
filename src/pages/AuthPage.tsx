import { useState, type FormEvent } from 'react'
import { useAuth } from '../firebase/AuthContext'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const { mode, googleAvailable, signInEmail, signUpEmail, signInGoogle } = useAuth()
  const [formMode, setFormMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (formMode === 'signin') await signInEmail(email, password)
      else await signUpEmail(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        <p className="auth-brand">Accounting AI</p>
        <h1>{formMode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">
          Each account keeps its own books, chart of accounts, and settings. Switching accounts
          loads that user’s data only.
        </p>

        {mode === 'mock' && (
          <div className="auth-mock-banner" role="status">
            <strong>Local mock auth</strong>
            <span>
              Firebase is not configured. Accounts stay in this browser only — for local development.
              Set FIREBASE_* secrets to enable real multi-user Auth + Firestore.
            </span>
          </div>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={formMode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Working…' : formMode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {googleAvailable && (
          <button type="button" className="btn secondary auth-google" disabled={busy} onClick={onGoogle}>
            Continue with Google
          </button>
        )}

        <p className="auth-switch muted">
          {formMode === 'signin' ? (
            <>
              No account yet?{' '}
              <button type="button" className="linkish" onClick={() => setFormMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="linkish" onClick={() => setFormMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
