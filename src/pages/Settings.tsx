import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { AccountsManager } from '../components/AccountsManager'
import { ClearBooksPanel } from '../components/ClearBooksPanel'
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
  const [companyDraft, setCompanyDraft] = useState(settings.companyName)
  const [advancedOpen, setAdvancedOpen] = useState(false)

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

  function onSaveCompany(e: FormEvent) {
    e.preventDefault()
    updateSettings({ ...settings, companyName: companyDraft.trim() || settings.companyName })
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
          <p>
            Company name, chart of accounts, and statement navigation. AI extract is unused for now
            (Advanced).
          </p>
        </div>
      </div>

      <div className="panel settings-block">
        <h2>Company</h2>
        <form className="google-key-form" onSubmit={onSaveCompany}>
          <label className="field">
            <span>Company name (appears on every statement)</span>
            <input
              value={companyDraft}
              onChange={(e) => setCompanyDraft(e.target.value)}
              placeholder="[Company Name]"
            />
          </label>
          <button type="submit" className="btn">
            Save company
          </button>
        </form>
        <p className="muted">
          Period dates are controlled on each books page (Period controls). Change them there to
          refresh Journal through Balance Sheet together.
        </p>
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>Chart of accounts</h2>
        <AccountsManager />
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>Clear books</h2>
        <ClearBooksPanel />
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>How to enter data</h2>
        <ul className="howto-list">
          <li>
            <strong>Accounts</strong> — manage above; add/delete names shared by every journal and
            statement form.
          </li>
          <li>
            <strong>Journal</strong> — primary editable entry (quick post or classic draft).
          </li>
          <li>
            <strong>Ledger / T-Accounts / Trial Balance</strong> — post helpers create balancing
            journal entries; all views recompute.
          </li>
          <li>
            <strong>Income Statement / Balance Sheet</strong> — formatted reports; optional “add
            activity” posts a JE (or edit via Journal).
          </li>
        </ul>
      </div>

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <h2>Navigation</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Toggle which books views appear in the header. Settings always stays available.
        </p>
        <div className="settings-list">
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

      <div className="panel settings-block" style={{ marginTop: '1.1rem' }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? 'Hide' : 'Show'} Advanced (unused AI extract)
        </button>
        {advancedOpen && (
          <div style={{ marginTop: '1rem' }}>
            <p className="muted">
              Receipt AI extract is dormant in the main UX. Code remains available if you reopen{' '}
              <Link to="/documents">Documents</Link> later. Keys are optional and unused by the
              manual books workflow.
            </p>
            <div className="status-banner" style={{ marginBottom: '0.85rem' }}>
              {preferredProvider === 'google' && (
                <span className="badge ok">Google key saved (unused)</span>
              )}
              {preferredProvider === 'openai' && (
                <span className="badge ok">OpenAI available (unused)</span>
              )}
              {preferredProvider === 'mock' && (
                <span className="badge warn">No AI keys — extract would mock if used</span>
              )}
              {openaiConfigured && (
                <span className="muted">Host OPENAI_API_KEY present.</span>
              )}
            </div>

            <h3 className="settings-subhead">Google API key</h3>
            <form className="google-key-form" onSubmit={onSaveGoogleKey}>
              <label className="field">
                <span>Google API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={googleKeySaved ? '••••••••' : 'AIza…'}
                  value={googleKeyDraft}
                  onChange={(e) => setGoogleKeyDraft(e.target.value)}
                />
              </label>
              <div className="cta-row">
                <button type="submit" className="btn">
                  Save
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onClearGoogleKey}
                  disabled={!googleKeySaved}
                >
                  Clear
                </button>
              </div>
            </form>
            {googleKeyMessage && <p className="muted">{googleKeyMessage}</p>}

            <h3 className="settings-subhead">OpenAI API key</h3>
            <form className="google-key-form" onSubmit={onSaveOpenAiKey}>
              <label className="field">
                <span>OpenAI API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={openaiKeySaved ? '••••••••' : 'sk-…'}
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

            <h3 className="settings-subhead">Extract fields (dormant)</h3>
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
            <p style={{ marginTop: '0.75rem' }}>
              <Link className="btn secondary" to="/documents">
                Open Documents (dormant extract UI)
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
