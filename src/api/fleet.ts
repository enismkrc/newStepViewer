/**
 * Fleet & aircraft API.
 *
 * NOT: Backend `modelUrl` / `viewConfig` döndürmüyor. Bu alanlar `attachModel` ile
 * src/config/modelRegistry.ts üzerinden MANUEL ekleniyor.
 */

import { fetchJson } from './client'
import { attachModel } from '@/config/modelRegistry'
import type { Aircraft, Fleet, Page } from '@/types/api'

const MOCK_FLEETS = '/mock-api/fleets-page.json'
const MOCK_AIRCRAFT_BY_FLEET = '/mock-api/aircraft-by-fleet.json'

type FleetPageResponse = Page<Fleet> | { data?: Page<Fleet> | Fleet[] } | Fleet[]

type AircraftByFleetResponse =
  | Aircraft[]
  | Record<string, Aircraft[]>
  | { data?: Aircraft[] | Record<string, Aircraft[]> | Aircraft }

export async function findAllFleets({ page = 0, size = 20 } = {}): Promise<Page<Fleet>> {
  const raw = await fetchJson<FleetPageResponse>(
    MOCK_FLEETS,
    '/api/fleet/find-all',
    { query: { page: String(page), size: String(size) } }
  )
  return unwrapPage(raw)
}

function unwrapPage(raw: FleetPageResponse): Page<Fleet> {
  const page = 'data' in raw && raw.data !== undefined ? raw.data : raw
  if (Array.isArray(page)) return { content: page }
  return (page as Page<Fleet>) ?? { content: [] }
}

export async function getAllFleets(): Promise<Fleet[]> {
  const page = await findAllFleets({ page: 0, size: 200 })
  return page.content ?? []
}

export async function findAircraftByFleetId(fleetId: string): Promise<Aircraft[]> {
  if (!fleetId) return []
  const raw = await fetchJson<AircraftByFleetResponse>(
    MOCK_AIRCRAFT_BY_FLEET,
    `/api/aircraft/find-by-fleet-id/${encodeURIComponent(fleetId)}`
  )
  const data = 'data' in raw && raw.data !== undefined ? raw.data : raw
  const list = Array.isArray(data) ? data : (data as Record<string, Aircraft[]>)[fleetId] ?? []
  return list.map(attachModel)
}

export async function getAircraftById(aircraftId: string): Promise<Aircraft | null> {
  if (!aircraftId) return null
  const raw = await fetchJson<AircraftByFleetResponse>(
    MOCK_AIRCRAFT_BY_FLEET,
    `/api/aircraft/${encodeURIComponent(aircraftId)}`
  )
  const data = 'data' in raw && raw.data !== undefined ? raw.data : raw
  if (data && !Array.isArray(data) && 'id' in data && data.id === aircraftId) {
    return attachModel(data as Aircraft)
  }
  if (Array.isArray(data)) {
    const found = data.find((a) => a.id === aircraftId)
    return found ? attachModel(found) : null
  }
  for (const list of Object.values(data as Record<string, Aircraft[]>)) {
    if (!Array.isArray(list)) continue
    const found = list.find((a) => a.id === aircraftId)
    if (found) return attachModel(found)
  }
  return null
}
