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
 *
 * !!! GEÇİCİ: Backend `finNumber`'ı boş döndürdüğü için MFL verisi HER ZAMAN
 * mock'tan (public/mock-api/mfl-by-flight.json) okunur. (forceMock=true)
 * Filo/uçak/uçuş listeleri gerçek backend'den gelir; sadece MFL mock'tur.
 * Backend MFL'i düzgün döndürmeye başlayınca `forceMock`'u kaldırın.
 */

import { fetchJson } from './client.js'

const MOCK_MFL_BY_FLIGHT = '/mock-api/mfl-by-flight.json'

/**
 * MFL records for a flight (always read from mock for now).
 *
 * Gerçek backend `flightId`'leri mock anahtarlarıyla eşleşmez. Bu yüzden:
 *   1) flightId tam eşleşirse o uçuşun verisi,
 *   2) yoksa "default" anahtarı,
 *   3) o da yoksa ilk uçuşun verisi kullanılır.
 * @param {string} flightId
 * @returns {Promise<Array>}
 */
export async function getFilteredMflData(flightId) {
  if (!flightId) return []
  const data = await fetchJson(
    MOCK_MFL_BY_FLIGHT,
    `/api/mfl/get-filtered-mfl-data/${encodeURIComponent(flightId)}`,
    { forceMock: true }
  )
  if (Array.isArray(data)) return data

  const pickList = (entry) => entry?.mflDataList ?? (Array.isArray(entry) ? entry : null)

  // 1) Tam eşleşme  2) backend tarzı tekil nesne  3) "default"  4) ilk uçuş
  let list =
    pickList(data[flightId]) ??
    pickList(data) ??
    pickList(data.default)

  if (!list) {
    const firstKey = Object.keys(data).find((k) => k !== '_comment' && k !== 'default')
    list = pickList(data[firstKey])
  }
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
