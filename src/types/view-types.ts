export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface ViewZoom {
  fullModel: number
  part: number
  assembly: number
}

export interface ViewConfig {
  modelRotation: Vec3
  cameraOffset: Vec3
  zoom: ViewZoom
  swapFrontBack: boolean
}

export type ViewConfigPartial = Partial<{
  modelRotation: Partial<Vec3>
  cameraOffset: Partial<Vec3>
  zoom: Partial<ViewZoom>
  swapFrontBack: boolean
}>
