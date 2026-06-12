/**
 * Aircraft API service layer.
 *
 * This is the SINGLE place that knows where aircraft data comes from. The rest of the
 * app just calls `getAircraftList()` / `getAircraftById(id)` and never cares whether the
 * data is mock or from a real backend.
 *
 * --- Switching to a real backend later ---
 * Set these in a `.env` file (see project root):
 *   VITE_USE_MOCK_API=false
 *   VITE_API_BASE_URL=http://localhost:8080
 *
 * --- JSON contract (what the backend must return) ---
 * GET /api/aircraft           -> Aircraft[]
 * GET /api/aircraft/{id}      -> Aircraft
 *
 * Aircraft = {
 *   id, country, city, fleet, tailNumber, displayName, modelUrl,
 *   hasFault: boolean,
 *   faults: Fault[]
 * }
 * Fault = {
 *   part, type, fin, status, warningFaults
 * }
 *
 * LRU and MFL data are separate endpoints — see src/api/lru.js and src/api/mfl.js.
 */

import { fetchJson } from './client.js'

const MOCK_URL = '/mock-api/aircraft.json'

/**
 * Fetch the full aircraft list.
 * @returns {Promise<Array>}
 */
export async function getAircraftList() {
  return await fetchJson(MOCK_URL, '/api/aircraft')
}

/**
 * Fetch a single aircraft by id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getAircraftById(id) {
  if (!id) return null
  const data = await fetchJson(MOCK_URL, `/api/aircraft/${encodeURIComponent(id)}`)
  // Mock: full list file — find by id. Real backend: single object.
  if (Array.isArray(data)) return data.find((ac) => ac.id === id) ?? null
  return data?.id === id ? data : null
}
