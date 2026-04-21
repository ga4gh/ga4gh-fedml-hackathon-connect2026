/**
 * Parse a DRS URI into its components.
 * Format: drs://hostname[:port]/object_id
 * Returns { host, objectId } or null if invalid.
 */
export function parseDrsUri(uri) {
  if (typeof uri !== 'string') return null
  const match = uri.trim().match(/^drs:\/\/([^/]+)\/(.+)$/)
  if (!match) return null
  return { host: match[1], objectId: match[2] }
}

/**
 * Resolve a DRS object using the configured base URL.
 * Returns the parsed JSON response, or throws on error.
 */
export async function resolveDrsObject(baseUrl, objectId) {
  const url = `${baseUrl.replace(/\/$/, '')}/ga4gh/drs/v1/objects/${encodeURIComponent(objectId)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail ?? `HTTP ${res.status}`)
  }
  return data
}

function buildDrsUri(baseUrl, object) {
  if (typeof object?.self_uri === 'string' && parseDrsUri(object.self_uri)) {
    return object.self_uri
  }

  const objectId = typeof object?.id === 'string' ? object.id.trim() : ''
  if (!objectId) return null

  const url = new URL(baseUrl)
  return `drs://${url.host}/${objectId}`
}

/**
 * List available DRS objects using the server's convenience endpoint.
 * Returns [{ id, name, uri }], or throws on error.
 */
export async function listDrsObjects(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/ga4gh/drs/v1/objects`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail ?? `HTTP ${res.status}`)
  }

  const objects = Array.isArray(data?.objects) ? data.objects : []
  return objects
    .map(object => {
      const uri = buildDrsUri(baseUrl, object)
      if (!uri) return null
      return {
        id: object.id,
        name: object.name,
        uri,
      }
    })
    .filter(Boolean)
}
