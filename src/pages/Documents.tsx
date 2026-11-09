import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function Documents() {
  const { documents, addDocument, extractDocument, deleteDocument } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    try {
      await extractDocument(id)
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
                <div className="cta-row">
                  <button
                    className="btn"
                    disabled={busyId === doc.id}
                    onClick={() => void onExtract(doc.id)}
                  >
                    {busyId === doc.id ? 'Extracting…' : 'Extract'}
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
