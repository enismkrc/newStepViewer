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

const VIEWPORT_GIZMO_BASE = {
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
    hover: { color: '#2563eb', opacity: 1, scale: 0.3 }
  },
  edges: {
    enabled: true,
    color: '#334155',
    opacity: 1,
    scale: 1,
    hover: { color: '#2563eb', opacity: 1 }
  },
  top: { ...FACE_STYLE, label: 'TOP' },
  right: { ...FACE_STYLE, label: 'RIGHT' },
  left: { ...FACE_STYLE, label: 'LEFT' },
  bottom: { ...FACE_STYLE, label: 'BOTTOM' }
}

export function buildViewportGizmoOptions({ swapFrontBack = false } = {}) {
  return {
    ...VIEWPORT_GIZMO_BASE,
    front: { ...FACE_STYLE, label: swapFrontBack ? 'BACK' : 'FRONT' },
    back: { ...FACE_STYLE, label: swapFrontBack ? 'FRONT' : 'BACK' }
  }
}

export const VIEWPORT_GIZMO_CLASS = 'view-cube-widget'
export const GIZMO_IDLE_OPACITY = 0.3

/** Tüm küpe aynı opaklık — yüz/kenar/köşe ayrı ayrı değil. */
function applyUniformGizmoOpacity(gizmo, opacity) {
  gizmo.traverse((obj) => {
    if (!obj.isMesh && !obj.isSprite) return
    const mat = obj.material
    if (!mat) return
    mat.opacity = opacity
    mat.transparent = opacity < 1
  })
}

function bindGizmoFade(gizmo, container) {
  const el = container.querySelector(`.${VIEWPORT_GIZMO_CLASS}`)
  if (!el) return

  let widgetHovered = false
  const syncOpacity = () => {
    applyUniformGizmoOpacity(gizmo, widgetHovered ? 1 : GIZMO_IDLE_OPACITY)
  }

  const onEnter = () => {
    widgetHovered = true
    syncOpacity()
  }
  const onLeave = () => {
    widgetHovered = false
    syncOpacity()
  }

  el.addEventListener('pointerenter', onEnter)
  el.addEventListener('pointerleave', onLeave)

  const origRender = gizmo.render.bind(gizmo)
  gizmo.render = () => {
    const result = origRender()
    // Kütüphane yüz hover'ında parça parça opacity değiştirir; her karede eşitle.
    syncOpacity()
    return result
  }

  const origDispose = gizmo.dispose.bind(gizmo)
  gizmo.dispose = () => {
    el.removeEventListener('pointerenter', onEnter)
    el.removeEventListener('pointerleave', onLeave)
    origDispose()
  }

  syncOpacity()
}

export function createViewportGizmo(ViewportGizmo, camera, renderer, controls, container, gizmoOptions = {}) {
  const gizmo = new ViewportGizmo(camera, renderer, {
    ...buildViewportGizmoOptions(gizmoOptions),
    className: VIEWPORT_GIZMO_CLASS,
    container
  })
  gizmo.attachControls(controls)
  bindGizmoFade(gizmo, container)
  return gizmo
}
