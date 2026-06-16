/**
 * Fleet & aircraft API.
 *
 * Mock paths (real backend paths are placeholders — update when integrating):
 *   GET /api/fleet/find-all?page=0&size=20  -> Page<Fleet>
 *   GET /api/aircraft/find-by-fleet-id/{fleetId}  -> Aircraft[]
 *   GET /api/aircraft/{aircraftId}  -> Aircraft (optional single lookup)
 *
 * NOT: Backend `modelUrl` / `viewConfig` döndürmüyor. Bu alanlar `attachModel` ile
 * src/config/modelRegistry.js üzerinden MANUEL ekleniyor. Backend ileride bu alanları
 * döndürürse backend değeri korunur.
 */

import { fetchJson } from './client.js'
import { attachModel } from '../config/modelRegistry.js'

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
  const list = Array.isArray(data) ? data : (data[fleetId] ?? [])
  return list.map(attachModel)
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
  if (data && !Array.isArray(data) && data.id === aircraftId) return attachModel(data)
  if (Array.isArray(data)) {
    const found = data.find((a) => a.id === aircraftId)
    return found ? attachModel(found) : null
  }
  for (const list of Object.values(data)) {
    if (!Array.isArray(list)) continue
    const found = list.find((a) => a.id === aircraftId)
    if (found) return attachModel(found)
  }
  return null
}
