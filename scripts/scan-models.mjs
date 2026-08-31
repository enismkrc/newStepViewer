/**
 * EKİPMAN (LRU) MODEL TARAYICI
 *
 * `public/` altındaki ekipman modellerini bulup `src/config/generatedLruModels.ts`
 * dosyasını üretir. Tarayıcı bir klasörü kendi başına listeleyemediği için bu manifest
 * gerekir; `npm run dev` / `build` / `type-check` öncesi otomatik çalışır.
 *
 * Önerilen düzen — chapter klasörleri (onlarca GLB'yi yönetmek için):
 *
 *   public/models/OML/aircraft-oml.glb   <- dış kabuk (ekipman sayılmaz)
 *   public/models/OML/ATA-24/
 *     XXX2400MG001-missileRight.glb      <- LRU başına bir dosya
 *   public/models/OML/ATA-27/
 *     ATA-27.glb                         <- chapter assembly; LRU'lar node adından
 *
 * Yeni bir uçak: public/models/<uçakModeli>/ altında aynı düzen.
 * Klasör adı (`ATA-24`, `ATA_24`, `24`) chapter kovasıdır, uçak adı değildir.
 *
 * İki paketleme biçimi aynı klasörde bir arada olabilir; adlandırma kuralı aynıdır.
 *
 *   XXX2400MG001-missileRight
 *   ^^^ tag (önemsiz)
 *      ^^^^^^^^^ FIN numarası  -> MFL kaydındaki finNumber ile eşleşir
 *      ^^ ATA chapter kodu
 *                ^^^^^^^^^^^^ ekranda gösterilecek ad
 *
 * Karar sırası: dosya adı FIN kalıbına uyuyorsa dosyanın TAMAMI o LRU'dur. Uymuyorsa
 * dosyanın içindeki node adlarına bakılır. İkisi de tutmazsa dosya ekipman sayılmaz.
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
/** `ATA-24`, `ATA_24`, `ata24`, `24` — chapter kovası; uçak kapsamı (`group`) değildir. */
const ATA_FOLDER_RE = /^(?:ata[-_]?)?(\d{2})$/i

function ataChapterFromFolderName(name) {
  const m = String(name).trim().match(ATA_FOLDER_RE)
  return m?.[1] ?? ''
}

function pathFolders(relativePath) {
  const parts = relativePath.split(sep).filter(Boolean)
  parts.pop()
  return parts
}

/**
 * Uçak kapsamı. `models/` bir isim alanıdır, `ATA-24` bir chapter kovasıdır; ikisi de
 * group olmaz. Kalan ilk klasör uçak modelidir (`public/models/OML/ATA-24/x.glb` -> OML).
 */
function groupOf(relativePath) {
  let skipModels = true
  for (const part of pathFolders(relativePath)) {
    if (skipModels && part.toLowerCase() === 'models') {
      skipModels = false
      continue
    }
    skipModels = false
    if (ataChapterFromFolderName(part)) continue
    return part
  }
  return ''
}

function chapterFolderOf(relativePath) {
  const folders = pathFolders(relativePath)
  for (let i = folders.length - 1; i >= 0; i--) {
    const code = ataChapterFromFolderName(folders[i])
    if (code) return code
  }
  return ''
}

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

const files = await collectFiles(PUBLIC_DIR)
const models = []
const skipped = []

for (const file of files.sort()) {
  const rel = relative(PUBLIC_DIR, file)
  const url = toUrl(rel)
  const group = groupOf(rel)
  const folderChapter = chapterFolderOf(rel)

  const applyFolderChapter = (parsed) => {
    if (folderChapter && parsed.ataChapter !== folderChapter) {
      console.warn(
        `[scan-models] FIN ATA ${parsed.ataChapter} klasör ATA ${folderChapter} ile uyuşmuyor: ${rel} (${parsed.fin})`
      )
    }
    return parsed
  }

  // 1) Dosya adı FIN kalıbına uyuyorsa dosyanın tamamı tek bir LRU'dur.
  const fromFileName = parseLruName(basename(file, extname(file)))
  if (fromFileName) {
    models.push({ ...applyFolderChapter(fromFileName), group, url, node: '' })
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
    models.push({ ...applyFolderChapter(parsed), group, url, node: name })
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
  /** Uçak modeline göre kapsam (public/models/OML/...). Boşsa tüm uçaklar için geçerli. ATA-24 klasörü group değildir. */
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
