import type { ViewConfigPartial } from './view-types'

export interface Fleet {
  id: string
  name: string
  base?: string
  country?: string
}

export interface Aircraft {
  id: string
  aircraftModel?: string
  model?: string
  aircraftType?: string
  type?: string
  name: string
  tailNumber: string
  modelUrl?: string
  viewConfig?: ViewConfigPartial
  country?: string
  city?: string
  fleet?: string
  displayName?: string
  hasFault?: boolean
  faults?: Fault[]
}

export interface Flight {
  id: string
  flightNo: string
}

export interface LruRecord {
  part: string
  LRU_Instance_Name: string
  LRU_Serial_No: string
}

/**
 * `getFilteredMflData` yanıtındaki ham MFL satırı.
 *
 * Backend bazı alanları PascalCase (`FlightNo`, `FleetName`) ve LRU alanlarını "Iru"
 * yazımıyla gönderiyor; normalizasyonun bozulmaması için her iki yazım da opsiyonel
 * olarak tanımlıdır.
 */
export interface MflRecord {
  mflMetaId?: string
  lruFieldsMflId?: string
  /** 3D modeldeki parçayı bulmak için kullanılan FIN numarası. */
  finNumber?: string
  absoluteTime?: string
  relativeTime?: number | string
  faultCode?: string
  severity?: string
  category?: string
  description?: string
  location?: string
  flightId?: string
  FlightNo?: string
  flightNo?: string
  missionType?: string
  aircraftId?: string
  aircraftName?: string
  FleetId?: string
  fleetId?: string
  FleetName?: string
  fleetName?: string
  fleetBase?: string
  IruModelId?: string
  lruModelId?: string
  IruModelName?: string
  lruModelName?: string
  IruFieldId?: string
  lruFieldId?: string
  IruFieldName?: string
  lruFieldName?: string
  ataChapterId?: string
  ataChapterCode?: string
}

/** Viewer'ın kullandığı sadeleştirilmiş MFL kaydı. Eksik alanlar boş string olur. */
export interface NormalizedMflRecord {
  /** Liste anahtarı (mflMetaId varsa o, yoksa türetilmiş). */
  id: string
  /** Ham `finNumber`. */
  fin: string
  /** Parça eşleştirmesi için normalize edilmiş FIN. */
  finKey: string
  faultCode: string
  severity: string
  category: string
  description: string
  location: string
  absoluteTime: string
  relativeTime: string
  ataChapterCode: string
  lruModelName: string
  lruFieldName: string
  flightNo: string
  missionType: string
  aircraftName: string
  fleetName: string
  fleetBase: string
  mflMetaId: string
}

export interface Fault {
  /** Eşleştirme için kullanılan ham FIN değeri. */
  part: string
  type: string
  fin: string
  status: string
  warningFaults: string
  records: NormalizedMflRecord[]
}

export interface Page<T> {
  content: T[]
  totalElements?: number
  totalPages?: number
  number?: number
  size?: number
}

export interface FetchJsonOptions {
  query?: Record<string, string>
  forceMock?: boolean
}
