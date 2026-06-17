/**
 * Flight API.
 *
 * GET /api/flight/find-by-aircraft-id/{aircraftId}  -> Flight[]
 *
 * Flight = { id, flightNo }
 */

import { fetchJson } from './client.js'

const MOCK_FLIGHTS = '/mock-api/flights-by-aircraft.json'

/**
 * @param {string} aircraftId
 * @returns {Promise<Array<{ id: string, flightNo: string }>>}
 */
export async function findFlightsByAircraftId(aircraftId) {
  if (!aircraftId) return []
  const raw = await fetchJson(
    MOCK_FLIGHTS,
    `/api/flight/find-by-aircraft-id/${encodeURIComponent(aircraftId)}`
  )
  // Backend zarfı ({ success, data }) ve mock map şekli ({ "aircraft-id": [...] }) desteklenir.
  const data = raw?.data ?? raw
  if (Array.isArray(data)) return data
  return data[aircraftId] ?? []
}
