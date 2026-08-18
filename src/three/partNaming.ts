/**
 * Parça (glTF node) adı çözümlemesi.
 *
 * Model parçaları `_FLT2420MG002 - INVERTER, L` kalıbıyla isimlendirilmiştir:
 *   "-" öncesi  -> FIN numarası (opsiyonel `_FLT` öneki ile)
 *   "-" sonrası -> parçanın okunabilir adı
 *
 * MFL kayıtlarındaki `finNumber` alanı bu FIN ile eşleştirilerek parça highlight edilir.
 */

export interface ParsedPartName {
  /** Ham glTF node adı. */
  raw: string
  /** Gösterim için FIN (ör. "2420MG002"). Ad `FIN - AD` kalıbına uymuyorsa boş. */
  fin: string
  /** Eşleştirme anahtarı: büyük harf, yalnızca harf+rakam, `FLT` öneki atılmış. */
  finKey: string
  /** Kullanıcıya gösterilecek parça adı (ör. "INVERTER, L"). */
  label: string
  /** Ad gerçekten `FIN - AD` kalıbına uyuyor mu. */
  hasFin: boolean
}

/**
 * FIN değerlerini karşılaştırılabilir hale getirir: harf/rakam dışındaki her karakter
 * atılır, büyük harfe çevrilir ve `FLT` öneki kaldırılır. Böylece "_FLT2420MG002",
 * "FLT-2420MG002" ve "2420MG002" aynı anahtara indirgenir.
 */
export function normalizeFin(value: string | null | undefined): string {
  const cleaned = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.startsWith('FLT') ? cleaned.slice(3) : cleaned
}

/** Gösterim FIN'i: baştaki `_` ve `FLT` öneki atılır, geri kalanı olduğu gibi korunur. */
export function displayFin(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/^[_\s]+/, '')
    .replace(/^FLT[-_ ]?/i, '')
    .trim()
}

/**
 * Adı FIN ve okunabilir ad olarak ikiye ayırır. Önce boşluklu ayraç (" - ") denenir;
 * böylece FIN'in kendi içinde tire barındırdığı ("FLT-2420MG002 - INVERTER") adlar da
 * doğru bölünür.
 */
function splitName(value: string): [string, string] | null {
  const spaced = value.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (spaced) return [spaced[1]!, spaced[2]!]
  const tight = value.match(/^([^-–—]+)[-–—](.+)$/)
  if (tight) return [tight[1]!, tight[2]!]
  return null
}

/** Bir metnin FIN kodu olma ihtimali: boşluk içermez ve en az bir rakam taşır. */
function looksLikeFin(value: string): boolean {
  return !!value && !/\s/.test(value) && /\d/.test(value)
}

export function parsePartName(raw: string | null | undefined): ParsedPartName {
  const value = String(raw ?? '').trim()
  const parts = splitName(value)
  const head = parts ? parts[0].trim() : ''
  const tail = parts ? parts[1].trim() : ''

  if (!parts || !tail || !looksLikeFin(head)) {
    return { raw: value, fin: '', finKey: normalizeFin(value), label: value, hasFin: false }
  }
  return { raw: value, fin: displayFin(head), finKey: normalizeFin(head), label: tail, hasFin: true }
}

/**
 * MFL `finNumber` gibi tek parçalı bir değeri çözümler (ad bilgisi taşımaz).
 * Model tarafında karşılığı bulunamayan faultlar için gösterimde kullanılır.
 */
export function parseFinValue(raw: string | null | undefined): ParsedPartName {
  const value = String(raw ?? '').trim()
  if (!looksLikeFin(value)) {
    return { raw: value, fin: '', finKey: normalizeFin(value), label: value, hasFin: false }
  }
  return { raw: value, fin: displayFin(value), finKey: normalizeFin(value), label: '', hasFin: true }
}
