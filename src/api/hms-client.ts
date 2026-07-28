/**
 * Mock ↔ gerçek backend geçişini yöneten ince sarmalayıcı.
 *
 * Gerçek istekler `@/api/http` üzerindeki ORTAK istemciden geçer; token/header
 * yönetimi bu yüzden burada yapılmaz.
 *
 *   VITE_USE_MOCK_API=true            -> public/mock-api/*.json dosyalarını kullanır
 *   VITE_USE_MOCK_API=false           -> gerçek backend'e gider
 *   VITE_API_BASE_URL=https://...     -> gerçek backend kök adresi
 *
 * BASE_URL boşsa otomatik olarak mock moda düşer (geliştirme kolaylığı).
 */

import { BASE_URL, http } from './http'
import type { FetchJsonOptions } from '@/types/api-types'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !BASE_URL

const MOCK_LATENCY_MS = 400
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Mock statik dosyadan veya ortak istemci üzerinden JSON getirir.
 * forceMock=true: global ayar gerçek backend olsa bile bu istek HER ZAMAN mock'tan okur.
 */
export async function fetchJson<T = unknown>(
  mockPath: string,
  apiPath: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const { query, forceMock = false } = options
  if (USE_MOCK || forceMock) return await fetchMockJson<T>(mockPath)
  const res = await http.get<T>(apiPath, { params: query })
  return res.data
}

/** Mock dosyaları statiktir: ortak istemcinin baseURL/header'ları uygulanmamalı. */
async function fetchMockJson<T>(mockPath: string): Promise<T> {
  // Vite `base` ayarı (alt yolda yayın) altında public/ dosyaları da o yola taşınır.
  const url = `${import.meta.env.BASE_URL}${mockPath.replace(/^\//, '')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mock API error: ${res.status} ${url}`)
  const data = (await res.json()) as T
  await delay(MOCK_LATENCY_MS)
  return data
}
