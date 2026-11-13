import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../AppContext'
import { AccountsManager } from '../components/AccountsManager'
import { ClearBooksPanel } from '../components/ClearBooksPanel'
import { JournalSavesPanel } from '../components/JournalSavesPanel'
import { OpeningBalancesPanel } from '../components/OpeningBalancesPanel'
import { NAV_VIEW_META, toggleNavView, type NavViewKey } from '../settings'

export function Settings() {
  const { settings, updateSettings } = useApp()
  const [companyDraft, setCompanyDraft] = useState(settings.companyName)

  useEffect(() => {
    setCompanyDraft(settings.companyName)
  }, [settings.companyName])

  function onNavToggle(key: NavViewKey, enabled: boolean) {
    updateSettings(toggleNavView(settings, key, enabled))
  }

  function onSaveCompany(e: FormEvent) {
    e.preventDefault()
    updateSettings({ ...settings, companyName: companyDraft.trim() || settings.companyName })
  }

  return (
    <div className="settings-page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Company, accounts, openings, saved journals, and navigation.</p>
        </div>
      </div>

      <div className="panel settings-block">
        <h2>Company</h2>
        <form className="settings-form" onSubmit={onSaveCompany}>
          <label className="field">
            <span>Company name</span>
            <input
              value={companyDraft}
              onChange={(e) => setCompanyDraft(e.target.value)}
              placeholder="Company name"
            />
          </label>
          <button type="submit" className="btn">
            Save
          </button>
        </form>
      </div>

      <div className="panel settings-block">
        <h2>Chart of accounts</h2>
        <AccountsManager />
      </div>

      <div className="panel settings-block">
        <h2>Opening balances</h2>
        <OpeningBalancesPanel />
      </div>

      <div className="panel settings-block">
        <h2>Saved journals</h2>
        <JournalSavesPanel />
      </div>

      <div className="panel settings-block">
        <h2>Clear books</h2>
        <ClearBooksPanel />
      </div>

      <div className="panel settings-block">
        <h2>Navigation</h2>
        <p className="muted settings-lead">Choose which books views appear in the header.</p>
        <div className="settings-list">
          {NAV_VIEW_META.map((view) => (
            <label className="settings-row" key={view.key}>
              <span>
                <strong>{view.label}</strong>
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
