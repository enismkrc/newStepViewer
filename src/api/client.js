/**
 * Shared HTTP client for mock / real backend calls.
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !BASE_URL

export const MOCK_LATENCY_MS = 400
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * GET JSON from mock static file or real API path.
 * @param {string} mockPath  e.g. '/mock-api/lru.json'
 * @param {string} apiPath   e.g. '/api/aircraft/aircraft-1/lru'
 */
export async function fetchJson(mockPath, apiPath) {
  const url = USE_MOCK ? mockPath : `${BASE_URL}${apiPath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`)
  const data = await res.json()
  if (USE_MOCK) await delay(MOCK_LATENCY_MS)
  return data
}
