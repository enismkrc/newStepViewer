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

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true' || !BASE_URL

export const MOCK_LATENCY_MS = 400
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * İsteklere eklenecek ekstra header'lar (örn. Authorization).
 * Gerçek backend'e token/oturum eklemek gerekirse `setAuthToken(...)` çağırın
 * veya `setHeaders({ ... })` ile özel header'lar tanımlayın.
 *
 * Örnek (ana uygulamanın giriş akışından sonra):
 *   import { setAuthToken } from '@/api/client'
 *   setAuthToken(localStorage.getItem('accessToken'))
 */
let _defaultHeaders = {}

export function setHeaders(headers = {}) {
  _defaultHeaders = { ..._defaultHeaders, ...headers }
}

export function setAuthToken(token) {
  if (token) _defaultHeaders.Authorization = `Bearer ${token}`
  else delete _defaultHeaders.Authorization
}

/**
 * Mock statik dosyadan veya gerçek API yolundan JSON getirir.
 * @param {string} mockPath  örn. '/mock-api/lru.json'
 * @param {string} apiPath   örn. '/api/aircraft/aircraft-1/lru'
 * @param {{ query?: Record<string, string>, forceMock?: boolean }} [options]
 *   forceMock=true: global ayar gerçek backend olsa bile bu istek HER ZAMAN mock'tan okur.
 *   (Örn. MFL verisi backend'de hazır olmadığı için mock'tan besleniyor.)
 */
export async function fetchJson(mockPath, apiPath, options = {}) {
  const { query, forceMock = false } = options
  const useMock = USE_MOCK || forceMock
  let url = useMock ? mockPath : `${BASE_URL}${apiPath}`
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString()
    url += `${url.includes('?') ? '&' : '?'}${qs}`
  }
  // Mock dosyaları statik olduğu için header göndermeye gerek yok.
  const init = useMock ? undefined : { headers: { ..._defaultHeaders } }
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`)
  const data = await res.json()
  if (useMock) await delay(MOCK_LATENCY_MS)
  return data
}
