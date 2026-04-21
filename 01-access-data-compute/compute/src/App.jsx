import { useEffect, useState } from 'react'
import { useStore } from './store.js'
import { listDrsObjects, parseDrsUri, resolveDrsObject } from './drs.js'

// ---------------------------------------------------------------------------
// DRS URI row — displays the URI, resolve button, and resolution result
// ---------------------------------------------------------------------------

function DrsUriRow({ uri, workspaceId, drsBaseUrl, onDelete }) {
  const [status, setStatus] = useState('idle') // idle | loading | ok | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const parsed = parseDrsUri(uri)

  async function handleResolve() {
    if (!parsed) return
    setStatus('loading')
    setResult(null)
    setError(null)
    setExpanded(true)
    try {
      const data = await resolveDrsObject(drsBaseUrl, parsed.objectId)
      setResult(data)
      setStatus('ok')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <li className="uri-row">
      <div className="uri-row-header">
        <code className={`uri-text ${!parsed ? 'uri-invalid' : ''}`} title={uri}>
          {uri}
        </code>
        <div className="uri-actions">
          {parsed && (
            <button
              className="btn btn-resolve"
              onClick={handleResolve}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Resolving…' : 'Resolve'}
            </button>
          )}
          {result && (
            <button
              className="btn btn-ghost"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'Hide' : 'Show'}
            </button>
          )}
          <button className="btn btn-danger" onClick={() => onDelete(uri)}>
            Remove
          </button>
        </div>
      </div>

      {!parsed && (
        <p className="uri-parse-error">Invalid DRS URI — expected <code>drs://hostname/object_id</code></p>
      )}

      {expanded && status === 'ok' && result && (
        <pre className="resolution-result">{JSON.stringify(result, null, 2)}</pre>
      )}

      {status === 'error' && (
        <p className="resolution-error">Error: {error}</p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Workspace view — URI list + add form
// ---------------------------------------------------------------------------

function WorkspaceView({ workspace, drsBaseUrl, onAddUri, onDeleteUri }) {
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsStatus, setSuggestionsStatus] = useState('idle')
  const [suggestionsError, setSuggestionsError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      setSuggestionsStatus('loading')
      setSuggestionsError(null)

      try {
        const objects = await listDrsObjects(drsBaseUrl)
        if (cancelled) return
        setSuggestions(objects)
        setSuggestionsStatus('ok')
      } catch (error) {
        if (cancelled) return
        setSuggestions([])
        setSuggestionsStatus('error')
        setSuggestionsError(error.message)
      }
    }

    loadSuggestions()

    return () => {
      cancelled = true
    }
  }, [drsBaseUrl])

  function handleAdd(e) {
    e.preventDefault()
    const uri = input.trim()
    if (!uri) return
    if (!parseDrsUri(uri)) {
      setInputError('Must be a valid DRS URI: drs://hostname/object_id')
      return
    }
    if (workspace.uris.includes(uri)) {
      setInputError('URI already in this workspace')
      return
    }
    onAddUri(workspace.id, uri)
    setInput('')
    setInputError(null)
  }

  return (
    <div className="workspace-view">
      <form className="add-uri-form" onSubmit={handleAdd}>
        <div className="add-uri-input-group">
          <input
            className={`uri-input ${inputError ? 'input-error' : ''}`}
            type="text"
            placeholder="drs://hostname/object_id"
            value={input}
            onChange={e => { setInput(e.target.value); setInputError(null) }}
            spellCheck={false}
            list={`workspace-uri-options-${workspace.id}`}
          />
          <datalist id={`workspace-uri-options-${workspace.id}`}>
            {suggestions.map(item => (
              <option key={item.uri} value={item.uri} label={item.name ?? item.id} />
            ))}
          </datalist>
        </div>
        <button className="btn btn-primary" type="submit">Add URI</button>
      </form>
      {inputError && <p className="form-error">{inputError}</p>}
      {!inputError && suggestionsStatus === 'loading' && (
        <p className="form-hint">Loading DRS object suggestions…</p>
      )}
      {!inputError && suggestionsStatus === 'ok' && suggestions.length > 0 && (
        <p className="form-hint">Autocomplete includes {suggestions.length} object{suggestions.length !== 1 ? 's' : ''} from the configured DRS server.</p>
      )}
      {!inputError && suggestionsStatus === 'error' && (
        <p className="form-error">Could not load autocomplete options: {suggestionsError}</p>
      )}

      {workspace.uris.length === 0 ? (
        <p className="empty-state">No DRS URIs yet. Add one above.</p>
      ) : (
        <ul className="uri-list">
          {workspace.uris.map(uri => (
            <DrsUriRow
              key={uri}
              uri={uri}
              workspaceId={workspace.id}
              drsBaseUrl={drsBaseUrl}
              onDelete={u => onDeleteUri(workspace.id, u)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export default function App() {
  const store = useStore()
  const [selectedId, setSelectedId] = useState(null)
  const [serverUrl, setServerUrl] = useState(store.drsBaseUrl)
  const [editingServer, setEditingServer] = useState(false)

  const selectedWorkspace = store.workspaces.find(w => w.id === selectedId) ?? null

  function handleNewWorkspace() {
    const id = store.addWorkspace()
    setSelectedId(id)
  }

  function handleDeleteWorkspace(id) {
    store.deleteWorkspace(id)
    if (selectedId === id) setSelectedId(null)
  }

  function handleServerSave(e) {
    e.preventDefault()
    store.setDrsBaseUrl(serverUrl.trim())
    setEditingServer(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">GA4GH Research Workspace</span>
        <div className="server-config">
          <span className="server-label">DRS server:</span>
          {editingServer ? (
            <form className="server-form" onSubmit={handleServerSave}>
              <input
                className="server-input"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                autoFocus
                spellCheck={false}
              />
              <button className="btn btn-primary btn-sm" type="submit">Save</button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => { setServerUrl(store.drsBaseUrl); setEditingServer(false) }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <code className="server-url">{store.drsBaseUrl}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingServer(true)}>
                Edit
              </button>
            </>
          )}
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <button className="btn btn-primary btn-block" onClick={handleNewWorkspace}>
            + New Workspace
          </button>
          <ul className="workspace-list">
            {store.workspaces.length === 0 && (
              <li className="empty-state sidebar-empty">No workspaces yet.</li>
            )}
            {store.workspaces.map((ws, idx) => (
              <li
                key={ws.id}
                className={`workspace-item ${ws.id === selectedId ? 'active' : ''}`}
              >
                <button
                  className="workspace-select-btn"
                  onClick={() => setSelectedId(ws.id)}
                >
                  <span className="workspace-name">Workspace {idx + 1}</span>
                  <span className="workspace-count">{ws.uris.length} URI{ws.uris.length !== 1 ? 's' : ''}</span>
                </button>
                <button
                  className="btn btn-danger btn-sm workspace-delete-btn"
                  title="Delete workspace"
                  onClick={() => handleDeleteWorkspace(ws.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          {selectedWorkspace ? (
            <WorkspaceView
              workspace={selectedWorkspace}
              drsBaseUrl={store.drsBaseUrl}
              onAddUri={store.addUri}
              onDeleteUri={store.deleteUri}
            />
          ) : (
            <div className="no-selection">
              <p>Select a workspace from the sidebar, or create a new one.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
