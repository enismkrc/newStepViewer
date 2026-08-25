/**
 * GLB inceleme yardımcısı — node adlarını ve dünya koordinatlarındaki sınır kutusunu döker.
 *
 * Çok modelli görüntülemede tüm dosyaların AYNI orijine göre export edilmiş olması şart.
 * Bu script onu doğrulamak için kullanılır: ekipman dosyalarının sınır kutuları dış
 * kabuğun kutusunun içinde kalmalı.
 *
 *   npm run models:inspect -- public/aircraft-oml.glb public/ATA-27.glb
 */

import { basename } from 'node:path'
import { readGltf } from './lib/glb.mjs'

/** 4x4 matris çarpımı (glTF column-major). */
function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = sum
    }
  }
  return out
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix)) return node.matrix.slice()
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz
  const xx = qx * x2, xy = qx * y2, xz = qx * z2
  const yy = qy * y2, yz = qy * z2, zz = qz * z2
  const wx = qw * x2, wy = qw * y2, wz = qw * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1
  ]
}

function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ]
}

function inspect(json) {
  const nodes = json.nodes ?? []
  const meshes = json.meshes ?? []
  const accessors = json.accessors ?? []
  const scene = json.scenes?.[json.scene ?? 0]
  const names = []
  const world = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }

  const walk = (index, parentMatrix, depth) => {
    const node = nodes[index]
    if (!node) return
    const m = multiply(parentMatrix, nodeMatrix(node))
    if (node.name) names.push({ name: String(node.name), depth })
    if (node.mesh !== undefined) {
      for (const prim of meshes[node.mesh]?.primitives ?? []) {
        const acc = accessors[prim.attributes?.POSITION]
        if (!acc?.min || !acc?.max) continue
        // Yerel AABB'nin 8 köşesini dünyaya taşı (dönme varsa doğru sonuç için).
        for (let i = 0; i < 8; i++) {
          const corner = [
            i & 1 ? acc.max[0] : acc.min[0],
            i & 2 ? acc.max[1] : acc.min[1],
            i & 4 ? acc.max[2] : acc.min[2]
          ]
          const p = transformPoint(m, corner)
          for (let a = 0; a < 3; a++) {
            world.min[a] = Math.min(world.min[a], p[a])
            world.max[a] = Math.max(world.max[a], p[a])
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child, m, depth + 1)
  }

  for (const root of scene?.nodes ?? []) walk(root, identity(), 0)
  return { names, world, nodeCount: nodes.length, meshCount: meshes.length }
}

const fmt = (v) => v.map((n) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a')).join(', ')

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('Kullanım: npm run models:inspect -- <dosya.glb> [dosya2.glb ...]')
  process.exit(1)
}

for (const path of paths) {
  const { json } = await readGltf(path)
  const { names, world, nodeCount, meshCount } = inspect(json)
  const size = world.max.map((v, i) => v - world.min[i])
  console.log(`\n=== ${basename(path)} ===`)
  console.log(`generator : ${json.asset?.generator ?? '-'}`)
  console.log(`nodes/meshes: ${nodeCount} / ${meshCount}`)
  console.log(`world min : ${fmt(world.min)}`)
  console.log(`world max : ${fmt(world.max)}`)
  console.log(`world size: ${fmt(size)}`)
  console.log('node names (ilk 40):')
  for (const n of names.slice(0, 40)) console.log(`  ${'  '.repeat(n.depth)}- ${n.name}`)
  if (names.length > 40) console.log(`  ... (+${names.length - 40})`)
}
