/**
 * LRU (Line Replaceable Unit) API.
 *
 * --- JSON contract ---
 * GET /api/aircraft/{aircraftId}/lru  ->  LruRecord[]
 *
 * LruRecord = {
 *   part:               string,   // model part/assembly name (links to fault.part)
 *   LRU_Instance_Name:  string,
 *   LRU_Serial_No:      string
 * }
 */

import { fetchJson } from './client.js'

const MOCK_URL = '/mock-api/lru.json'

/**
 * All LRU records for one aircraft.
 * @param {string} aircraftId
 * @returns {Promise<Array>}
 */
export async function getLruByAircraftId(aircraftId) {
  if (!aircraftId) return []
  const data = await fetchJson(MOCK_URL, `/api/aircraft/${encodeURIComponent(aircraftId)}/lru`)
  // Mock file is keyed by aircraft id; real backend returns the array directly.
  return Array.isArray(data) ? data : (data[aircraftId] ?? [])
}

/**
 * LRU record for a specific part/assembly on an aircraft.
 * @param {string} aircraftId
 * @param {string} partName
 * @returns {Promise<Object|null>}
 */
export async function getLruByPart(aircraftId, partName) {
  const list = await getLruByAircraftId(aircraftId)
  return list.find((r) => r.part === partName) ?? null
}
