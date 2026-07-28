/**
 * Ortak HTTP istemcisine tek bağlantı noktası.
 *
 * Ana projeye entegrasyonda SADECE bu dosya değiştirilir; ana projedeki ortak
 * istemci yeniden dışa verilir ve başka hiçbir dosyaya dokunmak gerekmez:
 *
 *   export { default as http } from '@/api/client'
 *   export const BASE_URL = ''
 *
 * Authorization / token, base URL ve hata yönetimi ortak istemcinin işidir;
 * bu modül veya `hms-client.ts` bunlara müdahale etmez.
 */

import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const http = axios.create({ baseURL: BASE_URL })
