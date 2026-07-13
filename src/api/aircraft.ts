/**
 * Aircraft API service layer (legacy flat list endpoint).
 */

import { fetchJson } from './client'
import type { Aircraft } from '@/types/api'

const MOCK_URL = '/mock-api/aircraft.json'

export async function getAircraftList(): Promise<Aircraft[]> {
  return await fetchJson<Aircraft[]>(MOCK_URL, '/api/aircraft')
}

export async function getAircraftById(id: string): Promise<Aircraft | null> {
  if (!id) return null
  const data = await fetchJson<Aircraft[] | Aircraft>(MOCK_URL, `/api/aircraft/${encodeURIComponent(id)}`)
  if (Array.isArray(data)) return data.find((ac) => ac.id === id) ?? null
  return data?.id === id ? data : null
}
