/**
 * EKİPMAN (LRU) MODEL TARAYICI
 *
 * `public/` altındaki ekipman modellerini bulup `src/config/generatedLruModels.ts`
 * dosyasını üretir. Tarayıcı bir klasörü kendi başına listeleyemediği için bu manifest
 * gerekir; `npm run dev` / `build` / `type-check` öncesi otomatik çalışır.
 *
 * İki paketleme biçimi desteklenir; ikisi de AYNI adlandırma kuralını kullanır:
 *
 *   1) LRU başına bir dosya          public/XXX2400MG001-missileRight.glb
 *   2) Chapter başına tek dosya      public/ATA-27.glb, içindeki node adları:
 *                                      _FLT2700CM001-ACTUATOR1
 *                                      _FLT2700CM002-ACTUATOR2
 *
 * Adlandırma kuralı (hem dosya hem node adı için):
 *
 *   XXX2400MG001-missileRight
 *   ^^^ tag (önemsiz)
 *      ^^^^^^^^^ FIN numarası  -> MFL kaydındaki finNumber ile eşleşir
 *      ^^ ATA chapter kodu
 *                ^^^^^^^^^^^^ ekranda gösterilecek ad
 *
 * Baştaki rakam olmayan karakterler atılır, ilk tireye kadarı FIN'dir, FIN'in ilk iki
 * hanesi ATA chapter'dır.
 *
 * Karar sırası: dosya adı FIN kalıbına uyuyorsa dosyanın TAMAMI o LRU'dur. Uymuyorsa
 * dosyanın içindeki node adlarına bakılır ve kalıba uyan her node bir LRU olur. İkisi de
 * tutmazsa dosya ekipman sayılmaz ve atlanır (dış kabuk `modelRegistry.ts` ile verilir).
 *
 * Alt klasörler: `public/models/<uçakModeli>/...` gibi bir düzen kurulursa klasör adı
 * `group` olarak kaydedilir ve o modeller yalnızca ilgili uçak modeliyle eşleşir. Dosyalar
 * doğrudan `public/` altındaysa `group` boştur ve tüm uçaklar için geçerli olur.
 */

import { readdir, writeFile, mkdir } from 'node:fs/promises'
import { join, relative, extname, basename, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readGltf, sceneNodeNames } from './lib/glb.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'public')
const OUT_FILE = join(ROOT, 'src', 'config', 'generatedLruModels.ts')
const MODEL_EXTENSIONS = new Set(['.glb', '.gltf'])
// Model olmayan içerik barındıran klasörler.
const SKIP_DIRS = new Set(['mock-api'])
const MIN_FIN_LENGTH = 4

async function collectFiles(dir) {
  const out = []
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...(await collectFiles(full)))
    } else if (MODEL_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
  return out
}

