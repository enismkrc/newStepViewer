/**
 * Tüm backend / mock isteklerinin geçtiği ORTAK HTTP istemcisi.
 *
 * Mock ↔ gerçek backend geçişi tamamen ortam değişkenleriyle (.env) yapılır:
 *   VITE_USE_MOCK_API=true            -> public/mock-api/*.json dosyalarını kullanır
 *   VITE_USE_MOCK_API=false           -> gerçek backend'e gider
 *   VITE_API_BASE_URL=https://...     -> gerçek backend kök adresi
 *
 * BASE_URL boşsa otomatik olarak mock moda düşer (geliştirme kolaylığı).
 */

import type { FetchJsonOptions } from '@/types/api'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !BASE_URL

export const MOCK_LATENCY_MS = 400
export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * İsteklere eklenecek ekstra header'lar (örn. Authorization).
 * Gerçek backend'e token/oturum eklemek gerekirse `setAuthToken(...)` çağırın
 * veya `setHeaders({ ... })` ile özel header'lar tanımlayın.
 */
let _defaultHeaders: Record<string, string> = {}

export function setHeaders(headers: Record<string, string> = {}) {
  _defaultHeaders = { ..._defaultHeaders, ...headers }
}

export function setAuthToken(token: string | null | undefined) {
  if (token) _defaultHeaders.Authorization = `Bearer ${token}`
  else delete _defaultHeaders.Authorization
}

/**
 * Mock statik dosyadan veya gerçek API yolundan JSON getirir.
 * forceMock=true: global ayar gerçek backend olsa bile bu istek HER ZAMAN mock'tan okur.
 */
export async function fetchJson<T = unknown>(
  mockPath: string,
  apiPath: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const { query, forceMock = false } = options
  const useMock = USE_MOCK || forceMock
  let url = useMock ? mockPath : `${BASE_URL}${apiPath}`
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString()
    url += `${url.includes('?') ? '&' : '?'}${qs}`
  }
  const init = useMock ? undefined : { headers: { ..._defaultHeaders } }
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`)
  const data = (await res.json()) as T
  if (useMock) await delay(MOCK_LATENCY_MS)
  return data
}
