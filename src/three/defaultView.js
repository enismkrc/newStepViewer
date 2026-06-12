import * as THREE from 'three'

/**
 * Generic defaults — glTF Y-up, no model rotation, standard isometric camera.
 * Per-aircraft overrides: mock API `viewConfig` (see aircraft.json).
 */
export const DEFAULT_VIEW = {
  modelRotation: { x: 0, y: 0, z: 0 },
  cameraOffset: { x: 0.85, y: 0.65, z: 0.85 },
  zoom: { fullModel: 0.5, part: 1.2, assembly: 1.5 },
  /** true when model nose points -Z (ViewCube FRONT/BACK labels swap). */
  swapFrontBack: false
}

export function mergeViewConfig(override) {
  if (!override || typeof override !== 'object') {
    return {
      modelRotation: { ...DEFAULT_VIEW.modelRotation },
      cameraOffset: { ...DEFAULT_VIEW.cameraOffset },
      zoom: { ...DEFAULT_VIEW.zoom },
      swapFrontBack: DEFAULT_VIEW.swapFrontBack
    }
  }
  return {
    modelRotation: { ...DEFAULT_VIEW.modelRotation, ...override.modelRotation },
    cameraOffset: { ...DEFAULT_VIEW.cameraOffset, ...override.cameraOffset },
    zoom: { ...DEFAULT_VIEW.zoom, ...override.zoom },
    swapFrontBack: override.swapFrontBack ?? DEFAULT_VIEW.swapFrontBack
  }
}

const _cameraOffsetVec = new THREE.Vector3()

export function applyModelOrientation(group, viewConfig = DEFAULT_VIEW) {
  if (!group) return
  const r = viewConfig.modelRotation
  group.rotation.set(r.x ?? 0, r.y ?? 0, r.z ?? 0)
}

export function frameCameraOnBox(camera, controls, bbox, distanceMultiplier, modelGroup, viewConfig = DEFAULT_VIEW) {
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

  const off = viewConfig.cameraOffset
  _cameraOffsetVec.set(off.x, off.y, off.z)
  if (modelGroup) _cameraOffsetVec.applyQuaternion(modelGroup.quaternion)

  camera.position.copy(center).addScaledVector(_cameraOffsetVec, distance)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}
