/**
 * MFL (Maintenance Fault Log) API.
 *
 * !!! GEÇİCİ: Backend `finNumber`'ı boş döndürdüğü için MFL verisi HER ZAMAN
 * mock'tan okunur. (forceMock=true)
 */

import { fetchJson } from './hms-client'
import { finKeyOf } from '@/three/partNaming'
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

export interface AtaChapterOption {
  /** İki haneli ATA chapter kodu (örn. "24"). */
  code: string
  /** `category` içindeki açıklama (örn. "Electrical Power System"). */
  label: string
}

/**
 * MFL `category` alanından ATA kodu ve açıklamasını ayırır.
 * Örnek: "24 Electrical Power System " → { code: "24", label: "Electrical Power System" }.
 * Eşleşmezse null (eski "ELECTRICAL" gibi düz metinler).
 */
export function parseAtaFromCategory(category: string | null | undefined): AtaChapterOption | null {
  const text = String(category ?? '').trim()
  if (!text) return null
  const match = text.match(/^(\d{2})\s+(.+)$/)
  if (!match) return null
  const code = match[1] ?? ''
  const label = (match[2] ?? '').trim()
  if (!code || !label) return null
  return { code, label }
}

/**
 * Bir MFL kaydının ATA chapter kodunu çözer. Sırayla:
 *
 *   1. `category` — "24 Electrical Power System " → "24" (backend'in gönderdiği asıl kaynak).
 *   2. Backend'in `ataChapter` alanı.
 *   3. `ataChapterCode` / `ataChapterId` içindeki ilk iki hane ("24-00-00" → "24").
 *   4. FIN numarasının ilk iki hanesi — "2400MG001" → "24".
 *   5. `faultCode`'un ilk iki hanesi — "32-021" → "32". Eski/adlandırılmamış kayıtlar için.
 */
export function resolveAtaChapter(row: MflRecord): string {
  const fromCategory = parseAtaFromCategory(row.category)
  if (fromCategory) return fromCategory.code
  const explicit = firstText(row.ataChapter).match(/(\d{2})/)
  if (explicit) return explicit[1] ?? ''
  const fromCode = firstText(row.ataChapterCode, row.ataChapterId).match(/(\d{2})/)
  if (fromCode) return fromCode[1] ?? ''
  const fromFin = String(row.finNumber ?? '').trim().match(/^(\d{2})/)
  if (fromFin) return fromFin[1] ?? ''
  const fromFault = String(row.faultCode ?? '').trim().match(/^(\d{2})/)
  return fromFault?.[1] ?? ''
}

/** `category` içindeki ATA açıklaması; yoksa boş string. */
export function resolveAtaLabel(row: MflRecord): string {
  return parseAtaFromCategory(row.category)?.label ?? ''
}

/**
 * Bir uçuşun MFL kayıtlarında görünen benzersiz ATA chapter'ları.
 * Etiket `category` açıklamasından gelir; aynı kod için ilk dolu etiket tutulur.
 */
export function uniqueAtaChapters(mflList: MflRecord[]): AtaChapterOption[] {
  const byCode = new Map<string, string>()
  for (const row of mflList) {
    const code = resolveAtaChapter(row)
    if (!code) continue
    const label = resolveAtaLabel(row)
    const existing = byCode.get(code)
    if (existing === undefined || (!existing && label)) byCode.set(code, label)
  }
  return Array.from(byCode.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, label]) => ({ code, label }))
}

/**
 * `?ata=24,27` veya `?ata=24&ata=27` query değerini iki haneli chapter kodlarına çevirir.
 * Rol bazlı görünümün demosu: seçilmemiş chapter'lar boş dizi olarak "hepsi" anlamına gelir.
 */
export function parseAtaChapterQuery(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  for (const part of parts) {
    for (const bit of String(part ?? '').split(',')) {
      const code = bit.trim()
      if (code && !out.includes(code)) out.push(code)
    }
  }
  return out
}

export function filterMflByAtaChapters(mflList: MflRecord[], codes: string[]): MflRecord[] {
  if (!codes.length) return mflList
  const allowed = new Set(codes)
  return mflList.filter((row) => allowed.has(resolveAtaChapter(row)))
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
    const key = finKeyOf(fin)
    if (!key) return
    if (!byFin.has(key)) {
      byFin.set(key, {
        part: fin,
        type: row.severity ?? 'FAULT',
        fin,
        status: row.severity ?? 'FAULT',
        warningFaults: row.description ?? '',
        ataChapter: resolveAtaChapter(row),
        ataChapterLabel: resolveAtaLabel(row),
        records: []
      })
    }
    const fault = byFin.get(key)!
    if (!fault.ataChapter) fault.ataChapter = resolveAtaChapter(row)
    if (!fault.ataChapterLabel) fault.ataChapterLabel = resolveAtaLabel(row)
    fault.records.push(normalizeMflRecord(row, index))
  })
  return Array.from(byFin.values())
}

export function normalizeMflRecord(row: MflRecord, index = 0): NormalizedMflRecord {
  const fin = String(row.finNumber ?? '').trim()
  const faultCode = firstText(row.faultCode)
  const mflMetaId = firstText(row.mflMetaId)
  const ataChapter = resolveAtaChapter(row)
  return {
    id: firstText(mflMetaId, row.lruFieldsMflId) || `${fin}:${faultCode}:${index}`,
    fin,
    finKey: finKeyOf(fin),
    faultCode,
    severity: firstText(row.severity),
    category: firstText(row.category),
    description: firstText(row.description),
    location: firstText(row.location),
    absoluteTime: firstText(row.absoluteTime),
    relativeTime: firstText(row.relativeTime),
    ataChapter,
    ataChapterCode: firstText(row.ataChapterCode, row.ataChapterId, ataChapter),
    ataChapterLabel: resolveAtaLabel(row),
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
