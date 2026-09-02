/**
 * Parça (glTF node) adı çözümlemesi.
 *
 * Model parçaları `_2430G-001_GENERATOR_R` kalıbıyla isimlendirilmiştir:
 *   baştaki `_` (ya da `_FLT` gibi) önek -> atılır
 *   ilk "_" öncesi  -> FIN numarası; kendi içinde tire barındırabilir (`2430G-001`)
 *   ilk "_" sonrası -> parçanın okunabilir adı (`MISSILE-RIGHT`, `GENERATOR_R`)
 *
 * MFL kayıtlarındaki `finNumber` alanı bu FIN ile eşleştirilerek parça highlight edilir.
 */

export interface ParsedPartName {
  /** Ham glTF node adı. */
  raw: string
  /** Gösterim için FIN (ör. "2430G-001"). Ad `FIN_AD` kalıbına uymuyorsa boş. */
  fin: string
  /** Eşleştirme anahtarı: büyük harf, yalnızca harf+rakam, `FLT` öneki atılmış. */
  finKey: string
  /** Kullanıcıya gösterilecek parça adı; daima büyük harf (ör. "GENERATOR R"). */
  label: string
  /** Ad gerçekten `FIN_AD` kalıbına uyuyor mu. */
  hasFin: boolean
}

/**
 * FIN değerlerini karşılaştırılabilir hale getirir: harf/rakam dışındaki her karakter
 * atılır, büyük harfe çevrilir ve `FLT` öneki kaldırılır. Böylece "_2430G-001",
 * "2430G-001" ve "2430G001" aynı anahtara indirgenir; FIN içindeki tire MFL'den
 * gelen değerde olsa da olmasa da eşleşme bozulmaz.
 */
export function normalizeFin(value: string | null | undefined): string {
  const cleaned = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.startsWith('FLT') ? cleaned.slice(3) : cleaned
}

/**
 * Parça adını gösterim biçimine çevirir: ayraçlar (`-`, `_`, `.`) boşluk olur ve ad
 * tümüyle BÜYÜK HARF yazılır ("GENERATOR_R" -> "GENERATOR R", "ACTUATOR-1" ->
 * "ACTUATOR 1"). Ekipman listesindeki adlarla aynı biçimi verir.
 */
export function partLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
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
 * Adı FIN ve okunabilir ad olarak ikiye ayırır. Ayraç, baştaki `_` öneki atıldıktan
 * sonraki İLK alt çizgidir: FIN kendi içinde tire ("2430G-001"), ad ise alt çizgi
 * ("GENERATOR_R") barındırabildiği için bölme noktası başka bir yer olamaz.
 */
function splitName(value: string): [string, string] | null {
  const body = value.replace(/^[_\s]+/, '')
  const at = body.indexOf('_')
  if (at <= 0) return null
  const fin = body.slice(0, at).trim()
  const label = body.slice(at + 1).trim()
  if (!fin || !label) return null
  return [fin, label]
}

/** Bir metnin FIN kodu olma ihtimali: boşluk içermez ve en az bir rakam taşır. */
function looksLikeFin(value: string): boolean {
  return !!value && !/\s/.test(value) && /\d/.test(value)
}

/**
 * Herhangi bir değerden eşleştirme anahtarını üretir; girdi ister ham FIN
 * ("2430G-001", "_2430G-001") ister tam node adı ("_2430G-001_GENERATOR_R")
 * olsun aynı anahtarı döndürür.
 *
 * DİKKAT: `normalizeFin` bunu yapmaz — tam node adına uygulanırsa FIN ile parça adını
 * birleştirip ("2430G001GENERATORR") yanlış anahtar üretir. Eşleştirmede daima bu
 * fonksiyon kullanılmalıdır.
 */
export function finKeyOf(value: string | null | undefined): string {
  return parsePartName(value).finKey
}

export function parsePartName(raw: string | null | undefined): ParsedPartName {
  const value = String(raw ?? '').trim()
  const parts = splitName(value)
  const head = parts ? parts[0].trim() : ''
  const tail = parts ? parts[1].trim() : ''

  if (!parts || !tail || !looksLikeFin(head)) {
    return { raw: value, fin: '', finKey: normalizeFin(value), label: partLabel(value), hasFin: false }
  }
  return { raw: value, fin: displayFin(head), finKey: normalizeFin(head), label: partLabel(tail), hasFin: true }
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
