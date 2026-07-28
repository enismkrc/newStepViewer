/**
 * LRU (Line Replaceable Unit) API.
 */

import { fetchJson } from './hms-client'
import type { LruRecord } from '@/types/api-types'

const MOCK_URL = '/mock-api/lru.json'

type LruResponse = LruRecord[] | Record<string, LruRecord[]>

export async function getLruByAircraftId(aircraftId: string): Promise<LruRecord[]> {
  if (!aircraftId) return []
  const data = await fetchJson<LruResponse>(MOCK_URL, `/api/aircraft/${encodeURIComponent(aircraftId)}/lru`)
  return Array.isArray(data) ? data : (data[aircraftId] ?? [])
}

export async function getLruByPart(aircraftId: string, partName: string): Promise<LruRecord | null> {
  const list = await getLruByAircraftId(aircraftId)
  return list.find((r) => r.part === partName) ?? null
}
