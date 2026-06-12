/**
 * MFL (Maintenance Fault Log) API.
 *
 * --- JSON contract ---
 * GET /api/aircraft/{aircraftId}/mfl  ->  MflRecord[]
 *
 * MflRecord = {
 *   part:               string,   // model part/assembly name (links to fault.part)
 *   MFL_Id:             string,
 *   MFL_Field_Name:     string,
 *   MFL_Description:    string,
 *   MFL_Absulut_time:   string,   // ISO-8601 absolute timestamp
 *   MFL_Relative_Time:  string,   // e.g. "T+00:12:45"
 *   Fault_Code:         string,
 *   Severity:           string,   // e.g. "FAULT" | "WARNING"
 *   Description:        string
 * }
 */

import { fetchJson } from './client.js'

const MOCK_URL = '/mock-api/mfl.json'

/**
 * All MFL records for one aircraft.
 * @param {string} aircraftId
 * @returns {Promise<Array>}
 */
export async function getMflByAircraftId(aircraftId) {
  if (!aircraftId) return []
  const data = await fetchJson(MOCK_URL, `/api/aircraft/${encodeURIComponent(aircraftId)}/mfl`)
  return Array.isArray(data) ? data : (data[aircraftId] ?? [])
}

/**
 * MFL records for one part/assembly on an aircraft (may be multiple).
 * @param {string} aircraftId
 * @param {string} partName
 * @returns {Promise<Array>}
 */
export async function getMflByPart(aircraftId, partName) {
  const list = await getMflByAircraftId(aircraftId)
  return list.filter((r) => r.part === partName)
}
