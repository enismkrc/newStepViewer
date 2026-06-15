/**
 * MFL (Maintenance Fault Log) API.
 *
 * GET /api/mfl/get-filtered-mfl-data/{flightId}
 *   -> { mflDataList: MflRecord[] }
 *
 * MflRecord = {
 *   finNumber, absoluteTime, relativeTime, faultCode,
 *   severity, category, description
 * }
 *
 * finNumber = 3D model part / glTF node name for highlight matching.
 */

import { fetchJson } from './client.js'

const MOCK_MFL_BY_FLIGHT = '/mock-api/mfl-by-flight.json'

/**
 * MFL records for a flight.
 * @param {string} flightId
 * @returns {Promise<Array>}
 */
export async function getFilteredMflData(flightId) {
  if (!flightId) return []
  const data = await fetchJson(
    MOCK_MFL_BY_FLIGHT,
    `/api/mfl/get-filtered-mfl-data/${encodeURIComponent(flightId)}`
  )
  if (Array.isArray(data)) return data
  const list = data.mflDataList ?? data[flightId]?.mflDataList ?? data[flightId]
  return Array.isArray(list) ? list : []
}

/**
 * Group MFL rows by finNumber (unique faulty parts for one flight).
 * @param {Array} mflList
 * @returns {Array<{ part: string, type: string, fin: string, status: string, records: Array }>}
 */
export function mflListToFaults(mflList) {
  if (!Array.isArray(mflList) || !mflList.length) return []
  const byPart = new Map()
  for (const row of mflList) {
    const part = String(row.finNumber ?? '').trim()
    if (!part) continue
    if (!byPart.has(part)) {
      byPart.set(part, {
        part,
        type: row.severity ?? 'FAULT',
        fin: part,
        status: row.severity ?? 'FAULT',
        warningFaults: row.description ?? '',
        records: []
      })
    }
    byPart.get(part).records.push(normalizeMflRecord(row))
  }
  return Array.from(byPart.values())
}

/** Normalize backend MFL row for HmsViewer detail panel. */
export function normalizeMflRecord(row) {
  return {
    part: row.finNumber,
    finNumber: row.finNumber,
    MFL_Id: row.faultCode ?? '—',
    MFL_Field_Name: row.category ?? '—',
    MFL_Description: row.description ?? '—',
    MFL_Absulut_time: row.absoluteTime ?? '—',
    MFL_Relative_Time: row.relativeTime ?? '—',
    Fault_Code: row.faultCode ?? '—',
    Severity: row.severity ?? '—',
    Description: row.description ?? '—',
    Category: row.category ?? '—'
  }
}

/** Flat normalized list for detail panel filter by part. */
export function flattenMflForViewer(mflList) {
  return (mflList ?? []).map(normalizeMflRecord)
}
