/**
 * MFL (Maintenance Fault Log) API.
 *
 * !!! GEÇİCİ: Backend `finNumber`'ı boş döndürdüğü için MFL verisi HER ZAMAN
 * mock'tan okunur. (forceMock=true)
 */

import { fetchJson } from './client'
import type { Fault, MflRecord, NormalizedMflRecord } from '@/types/api'

const MOCK_MFL_BY_FLIGHT = '/mock-api/mfl-by-flight.json'

type MflEntry = { mflDataList?: MflRecord[] } | MflRecord[]

type MflByFlightResponse = MflRecord[] | Record<string, MflEntry>

function pickList(entry: MflEntry | undefined): MflRecord[] | null {
  if (!entry) return null
  if (Array.isArray(entry)) return entry
  return entry.mflDataList ?? null
}

export async function getFilteredMflData(flightId: string): Promise<MflRecord[]> {
  if (!flightId) return []
  const data = await fetchJson<MflByFlightResponse>(
    MOCK_MFL_BY_FLIGHT,
    `/api/mfl/get-filtered-mfl-data/${encodeURIComponent(flightId)}`,
    { forceMock: true }
  )
  if (Array.isArray(data)) return data

  const map = data as Record<string, MflEntry>
  let list =
    pickList(map[flightId]) ??
    pickList(data as MflEntry) ??
    pickList(map.default)

  if (!list) {
    const firstKey = Object.keys(map).find((k) => k !== '_comment' && k !== 'default')
    list = firstKey ? pickList(map[firstKey]) : null
  }
  return list ?? []
}

export function mflListToFaults(mflList: MflRecord[]): Fault[] {
  if (!Array.isArray(mflList) || !mflList.length) return []
  const byPart = new Map<string, Fault>()
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
    byPart.get(part)!.records.push(normalizeMflRecord(row))
  }
  return Array.from(byPart.values())
}

export function normalizeMflRecord(row: MflRecord): NormalizedMflRecord {
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

export function flattenMflForViewer(mflList: MflRecord[] | null | undefined): NormalizedMflRecord[] {
  return (mflList ?? []).map(normalizeMflRecord)
}
