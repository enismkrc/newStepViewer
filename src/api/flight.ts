/**
 * Flight API.
 */

import { fetchJson } from './client'
import type { Flight } from '@/types/api'

const MOCK_FLIGHTS = '/mock-api/flights-by-aircraft.json'

type FlightsResponse = Flight[] | Record<string, Flight[]> | { data?: Flight[] | Record<string, Flight[]> }

export async function findFlightsByAircraftId(aircraftId: string): Promise<Flight[]> {
  if (!aircraftId) return []
  const raw = await fetchJson<FlightsResponse>(
    MOCK_FLIGHTS,
    `/api/flight/find-by-aircraft-id/${encodeURIComponent(aircraftId)}`
  )
  const data = 'data' in raw && raw.data !== undefined ? raw.data : raw
  if (Array.isArray(data)) return data
  return (data as Record<string, Flight[]>)[aircraftId] ?? []
}
