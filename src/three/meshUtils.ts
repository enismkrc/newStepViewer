/**
 * Three.js `traverse()` callback'lerinde tip daraltma yardımcıları.
 *
 * `Object3D` üzerinde `isMesh` / `material` alanları tanımlı olmadığı için, sahneyi
 * gezerken mesh'leri ayıklamak ve materyallerine güvenle erişmek için bu yardımcılar
 * kullanılır.
 */
import * as THREE from 'three'

/** Kaynakları serbest bırakılırken geometri/materyal taşıyabilen her Object3D. */
export type DisposableObject = THREE.Object3D & {
  geometry?: THREE.BufferGeometry
  material?: THREE.Material | THREE.Material[]
}

export function isMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return (obj as THREE.Mesh).isMesh === true
}

/** Mesh'in tek (dizi olmayan) MeshStandardMaterial'ı; değilse null. */
export function standardMaterialOf(mesh: THREE.Mesh): THREE.MeshStandardMaterial | null {
  const mat = mesh.material
  if (!mat || Array.isArray(mat)) return null
  return (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial
    ? (mat as THREE.MeshStandardMaterial)
    : null
}

export function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined) {
  if (!material) return
  if (Array.isArray(material)) material.forEach((m) => m.dispose())
  else material.dispose()
}

/** `wireframe` temel `Material` üzerinde değil, alt sınıflarda tanımlıdır. */
type WireframeMaterial = THREE.Material & { wireframe?: boolean }

export function setMaterialWireframe(
  material: THREE.Material | THREE.Material[] | undefined,
  enabled: boolean
) {
  if (!material) return
  const list = (Array.isArray(material) ? material : [material]) as WireframeMaterial[]
  for (const m of list) m.wireframe = enabled
}
