import * as THREE from 'three'

/**
 * Varsayılan model yönü ve ilk kamera açısı.
 * İlk yükleme, Reset view ve uçak değişiminde kullanılır.
 *
 * cameraOffset → ViewCube TOP + LEFT + BACK köşe görünümü (sol-üst-arka izometrik).
 * modelRotation.y → üstten bakınca burun yukarı; front/back etiketleri viewportGizmoConfig'te.
 */
export const DEFAULT_VIEW = {
  modelRotation: {
    x: 0,
    y: Math.PI,
    z: 0
  },
  /** Model-local offset; modelGroup quaternion ile world'e çevrilir. */
  cameraOffset: {
    x: 0.85,
    y: 0.65,
    z: -0.85
  },
  zoom: {
    fullModel: 0.5,
    part: 1.2,
    assembly: 1.5
  }
}

const _cameraOffsetVec = new THREE.Vector3()

export function applyDefaultModelOrientation(group) {
  if (!group) return
  const r = DEFAULT_VIEW.modelRotation
  group.rotation.set(r.x, r.y, r.z)
}

/**
 * Fit camera to a bounding box using DEFAULT_VIEW offset (same angle as initial load).
 */
export function frameCameraOnBox(camera, controls, bbox, distanceMultiplier, modelGroup = null) {
  if (!camera || !controls || !bbox) return

  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bbox.getCenter(center)
  bbox.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2))
  distance *= camera.aspect > 1 ? camera.aspect : 1
  distance *= distanceMultiplier

  const off = DEFAULT_VIEW.cameraOffset
  _cameraOffsetVec.set(off.x, off.y, off.z)
  if (modelGroup) _cameraOffsetVec.applyQuaternion(modelGroup.quaternion)

  camera.position.copy(center).addScaledVector(_cameraOffsetVec, distance)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}
