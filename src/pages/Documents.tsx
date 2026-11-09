import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { enabledExtractFields } from '../settings'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function Documents() {
  const { documents, addDocument, extractDocument, deleteDocument, settings, preferredProvider } =
    useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const activeFields = enabledExtractFields(settings)

  function providerLabel(source?: string) {
    if (source === 'google') return 'Google'
    if (source === 'openai') return 'OpenAI'
    if (source === 'mock') return 'Mock'
    return 'Extract'
  }

  function extractButtonLabel(busy: boolean) {
    if (busy) {
      if (preferredProvider === 'google') return 'Google extracting…'
      if (preferredProvider === 'openai') return 'OpenAI extracting…'
      return 'Extracting…'
    }
    if (preferredProvider === 'google') return 'Extract with Google'
    if (preferredProvider === 'openai') return 'Extract with OpenAI'
    return 'Extract (mock)'
  }

  function onDelete(docId: string, name: string, entryCount: number) {
    const linked =
      entryCount > 0
        ? ` This also removes ${entryCount} linked journal entr${entryCount === 1 ? 'y' : 'ies'} from the books (journal, ledger, and statements).`
        : ''
    if (!window.confirm(`Delete “${name}”?${linked}`)) return
    deleteDocument(docId)
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null)
    const list = [...files].filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
    )
    if (!list.length) {
      setError('Please upload JPEG, PNG, or image-like PDF files.')
      return
    }
    for (const file of list) {
      const dataUrl = await readFileAsDataUrl(file)
      addDocument(file, dataUrl)
    }
  }

  async function onExtract(id: string) {
    setBusyId(id)
    setError(null)
    setLastResult(null)
    try {
      const entry = await extractDocument(id)
      const mode = providerLabel(entry.extractSource)
      setLastResult(
        `${mode} extract → draft ${entry.vendor || 'entry'} · $${entry.lines[0]?.debit || entry.lines[1]?.credit || 0} · fields: ${(entry.extractedFields || activeFields).join(', ')}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extract failed')
    } finally {
      setBusyId(null)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>Upload receipt photos, then extract draft journal entries for review.</p>
        </div>
      </div>

      <div className="status-banner">
        <span className={`badge ${preferredProvider === 'mock' || !preferredProvider ? 'warn' : 'ok'}`}>
          {preferredProvider === 'google'
            ? 'Google'
            : preferredProvider === 'openai'
              ? 'OpenAI'
              : 'Mock extract'}
        </span>
        <span className="muted">
          Requesting fields: {activeFields.join(', ')}. Provider & fields in{' '}
          <Link to="/settings">Settings</Link>.
        </span>
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <strong>Drop JPEG / PNG receipts here</strong>
        <p className="muted">Or click to browse. PDFs accepted when the browser can read them as files.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="error" style={{ marginTop: '0.75rem' }}>{error}</p>}
      {lastResult && (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          <span className="badge ok">Latest extract</span> {lastResult}{' '}
          <Link to="/journal">Open journal</Link>
        </p>
      )}

      <div className="panel" style={{ marginTop: '1.25rem' }}>
        <div className="grid-docs">
          {documents.map((doc) => (
            <article key={doc.id} className="doc-tile">
              <div className="doc-thumb">
                {doc.mimeType.startsWith('image/') || doc.mimeType === 'image/svg+xml' ? (
                  <img src={doc.dataUrl} alt={doc.name} />
                ) : (
                  <span className="muted">PDF</span>
                )}
              </div>
              <div className="doc-meta">
                <strong title={doc.name}>{doc.name}</strong>
                {doc.extractionStatus === 'pending' && <span className="badge pending">Pending extract</span>}
                {doc.extractionStatus === 'extracted' && doc.editRequired && (
                  <span className="badge warn">Edit required</span>
                )}
                {doc.extractionStatus === 'extracted' && !doc.editRequired && (
                  <span className="badge ok">Extracted</span>
                )}
                {doc.lastExtractSource && (
                  <span
                    className={`badge ${doc.lastExtractSource === 'mock' ? 'warn' : 'ok'}`}
                  >
                    {providerLabel(doc.lastExtractSource)}
                  </span>
                )}
                {doc.lastExtractSummary && <span className="muted">{doc.lastExtractSummary}</span>}
                <div className="cta-row">
                  <button
                    className="btn"
                    disabled={busyId === doc.id}
                    onClick={() => void onExtract(doc.id)}
                  >
                    {extractButtonLabel(busyId === doc.id)}
                  </button>
                  {doc.entryIds[0] && (
                    <Link className="btn secondary" to="/journal">
                      Journal
                    </Link>
                  )}
                  <button
                    className="btn danger"
                    disabled={busyId === doc.id}
                    onClick={() => onDelete(doc.id, doc.name, doc.entryIds.length)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!documents.length && <p className="muted">No documents yet.</p>}
      </div>
    </div>
  )
}
