/**
 * GLB / glTF okuma yardımcıları. `scan-models.mjs` ve `inspect-glb.mjs` tarafından
 * paylaşılır.
 */

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

/** Bir .glb veya .gltf dosyasının glTF JSON'unu (ve varsa binary chunk'ını) döner. */
export async function readGltf(path) {
  const buf = await readFile(path)

  if (extname(path).toLowerCase() === '.gltf') {
    return { json: JSON.parse(buf.toString('utf8')), bin: null }
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error(`${path}: geçerli bir GLB değil`)

  let offset = 12
  let json = null
  let bin = null
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (type === CHUNK_JSON) json = JSON.parse(buf.subarray(start, start + length).toString('utf8'))
    if (type === CHUNK_BIN) bin = buf.subarray(start, start + length)
    offset = start + length + ((4 - (length % 4)) % 4)
  }
  if (!json) throw new Error(`${path}: JSON chunk bulunamadı`)
  return { json, bin }
}

/** Sahnedeki tüm node adları, ağaç sırasıyla. */
export function sceneNodeNames(json) {
  const nodes = json.nodes ?? []
  const scene = json.scenes?.[json.scene ?? 0]
  const names = []
  const seen = new Set()

  const walk = (index) => {
    if (seen.has(index)) return
    seen.add(index)
    const node = nodes[index]
    if (!node) return
    if (node.name) names.push(String(node.name))
    for (const child of node.children ?? []) walk(child)
  }

  for (const root of scene?.nodes ?? []) walk(root)
  return names
}
