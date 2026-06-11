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
 *   VITE_API_BASE_URL=http://localhost:8080   (your backend address)
 * Then the same functions below will hit `${VITE_API_BASE_URL}/api/aircraft` instead of
 * the local mock JSON. No page/component changes needed.
 *
 * --- JSON contract (what the backend must return) ---
 * GET /api/aircraft           -> Aircraft[]   (array)
 * GET /api/aircraft/{id}      -> Aircraft     (single object)
 *
 * Aircraft = {
 *   id:           string,            // unique id, used in the viewer route
 *   country:      string,
 *   city:         string,
 *   fleet:        string,
 *   tailNumber:   string,
 *   displayName:  string,
 *   modelUrl:     string,            // URL of the GLB/glTF model to load
 *   hasFault:     boolean,
 *   faults:       Fault[]            // empty array when healthy
 * }
 * Fault = {
 *   part:          string,           // leaf part OR assembly name inside the model
 *   type:          string,           // e.g. "FAULT" | "WARNING" | "SENSOR"
 *   fin:           string,           // fault identification number (shown on the card)
 *   status:        string,           // e.g. "FAULT" | "WARNING"
 *   warningFaults: string            // human-readable description
 * }
 */

// Read configuration from environment variables (Vite exposes VITE_* to the frontend).
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
// Use the mock when explicitly enabled OR when no backend address is configured.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !BASE_URL

// Where the mock JSON lives (served statically from /public). This file mimics exactly
// what the real backend response will look like.
const MOCK_URL = '/mock-api/aircraft.json'

// Simulate network latency so loading states are visible during development.
const MOCK_LATENCY_MS = 400
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Fetch the full aircraft list.
 * @returns {Promise<Array>} array of aircraft objects
 */
export async function getAircraftList() {
  if (USE_MOCK) {
    // Real HTTP GET of a static JSON file -> behaves just like a backend response.
    const res = await fetch(MOCK_URL)
    if (!res.ok) throw new Error(`Mock API error: ${res.status}`)
    const data = await res.json()
    await delay(MOCK_LATENCY_MS)
    return data
  }

  const res = await fetch(`${BASE_URL}/api/aircraft`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return await res.json()
}

/**
 * Fetch a single aircraft by id.
 * @param {string} id
 * @returns {Promise<Object|null>} the aircraft, or null if not found
 */
export async function getAircraftById(id) {
  if (USE_MOCK) {
    // The mock has no per-id endpoint, so we load the list and find the match.
    const list = await getAircraftList()
    return list.find((ac) => ac.id === id) ?? null
  }

  const res = await fetch(`${BASE_URL}/api/aircraft/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return await res.json()
}
