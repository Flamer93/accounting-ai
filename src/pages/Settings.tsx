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
    openaiKeySaved,
    saveGoogleKey,
    removeGoogleKey,
    saveOpenAiKey,
    removeOpenAiKey,
    preferredProvider,
  } = useApp()
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [googleKeyDraft, setGoogleKeyDraft] = useState('')
  const [googleKeyMessage, setGoogleKeyMessage] = useState<string | null>(null)
  const [openaiKeyDraft, setOpenaiKeyDraft] = useState('')
  const [openaiKeyMessage, setOpenaiKeyMessage] = useState<string | null>(null)

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

  function onSaveOpenAiKey(e: FormEvent) {
    e.preventDefault()
    if (!openaiKeyDraft.trim()) {
      setOpenaiKeyMessage('Enter an OpenAI API key, or use Clear to remove a saved key.')
      return
    }
    saveOpenAiKey(openaiKeyDraft)
    setOpenaiKeyDraft('')
    setOpenaiKeyMessage('OpenAI API key saved in this browser only (localStorage).')
  }

  function onClearOpenAiKey() {
    removeOpenAiKey()
    setOpenaiKeyDraft('')
    setOpenaiKeyMessage('OpenAI API key removed from this browser.')
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
        <h2>API keys</h2>
        <div className="status-banner" style={{ marginBottom: '0.85rem' }}>
          {preferredProvider === 'google' && (
            <>
              <span className="badge ok">Google Gemini preferred</span>
              <span className="muted">A Google API key is saved in this browser.</span>
            </>
          )}
          {preferredProvider === 'openai' && (
            <>
              <span className="badge ok">OpenAI preferred</span>
              <span className="muted">
                {openaiKeySaved
                  ? 'Using the OpenAI key saved in this browser.'
                  : 'Using host OPENAI_API_KEY (no browser Google key).'}
              </span>
            </>
          )}
          {preferredProvider === 'mock' && (
            <>
              <span className="badge warn">Mock extract</span>
              <span className="muted">
                No Google or OpenAI key saved (and no host OpenAI) — extracts use editable sample drafts.
              </span>
            </>
          )}
          {preferredProvider === null && <span className="muted">Checking extract provider…</span>}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Priority: Google (Settings) → OpenAI (Settings or host <code>OPENAI_API_KEY</code>) → mock. Keys stay
          in browser localStorage only, are never logged, and are sent per Extract request via headers. Do not
          paste keys into chat.
        </p>

        <h3 className="settings-subhead">Google API key</h3>
        <p className="muted">
          Gemini multimodal OCR — prefers <code>gemini-2.5-pro</code>, then flash fallbacks. Sent as{' '}
          <code>X-Google-Api-Key</code>.
        </p>
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

        <h3 className="settings-subhead">OpenAI API key</h3>
        <p className="muted">
          Vision extract with <code>gpt-4o</code>. Sent as <code>X-OpenAI-Api-Key</code>. Used when no
          Google key is saved (or as fallback if Google fails).
          {openaiConfigured ? ' Host OPENAI_API_KEY is also available.' : ''}
        </p>
        <form className="google-key-form" onSubmit={onSaveOpenAiKey}>
          <label className="field">
            <span>OpenAI API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={openaiKeySaved ? '••••••••  (saved — enter a new key to replace)' : 'sk-…'}
              value={openaiKeyDraft}
              onChange={(e) => setOpenaiKeyDraft(e.target.value)}
            />
          </label>
          <div className="cta-row">
            <button type="submit" className="btn">
              Save
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={onClearOpenAiKey}
              disabled={!openaiKeySaved}
            >
              Clear
            </button>
          </div>
        </form>
        {openaiKeyMessage && <p className="muted">{openaiKeyMessage}</p>}
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>AI extraction fields</h2>
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
