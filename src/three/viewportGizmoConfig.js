/** Shared ViewCube settings (HMS + GLB preview). */
const FACE_STYLE = {
  color: '#e8edf4',
  opacity: 1,
  labelColor: '#1e293b',
  border: { size: 1.5, color: '#64748b' },
  hover: {
    color: '#bfdbfe',
    labelColor: '#1e3a8a',
    border: { size: 1.5, color: '#2563eb' }
  }
}

export const VIEWPORT_GIZMO_OPTIONS = {
  type: 'cube',
  placement: 'top-right',
  size: 132,
  offset: { top: 10, right: 10 },
  background: { enabled: false },
  font: { family: 'Segoe UI, system-ui, sans-serif', weight: 700 },
  corners: {
    enabled: true,
    color: '#475569',
    opacity: 1,
    scale: 0.26,
    hover: {
      color: '#2563eb',
      opacity: 1,
      scale: 0.3
    }
  },
  edges: {
    enabled: true,
    color: '#334155',
    opacity: 0.85,
    scale: 1,
    hover: {
      color: '#2563eb',
      opacity: 1
    }
  },
  top: { ...FACE_STYLE, label: 'TOP' },
  // Model burun yönü -Z olduğu için +Z ekseni kuyruk, -Z ekseni burun tarafı.
  front: { ...FACE_STYLE, label: 'BACK' },
  back: { ...FACE_STYLE, label: 'FRONT' },
  right: { ...FACE_STYLE, label: 'RIGHT' },
  left: { ...FACE_STYLE, label: 'LEFT' },
  bottom: { ...FACE_STYLE, label: 'BOTTOM' },
}

export const VIEWPORT_GIZMO_CLASS = 'view-cube-widget'

/** Mouse küp üzerinde değilken opaklık (0–1). WebGL viewport ile çizildiği için CSS opacity işe yaramaz. */
export const GIZMO_IDLE_OPACITY = 0.3

function applyGizmoOpacity(gizmo, multiplier) {
  gizmo.traverse((obj) => {
    if (!obj.isMesh && !obj.isSprite) return
    const mat = obj.material
    if (!mat) return
    const base = obj.userData.opacity ?? 1
    mat.opacity = base * multiplier
    mat.transparent = true
  })
}

function bindGizmoFade(gizmo, container) {
  const el = container.querySelector(`.${VIEWPORT_GIZMO_CLASS}`)
  if (!el) return

  let widgetHovered = false
  const onEnter = () => { widgetHovered = true }
  const onLeave = () => {
    widgetHovered = false
    applyGizmoOpacity(gizmo, GIZMO_IDLE_OPACITY)
  }

  el.addEventListener('pointerenter', onEnter)
  el.addEventListener('pointerleave', onLeave)

  const origRender = gizmo.render.bind(gizmo)
  gizmo.render = () => {
    const result = origRender()
    if (!widgetHovered) applyGizmoOpacity(gizmo, GIZMO_IDLE_OPACITY)
    return result
  }

  const origDispose = gizmo.dispose.bind(gizmo)
  gizmo.dispose = () => {
    el.removeEventListener('pointerenter', onEnter)
    el.removeEventListener('pointerleave', onLeave)
    origDispose()
  }

  onLeave()
}

export function createViewportGizmo(ViewportGizmo, camera, renderer, controls, container) {
  const gizmo = new ViewportGizmo(camera, renderer, {
    ...VIEWPORT_GIZMO_OPTIONS,
    className: VIEWPORT_GIZMO_CLASS,
    container
  })
  gizmo.attachControls(controls)
  bindGizmoFade(gizmo, container)
  return gizmo
}