/** `missileRight` -> `Missile Right`, `ACTUATOR1` -> `Actuator 1`. */
function humanize(raw) {
  let s = String(raw).replace(/[_.]+/g, ' ').trim()
  if (!s) return ''
  // CAD adları genelde tümü büyük harf olur; okunur hale getirmek için küçültülür.
  if (!/[a-z]/.test(s)) s = s.toLowerCase()
  s = s
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Bir adı (dosya adı ya da node adı) FIN / ATA chapter / etiket olarak ayrıştırır.
 * Kalıba uymuyorsa null döner.
 */
export function parseLruName(raw) {
  // Baştaki tag'i (rakam olmayan karakterler) at.
  const afterTag = String(raw).replace(/^\D*/, '')
  if (!afterTag) return null

  const dashAt = afterTag.indexOf('-')
  const fin = (dashAt === -1 ? afterTag : afterTag.slice(0, dashAt)).trim()
  // İki hane chapter + gövde. Uzunluk alt sınırı, adında rakam geçen dosyaların
  // (örn. `ATA-27.glb` -> "27") yanlışlıkla FIN sanılmasını engeller.
  if (!/^\d{2}/.test(fin) || fin.length < MIN_FIN_LENGTH) return null

  const rest = dashAt === -1 ? '' : afterTag.slice(dashAt + 1)
  return {
    fin: fin.toUpperCase(),
    ataChapter: fin.slice(0, 2),
    label: humanize(rest) || fin.toUpperCase()
  }
}

function toUrl(relativePath) {
  return '/' + relativePath.split(sep).join('/')
}

/** İlk klasör adı gruptur; dosya doğrudan public/ altındaysa grup yoktur. */
function groupOf(relativePath) {
  const parts = relativePath.split(sep)
  if (parts.length < 2) return ''
  const [first] = parts
  return first === 'models' ? (parts.length > 2 ? parts[1] : '') : first
}

const files = await collectFiles(PUBLIC_DIR)
const models = []
const skipped = []

for (const file of files.sort()) {
  const rel = relative(PUBLIC_DIR, file)
  const url = toUrl(rel)
  const group = groupOf(rel)

  // 1) Dosya adı FIN kalıbına uyuyorsa dosyanın tamamı tek bir LRU'dur.
  const fromFileName = parseLruName(basename(file, extname(file)))
  if (fromFileName) {
    models.push({ ...fromFileName, group, url, node: '' })
    continue
  }

  // 2) Aksi halde dosya içindeki node adlarına bakılır.
  let nodeNames = []
  try {
    const { json } = await readGltf(file)
    nodeNames = sceneNodeNames(json)
  } catch (e) {
    console.warn(`[scan-models] Okunamadı, atlandı: ${rel} (${e.message})`)
    skipped.push(rel)
    continue
  }

  let found = 0
  for (const name of nodeNames) {
    const parsed = parseLruName(name)
    if (!parsed) continue
    models.push({ ...parsed, group, url, node: name })
    found += 1
  }
  if (!found) skipped.push(rel)
}

// Aynı FIN iki yerde görünürse ilkini korur, ikincisini uyarıyla atar.
const seen = new Map()
const unique = []
for (const model of models) {
  const key = `${model.group}|${model.fin}`
  if (seen.has(key)) {
    console.warn(`[scan-models] Yinelenen FIN atlandı: ${model.fin} @ ${model.url} (zaten ${seen.get(key)})`)
    continue
  }
  seen.set(key, model.url)
  unique.push(model)
}

unique.sort((a, b) => a.fin.localeCompare(b.fin))

const body = unique
  .map(
    (m) =>
      `  { fin: ${JSON.stringify(m.fin)}, ataChapter: ${JSON.stringify(m.ataChapter)}, ` +
      `label: ${JSON.stringify(m.label)}, group: ${JSON.stringify(m.group)}, ` +
      `url: ${JSON.stringify(m.url)}, node: ${JSON.stringify(m.node)} }`
  )
  .join(',\n')

const contents = `/**
 * OTOMATİK ÜRETİLDİ — ELLE DÜZENLEMEYİN.
 *
 * Kaynak: public/ altındaki *.glb / *.gltf dosyaları.
 * Yeniden üretmek için: npm run models:scan  (dev / build / type-check öncesi otomatik çalışır)
 */

export interface LruModel {
  /** FIN numarası; MFL kaydındaki finNumber ile eşleşir. */
  fin: string
  /** FIN'in ilk iki hanesi. */
  ataChapter: string
  /** Panelde gösterilecek ad. */
  label: string
  /** Uçak modeline göre kapsam (alt klasör adı). Boşsa tüm uçaklar için geçerli. */
  group: string
  /** public/ köküne göre servis edilen yol. */
  url: string
  /**
   * Bu LRU'yu içeren glTF node adı. Boşsa dosyanın tamamı bu LRU'dur; doluysa dosya
   * birden fazla LRU barındırır ve yalnızca bu node'un alt ağacı yüklenir.
   */
  node: string
}

export const LRU_MODELS: LruModel[] = [
${body}
]
`

await mkdir(dirname(OUT_FILE), { recursive: true })
await writeFile(OUT_FILE, contents, 'utf8')

console.log(`[scan-models] ${unique.length} ekipman modeli bulundu -> ${relative(ROOT, OUT_FILE)}`)
for (const m of unique) {
  console.log(`  ${m.fin}  ATA ${m.ataChapter}  ${m.label}  ${m.url}${m.node ? `  [${m.node}]` : ''}`)
}
if (skipped.length) {
  console.log(`[scan-models] Ekipman kalıbına uymayan ${skipped.length} dosya atlandı: ${skipped.join(', ')}`)
}
