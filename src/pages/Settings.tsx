import { useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import {
  EXTRACT_FIELD_META,
  NAV_VIEW_META,
  toggleExtractField,
  toggleNavView,
  type ExtractFieldKey,
  type NavViewKey,
} from '../settings'

export function Settings() {
  const {
    settings,
    updateSettings,
    openaiConfigured,
    googleKeySaved,
    saveGoogleKey,
    removeGoogleKey,
    preferredProvider,
  } = useApp()
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [googleKeyDraft, setGoogleKeyDraft] = useState('')
  const [googleKeyMessage, setGoogleKeyMessage] = useState<string | null>(null)

  function onNavToggle(key: NavViewKey, enabled: boolean) {
    updateSettings(toggleNavView(settings, key, enabled))
  }

  function onFieldToggle(key: ExtractFieldKey, enabled: boolean) {
    const result = toggleExtractField(settings, key, enabled)
    if (result.error) {
      setFieldError(result.error)
      return
    }
    setFieldError(null)
    updateSettings(result.settings)
  }

  function onSaveGoogleKey(e: FormEvent) {
    e.preventDefault()
    if (!googleKeyDraft.trim()) {
      setGoogleKeyMessage('Enter a Google API key, or use Clear to remove a saved key.')
      return
    }
    saveGoogleKey(googleKeyDraft)
    setGoogleKeyDraft('')
    setGoogleKeyMessage('Google API key saved in this browser only (localStorage).')
  }

  function onClearGoogleKey() {
    removeGoogleKey()
    setGoogleKeyDraft('')
    setGoogleKeyMessage('Google API key removed from this browser.')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Choose which views appear in the nav and which fields AI (or mock) extract should fill.</p>
        </div>
      </div>

      <div className="panel settings-block">
        <h2>Google API key</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Paste a <strong>Google API key</strong> for Gemini multimodal receipt extraction (Generative
          Language API). The key stays in this browser&apos;s localStorage for private single-user use —
          it is never committed, never logged, and only sent to the server on each Extract request via
          the <code>X-Google-Api-Key</code> header (request-scoped). Anyone with access to this browser
          profile can read localStorage.
        </p>
        <div className="status-banner" style={{ marginBottom: '0.85rem' }}>
          {preferredProvider === 'google' && (
            <>
              <span className="badge ok">Google Gemini preferred</span>
              <span className="muted">A Google API key is saved in this browser.</span>
            </>
          )}
          {preferredProvider === 'openai' && (
            <>
              <span className="badge ok">OpenAI fallback</span>
              <span className="muted">
                No Google key here; host <code>OPENAI_API_KEY</code> is available.
              </span>
            </>
          )}
          {preferredProvider === 'mock' && (
            <>
              <span className="badge warn">Mock extract</span>
              <span className="muted">
                No Google key saved and no host OpenAI key — extracts use editable sample drafts.
              </span>
            </>
          )}
          {preferredProvider === null && <span className="muted">Checking extract provider…</span>}
        </div>
        <form className="google-key-form" onSubmit={onSaveGoogleKey}>
          <label className="field">
            <span>Google API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={googleKeySaved ? '••••••••  (saved — enter a new key to replace)' : 'AIza…'}
              value={googleKeyDraft}
              onChange={(e) => setGoogleKeyDraft(e.target.value)}
            />
          </label>
          <div className="cta-row">
            <button type="submit" className="btn">
              Save
            </button>
            <button type="button" className="btn secondary" onClick={onClearGoogleKey} disabled={!googleKeySaved}>
              Clear
            </button>
          </div>
        </form>
        {googleKeyMessage && <p className="muted">{googleKeyMessage}</p>}
        <p className="muted">
          Priority: Google key (Settings) → host <code>OPENAI_API_KEY</code> → mock. Do not paste keys into
          chat.
        </p>
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>AI extraction fields</h2>
        <div className="status-banner" style={{ marginBottom: '0.85rem' }}>
          {openaiConfigured === true ? (
            <>
              <span className="badge ok">Host OpenAI available</span>
              <span className="muted">
                Used only when no Google key is saved. Host secret is not stored in the browser.
              </span>
            </>
          ) : openaiConfigured === false ? (
            <>
              <span className="badge pending">Host OpenAI unset</span>
              <span className="muted">
                Optional fallback: set <code>OPENAI_API_KEY</code> in the published/host environment.
              </span>
            </>
          ) : (
            <span className="muted">Checking host OpenAI…</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Amount is always required. Keep at least one of debit or credit account enabled so double-entry
          drafts can be built (the other side defaults when hidden).
        </p>
        {fieldError && <p className="error">{fieldError}</p>}
        <div className="settings-list">
          {EXTRACT_FIELD_META.map((field) => (
            <label className="settings-row" key={field.key}>
              <span>
                <strong>{field.label}</strong>
                <span className="muted">{field.description}</span>
              </span>
              <input
                type="checkbox"
                checked={settings.extractFields[field.key]}
                disabled={field.locked}
                onChange={(e) => onFieldToggle(field.key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>Navigation</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Documents and Settings stay available. Toggle the statement views you want in the header.
        </p>
        <div className="settings-list">
          <div className="settings-row locked">
            <span>
              <strong>Documents</strong>
              <span className="muted">Always shown — upload and extract live here.</span>
            </span>
            <span className="badge ok">On</span>
          </div>
          <div className="settings-row locked">
            <span>
              <strong>Settings</strong>
              <span className="muted">Always shown.</span>
            </span>
            <span className="badge ok">On</span>
          </div>
          {NAV_VIEW_META.map((view) => (
            <label className="settings-row" key={view.key}>
              <span>
                <strong>{view.label}</strong>
                <span className="muted">{view.path}</span>
              </span>
              <input
                type="checkbox"
                checked={settings.nav[view.key]}
                onChange={(e) => onNavToggle(view.key, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
