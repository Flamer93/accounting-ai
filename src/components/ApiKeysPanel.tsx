import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'

/**
 * Per-user Google Gemini / OpenAI keys for receipt + worksheet image extract.
 * Keys stay in localStorage only — never logged by the extract server.
 */
export function ApiKeysPanel() {
  const {
    googleKeySaved,
    openaiKeySaved,
    openaiConfigured,
    preferredProvider,
    saveGoogleKey,
    removeGoogleKey,
    saveOpenAiKey,
    removeOpenAiKey,
  } = useApp()
  const [googleDraft, setGoogleDraft] = useState('')
  const [openaiDraft, setOpenaiDraft] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  function onSaveGoogle(e: FormEvent) {
    e.preventDefault()
    if (!googleDraft.trim()) {
      setMsg('Paste a Google AI Studio / Gemini API key first.')
      return
    }
    saveGoogleKey(googleDraft)
    setGoogleDraft('')
    setMsg('Google Gemini key saved on this device.')
  }

  function onSaveOpenAi(e: FormEvent) {
    e.preventDefault()
    if (!openaiDraft.trim()) {
      setMsg('Paste an OpenAI API key first.')
      return
    }
    saveOpenAiKey(openaiDraft)
    setOpenaiDraft('')
    setMsg('OpenAI key saved on this device.')
  }

  const providerLabel =
    preferredProvider === 'google'
      ? 'Google Gemini (preferred)'
      : preferredProvider === 'openai'
        ? 'OpenAI'
        : preferredProvider === 'mock'
          ? 'Mock (no key — demo drafts only)'
          : 'Checking…'

  return (
    <div className="api-keys-panel">
      <p className="muted settings-lead">
        Used to scan receipt and worksheet photos under{' '}
        <Link to="/add-transaction">Add a transaction</Link>. Keys stay on this device; Google is
        tried first, then OpenAI.
      </p>
      <p className="muted">
        Active provider: <strong>{providerLabel}</strong>
        {openaiConfigured ? ' · Host also has an OpenAI env key' : ''}
      </p>

      <form className="settings-form" onSubmit={onSaveGoogle}>
        <label className="field">
          <span>Google Gemini API key {googleKeySaved ? '(saved)' : ''}</span>
          <input
            type="password"
            autoComplete="off"
            value={googleDraft}
            onChange={(e) => setGoogleDraft(e.target.value)}
            placeholder={googleKeySaved ? '•••••••• (enter to replace)' : 'AIza…'}
          />
        </label>
        <div className="cta-row">
          <button type="submit" className="btn">
            Save Google key
          </button>
          {googleKeySaved && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                removeGoogleKey()
                setMsg('Google key removed.')
              }}
            >
              Remove
            </button>
          )}
        </div>
      </form>

      <form className="settings-form" onSubmit={onSaveOpenAi} style={{ marginTop: '0.85rem' }}>
        <label className="field">
          <span>OpenAI API key {openaiKeySaved ? '(saved)' : ''}</span>
          <input
            type="password"
            autoComplete="off"
            value={openaiDraft}
            onChange={(e) => setOpenaiDraft(e.target.value)}
            placeholder={openaiKeySaved ? '•••••••• (enter to replace)' : 'sk-…'}
          />
        </label>
        <div className="cta-row">
          <button type="submit" className="btn">
            Save OpenAI key
          </button>
          {openaiKeySaved && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                removeOpenAiKey()
                setMsg('OpenAI key removed.')
              }}
            >
              Remove
            </button>
          )}
        </div>
      </form>

      {msg && (
        <p className="muted" style={{ marginTop: '0.65rem' }}>
          {msg}
        </p>
      )}
    </div>
  )
}
