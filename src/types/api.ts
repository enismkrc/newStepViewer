import type { ViewConfigPartial } from './view'

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

export interface MflRecord {
  finNumber?: string
  absoluteTime?: string
  relativeTime?: string
  faultCode?: string
  severity?: string
  category?: string
  description?: string
}

export interface NormalizedMflRecord {
  part?: string
  finNumber?: string
  MFL_Id: string
  MFL_Field_Name: string
  MFL_Description: string
  MFL_Absulut_time: string
  MFL_Relative_Time: string
  Fault_Code: string
  Severity: string
  Description: string
  Category: string
}

export interface Fault {
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
