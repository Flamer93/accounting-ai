import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { AccountSelect } from './AccountSelect'
import type { Account, WorksheetEntryDraft, WorksheetSuggestedAccount } from '../types'
import { uid } from '../storage'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

/**
 * Upload a worksheet / narrative transaction-list photo, AI-scan into drafts,
 * review/edit, then bulk-post to the journal/ledger.
 */
export function WorksheetScanPanel() {
  const {
    accounts,
    extractWorksheet,
    postWorksheetEntries,
    preferredProvider,
    googleKeySaved,
    openaiKeySaved,
    openaiConfigured,
  } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<WorksheetSuggestedAccount[]>([])
  const [drafts, setDrafts] = useState<WorksheetEntryDraft[]>([])

  const hasKey = googleKeySaved || openaiKeySaved || Boolean(openaiConfigured)

  const reviewAccounts: Account[] = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.code, a]))
    const inferType = (code: string): Account['type'] => {
      const n = Number(code)
      if (n >= 5000) return 'expense'
      if (n >= 4000) return 'revenue'
      if (n >= 3000) return 'equity'
      if (n >= 2000) return 'liability'
      return 'asset'
    }
    for (const s of suggested) {
      const code = s.code || ''
      if (code && !map.has(code)) {
        map.set(code, { code, name: s.name, type: s.type })
      }
    }
    for (const d of drafts) {
      if (d.debitAccount && !map.has(d.debitAccount)) {
        map.set(d.debitAccount, {
          code: d.debitAccount,
          name: d.debitAccountName || d.debitAccount,
          type: inferType(d.debitAccount),
        })
      }
      if (d.creditAccount && !map.has(d.creditAccount)) {
        map.set(d.creditAccount, {
          code: d.creditAccount,
          name: d.creditAccountName || d.creditAccount,
          type: inferType(d.creditAccount),
        })
      }
    }
    return [...map.values()]
  }, [accounts, drafts, suggested])

  async function runScan(file: File) {
    setError(null)
    setInfo(null)
    if (!file.type.startsWith('image/')) {
      setError('Upload a JPEG or PNG photo of the worksheet.')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPreviewUrl(dataUrl)
      setFilename(file.name)
      const result = await extractWorksheet({ dataUrl, filename: file.name })
      setDrafts(
        result.entries.map((e) => ({
          ...e,
          id: e.id || uid('ws'),
          include: true,
        })),
      )
      setSuggested(result.suggestedAccounts || [])
      setSource(result.source + (result.model ? ` · ${result.model}` : ''))
      const note = [
        result.source === 'mock'
          ? 'Demo mock scan (add an API key in Settings for live AI).'
          : `Scanned ${result.entries.length} transaction${result.entries.length === 1 ? '' : 's'}.`,
        result.warning,
      ]
        .filter(Boolean)
        .join(' ')
      setInfo(note)
    } catch (err) {
      setDrafts([])
      setSuggested([])
      setError(err instanceof Error ? err.message : 'Worksheet scan failed')
    } finally {
      setBusy(false)
    }
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void runScan(file)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void runScan(file)
  }

  function patchDraft(id: string | undefined, patch: Partial<WorksheetEntryDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function onPost() {
    setError(null)
    setInfo(null)
    const selected = drafts.filter((d) => d.include !== false)
    if (!selected.length) {
      setError('Select at least one transaction to post.')
      return
    }
    const result = postWorksheetEntries({
      entries: drafts,
      suggestedAccounts: suggested,
    })
    if (result.postedIds.length) {
      setInfo(
        `Posted ${result.postedIds.length} entr${result.postedIds.length === 1 ? 'y' : 'ies'} to the journal and ledger.`,
      )
      setDrafts((prev) => prev.filter((d) => d.include === false))
      if (result.errors.length) {
        setError(result.errors.join(' · '))
      } else {
        setSuggested([])
      }
    } else {
      setError(result.errors.join(' · ') || 'Nothing posted.')
    }
  }

  return (
    <div className="panel worksheet-scan">
      <div className="worksheet-scan-head">
        <div>
          <strong>Scan worksheet image</strong>
          <p className="muted">
            Upload a photo of a transaction list (cheques, invoices, narrative problems). AI maps
            lines to your existing chart of accounts only — it will not invent new accounts — then
            you review and post.
          </p>
        </div>
        <Link className="btn secondary btn-compact" to="/settings">
          {hasKey ? 'API keys' : 'Add API key'}
        </Link>
      </div>

      {!hasKey && (
        <p className="inline-alert" role="status">
          No AI key yet — scans use a demo mock. Add a Google Gemini or OpenAI key in Settings for
          live OCR (provider: {preferredProvider || 'mock'}).
        </p>
      )}

      <label
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFileInput}
          disabled={busy}
        />
        {busy ? (
          <span>Scanning worksheet…</span>
        ) : (
          <span>
            Drop a worksheet photo here, or <u>browse</u>
          </span>
        )}
      </label>

      {previewUrl && (
        <div className="worksheet-preview">
          <img src={previewUrl} alt={filename || 'Worksheet preview'} />
        </div>
      )}

      {info && <p className="muted">{info}{source ? ` · ${source}` : ''}</p>}
      {error && <p className="error">{error}</p>}

      {drafts.length > 0 && (
        <div className="worksheet-review">
          <div className="worksheet-review-head">
            <strong>Review before posting</strong>
            <div className="cta-row">
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={() => setDrafts((prev) => prev.map((d) => ({ ...d, include: true })))}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={() => setDrafts((prev) => prev.map((d) => ({ ...d, include: false })))}
              >
                Select none
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="ledger worksheet-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={d.include !== false}
                        onChange={(e) => patchDraft(d.id, { include: e.target.checked })}
                        aria-label={`Include ${d.memo}`}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={d.date}
                        onChange={(e) => patchDraft(d.id, { date: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={d.memo}
                        onChange={(e) => patchDraft(d.id, { memo: e.target.value })}
                      />
                      {d.reference ? <div className="muted">{d.reference}</div> : null}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={d.amount}
                        onChange={(e) => patchDraft(d.id, { amount: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <AccountSelect
                        accounts={reviewAccounts}
                        value={d.debitAccount}
                        onChange={(e) => patchDraft(d.id, { debitAccount: e.target.value })}
                      />
                    </td>
                    <td>
                      <AccountSelect
                        accounts={reviewAccounts}
                        value={d.creditAccount}
                        onChange={(e) => patchDraft(d.id, { creditAccount: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cta-row" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" onClick={onPost} disabled={busy}>
              Post selected to books
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setDrafts([])
                setSuggested([])
                setPreviewUrl(null)
                setInfo(null)
                setError(null)
                setSource(null)
              }}
            >
              Clear
            </button>
            <Link className="btn secondary" to="/journal">
              Open journal
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
