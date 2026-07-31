/**
 * MODEL REGISTRY — Uçak → 3D model (GLB/glTF) eşlemesi
 */

import type { Aircraft } from '@/types/api-types'
import type { ViewConfig, ViewConfigPartial } from '@/types/view-types'

export interface ModelEntry {
  modelUrl: string
  viewConfig: ViewConfigPartial
}

export interface ModelRegistry {
  byModel: Record<string, ModelEntry>
  byAircraftId: Record<string, ModelEntry>
  DEFAULT: ModelEntry
}

/**
 * OML (dış kabuk) modeli CAD'den Z-up olarak export edilmiştir: uzun eksen Y, yükseklik Z.
 * Three.js Y-up çalıştığı için X ekseninde -90° döndürülür, aksi halde uçak kuyruğu
 * üzerinde dikilir. Burnun hangi yöne baktığına göre `swapFrontBack` ters çevrilebilir.
 */
const OML_VIEW_CONFIG: ViewConfigPartial = {
  modelRotation: { x: Math.PI / 2, y: 0, z: 0 },
  cameraOffset: { x: 0.85, y: 0.65, z: 0.85 },
  swapFrontBack: false
}

const OML_ENTRY: ModelEntry = {
  modelUrl: '/aircraft-oml.glb',
  viewConfig: OML_VIEW_CONFIG
}

export const MODEL_REGISTRY: ModelRegistry = {
  byModel: {
    OML: OML_ENTRY
  },
  byAircraftId: {},
  DEFAULT: OML_ENTRY
}

export function getAircraftModelKey(aircraft: Aircraft): string {
  const raw =
    aircraft.aircraftModel ??
    aircraft.model ??
    aircraft.aircraftType ??
    aircraft.type ??
    ''
  return String(raw).trim()
}

function lookupByModel(modelKey: string): ModelEntry | undefined {
  if (!modelKey) return undefined
  if (MODEL_REGISTRY.byModel[modelKey]) return MODEL_REGISTRY.byModel[modelKey]
  const lower = modelKey.toLowerCase()
  for (const [key, entry] of Object.entries(MODEL_REGISTRY.byModel)) {
    if (key.toLowerCase() === lower) return entry
  }
  return undefined
}

export function resolveModel(aircraft: Aircraft | null): { modelUrl: string; viewConfig: ViewConfigPartial | null } {
  if (!aircraft) return { modelUrl: '', viewConfig: null }
  return (
    MODEL_REGISTRY.byAircraftId[aircraft.id] ??
    lookupByModel(getAircraftModelKey(aircraft)) ??
    MODEL_REGISTRY.DEFAULT
  )
}

export function attachModel<T extends Aircraft | null>(aircraft: T): T {
  if (!aircraft) return aircraft
  const resolved = resolveModel(aircraft)
  return {
    ...aircraft,
    modelUrl: aircraft.modelUrl ?? resolved.modelUrl,
    viewConfig: aircraft.viewConfig ?? resolved.viewConfig
  }
}

export type { ViewConfig }
