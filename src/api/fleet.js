/**
 * Fleet & aircraft API.
 *
 * Mock paths (real backend paths are placeholders — update when integrating):
 *   GET /api/fleet/find-all?page=0&size=20  -> Page<Fleet>
 *   GET /api/aircraft/find-by-fleet-id/{fleetId}  -> Aircraft[]
 *   GET /api/aircraft/{aircraftId}  -> Aircraft (optional single lookup)
 */

import { fetchJson } from './client.js'

const MOCK_FLEETS = '/mock-api/fleets-page.json'
const MOCK_AIRCRAFT_BY_FLEET = '/mock-api/aircraft-by-fleet.json'

/**
 * @typedef {{ id: string, name: string }} Fleet
 * @typedef {{ id: string, aircraftModel: string, name: string, tailNumber: string, modelUrl?: string, viewConfig?: object }} Aircraft
 */

/**
 * Pageable fleet list.
 * @param {{ page?: number, size?: number }} params
 * @returns {Promise<{ content: Fleet[], totalElements: number, totalPages: number, number: number, size: number }>}
 */
export async function findAllFleets({ page = 0, size = 20 } = {}) {
  const data = await fetchJson(
    MOCK_FLEETS,
    '/api/fleet/find-all',
    { query: { page: String(page), size: String(size) } }
  )
  return data
}

/**
 * Aircraft in a fleet.
 * @param {string} fleetId
 * @returns {Promise<Aircraft[]>}
 */
export async function findAircraftByFleetId(fleetId) {
  if (!fleetId) return []
  const data = await fetchJson(
    MOCK_AIRCRAFT_BY_FLEET,
    `/api/aircraft/find-by-fleet-id/${encodeURIComponent(fleetId)}`
  )
  if (Array.isArray(data)) return data
  return data[fleetId] ?? []
}

/**
 * Single aircraft by id (mock: scans fleet map; real API: single object).
 * @param {string} aircraftId
 * @returns {Promise<Aircraft|null>}
 */
export async function getAircraftById(aircraftId) {
  if (!aircraftId) return null
  const data = await fetchJson(
    MOCK_AIRCRAFT_BY_FLEET,
    `/api/aircraft/${encodeURIComponent(aircraftId)}`
  )
  if (data && !Array.isArray(data) && data.id === aircraftId) return data
  if (Array.isArray(data)) return data.find((a) => a.id === aircraftId) ?? null
  for (const list of Object.values(data)) {
    if (!Array.isArray(list)) continue
    const found = list.find((a) => a.id === aircraftId)
    if (found) return found
  }
  return null
}
