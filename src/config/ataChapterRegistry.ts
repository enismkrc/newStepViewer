/**
 * ATA CHAPTER / LRU MODEL ÇÖZÜMLEYİCİ
 *
 * Uçağın dış kabuğu tek bir GLB'dir (bkz. `modelRegistry.ts`). Ekipmanlar ise LRU başına
 * AYRI GLB dosyalarındadır ve gerçek tasarımdan export edildikleri için kendi konum
 * bilgilerini taşırlar; görüntüleyici hepsini kabukla aynı sahneye yükler, ek hizalama
 * yapılmaz.
 *
 * Dosya listesi ELLE TUTULMAZ: `npm run models:scan` public/ klasörünü tarayıp
 * `generatedLruModels.ts` dosyasını üretir (dev/build öncesi otomatik çalışır). Yeni bir
 * ekipman eklemek için dosyayı klasöre koymak yeterlidir.
 *
 * FIN -> ATA chapter ilişkisi FIN'in ilk iki hanesinden gelir: 2400MG001 -> chapter 24.
 */

import { getAircraftModelKey } from './modelRegistry'
import { LRU_MODELS, type LruModel } from './generatedLruModels'
import type { Aircraft } from '@/types/api-types'

export type { LruModel }

/** Panelde kod yerine okunur ad göstermek için standart ATA chapter adları. */
export const ATA_CHAPTER_LABELS: Record<string, string> = {
  '21': 'Air Conditioning',
  '22': 'Auto Flight',
  '23': 'Communications',
  '24': 'Electrical Power',
  '25': 'Equipment / Furnishings',
  '26': 'Fire Protection',
  '27': 'Flight Controls',
  '28': 'Fuel',
  '29': 'Hydraulic Power',
  '30': 'Ice & Rain Protection',
  '31': 'Indicating / Recording',
  '32': 'Landing Gear',
  '33': 'Lights',
  '34': 'Navigation',
  '35': 'Oxygen',
  '36': 'Pneumatic',
  '49': 'Auxiliary Power Unit',
  '51': 'Structures',
  '52': 'Doors',
  '53': 'Fuselage',
  '55': 'Stabilizers',
  '56': 'Windows',
  '57': 'Wings',
  '71': 'Power Plant',
  '72': 'Engine',
  '73': 'Engine Fuel & Control',
  '74': 'Ignition',
  '75': 'Air',
  '76': 'Engine Controls',
  '77': 'Engine Indicating',
  '79': 'Oil',
  '80': 'Starting',
  '94': 'Stores / Armament'
}

export function chapterLabel(code: string): string {
  return ATA_CHAPTER_LABELS[code] ?? `ATA ${code}`
}

/**
 * Bir uçak için geçerli LRU modelleri.
 *
 * `group` alanı dolu olan modeller yalnızca o uçak modeline aittir (dosyalar
 * `public/models/<uçakModeli>/...` altında toplanmışsa). `group` boş olanlar (dosyalar
 * doğrudan `public/` altında) her uçak için geçerli sayılır.
 */
export function resolveLruModels(aircraft: Aircraft | null): LruModel[] {
  if (!aircraft) return []
  const key = getAircraftModelKey(aircraft).toLowerCase()
  const scoped = LRU_MODELS.filter((m) => m.group && m.group.toLowerCase() === key)
  if (scoped.length) return scoped
  return LRU_MODELS.filter((m) => !m.group)
}

export interface AtaChapterGroup {
  code: string
  label: string
  models: LruModel[]
}

/** LRU modellerini panel için ATA chapter başlıkları altında gruplar. */
export function groupByChapter(models: LruModel[]): AtaChapterGroup[] {
  const byCode = new Map<string, LruModel[]>()
  for (const model of models) {
    if (!byCode.has(model.ataChapter)) byCode.set(model.ataChapter, [])
    byCode.get(model.ataChapter)!.push(model)
  }
  return Array.from(byCode.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, list]) => ({
      code,
      label: chapterLabel(code),
      models: list.slice().sort((a, b) => a.fin.localeCompare(b.fin))
    }))
}
