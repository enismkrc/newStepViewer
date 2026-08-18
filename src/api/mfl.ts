/**
 * MFL (Maintenance Fault Log) API.
 *
 * !!! GEÇİCİ: Backend `finNumber`'ı boş döndürdüğü için MFL verisi HER ZAMAN
 * mock'tan okunur. (forceMock=true)
 */

import { fetchJson } from './hms-client'
import { normalizeFin } from '@/three/partNaming'
import type { Fault, MflRecord, NormalizedMflRecord } from '@/types/api-types'

const MOCK_MFL_BY_FLIGHT = '/mock-api/mfl-by-flight.json'

type MflEntry = { mflDataList?: MflRecord[] } | MflRecord[]

type MflByFlightResponse = MflRecord[] | Record<string, MflEntry>

function pickList(entry: MflEntry | undefined): MflRecord[] | null {
  if (!entry) return null
  if (Array.isArray(entry)) return entry
  return entry.mflDataList ?? null
}

/**
 * Gerçek uçtan gelen `{ success, data: { mflDataList } }` zarfını, düz diziyi ve
 * `{ mflDataList }` biçimini tek bir MFL satır dizisine indirger.
 */
export function extractMflDataList(response: unknown): MflRecord[] {
  if (!response) return []
  if (Array.isArray(response)) return response as MflRecord[]
  const obj = response as { data?: MflEntry; mflDataList?: MflRecord[] }
  return pickList(obj.data) ?? obj.mflDataList ?? []
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

/** İlk dolu değeri döndürür; hiçbiri yoksa boş string. */
function firstText(...values: Array<string | number | null | undefined>): string {
  for (const v of values) {
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

/**
 * MFL satırlarını FIN numarasına göre gruplar. Aynı FIN'e ait tüm kayıtlar tek bir
 * fault altında toplanır; viewer bu FIN ile eşleşen parçayı highlight eder.
 */
export function mflListToFaults(mflList: MflRecord[]): Fault[] {
  if (!Array.isArray(mflList) || !mflList.length) return []
  const byFin = new Map<string, Fault>()
  mflList.forEach((row, index) => {
    const fin = String(row.finNumber ?? '').trim()
    const key = normalizeFin(fin)
    if (!key) return
    if (!byFin.has(key)) {
      byFin.set(key, {
        part: fin,
        type: row.severity ?? 'FAULT',
        fin,
        status: row.severity ?? 'FAULT',
        warningFaults: row.description ?? '',
        records: []
      })
    }
    byFin.get(key)!.records.push(normalizeMflRecord(row, index))
  })
  return Array.from(byFin.values())
}

export function normalizeMflRecord(row: MflRecord, index = 0): NormalizedMflRecord {
  const fin = String(row.finNumber ?? '').trim()
  const faultCode = firstText(row.faultCode)
  const mflMetaId = firstText(row.mflMetaId)
  return {
    id: firstText(mflMetaId, row.lruFieldsMflId) || `${fin}:${faultCode}:${index}`,
    fin,
    finKey: normalizeFin(fin),
    faultCode,
    severity: firstText(row.severity),
    category: firstText(row.category),
    description: firstText(row.description),
    location: firstText(row.location),
    absoluteTime: firstText(row.absoluteTime),
    relativeTime: firstText(row.relativeTime),
    ataChapterCode: firstText(row.ataChapterCode, row.ataChapterId),
    lruModelName: firstText(row.IruModelName, row.lruModelName),
    lruFieldName: firstText(row.IruFieldName, row.lruFieldName),
    flightNo: firstText(row.FlightNo, row.flightNo),
    missionType: firstText(row.missionType),
    aircraftName: firstText(row.aircraftName),
    fleetName: firstText(row.FleetName, row.fleetName),
    fleetBase: firstText(row.fleetBase),
    mflMetaId
  }
}

export function flattenMflForViewer(mflList: MflRecord[] | null | undefined): NormalizedMflRecord[] {
  return (mflList ?? []).map((row, index) => normalizeMflRecord(row, index))
}
