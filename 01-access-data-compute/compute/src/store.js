import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ga4gh_workspaces'
const DEFAULT_BASE_URL = 'http://localhost:8080'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse errors
  }
  return { workspaces: [], drsBaseUrl: DEFAULT_BASE_URL }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function uuid() {
  return crypto.randomUUID()
}

export function useStore() {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  function setDrsBaseUrl(url) {
    setState(s => ({ ...s, drsBaseUrl: url }))
  }

  function addWorkspace() {
    const ws = { id: uuid(), createdAt: Date.now(), uris: [] }
    setState(s => ({ ...s, workspaces: [...s.workspaces, ws] }))
    return ws.id
  }

  function deleteWorkspace(id) {
    setState(s => ({ ...s, workspaces: s.workspaces.filter(w => w.id !== id) }))
  }

  function addUri(workspaceId, uri) {
    setState(s => ({
      ...s,
      workspaces: s.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, uris: [...w.uris, uri] }
          : w
      ),
    }))
  }

  function deleteUri(workspaceId, uri) {
    setState(s => ({
      ...s,
      workspaces: s.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, uris: w.uris.filter(u => u !== uri) }
          : w
      ),
    }))
  }

  return {
    workspaces: state.workspaces,
    drsBaseUrl: state.drsBaseUrl,
    setDrsBaseUrl,
    addWorkspace,
    deleteWorkspace,
    addUri,
    deleteUri,
  }
}
