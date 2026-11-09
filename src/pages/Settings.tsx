import { useState } from 'react'
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
  const { settings, updateSettings, openaiConfigured } = useApp()
  const [fieldError, setFieldError] = useState<string | null>(null)

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

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Choose which views appear in the nav and which fields AI (or mock) extract should fill.</p>
        </div>
      </div>

      <div className="panel settings-block">
        <h2>AI extraction</h2>
        <div className="status-banner" style={{ marginBottom: '0.85rem' }}>
          {openaiConfigured === true ? (
            <>
              <span className="badge ok">OpenAI vision active</span>
              <span className="muted">
                Extracts use the host <code>OPENAI_API_KEY</code> secret. No key is stored in the browser.
              </span>
            </>
          ) : openaiConfigured === false ? (
            <>
              <span className="badge warn">Mock extract active</span>
              <span className="muted">
                Live AI needs <code>OPENAI_API_KEY</code> set in the published/host environment. Until then,
                extracts return editable sample drafts.
              </span>
            </>
          ) : (
            <span className="muted">Checking extract provider…</span>
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
