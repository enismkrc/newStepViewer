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

/** KF-21 için ortak görüntüleme ayarı (burun -Z yönünde olduğu için swapFrontBack=true). */
const KF21_VIEW_CONFIG: ViewConfigPartial = {
  modelRotation: { x: 0, y: Math.PI, z: 0 },
  cameraOffset: { x: 0.85, y: 0.65, z: -0.85 },
  swapFrontBack: true
}

export const MODEL_REGISTRY: ModelRegistry = {
  byModel: {
    'KF-21': {
      modelUrl: '/KF-21.gltf',
      viewConfig: KF21_VIEW_CONFIG
    }
  },
  byAircraftId: {},
  DEFAULT: {
    modelUrl: '/KF-21.gltf',
    viewConfig: KF21_VIEW_CONFIG
  }
}

function getAircraftModelKey(aircraft: Aircraft): string {
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
