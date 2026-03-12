/**
 * Mock aircraft list (as if from backend).
 * All use the same test model: F35_converted.json
 */
export const aircraftList = [
  {
    id: 'aircraft-1',
    tailNumber: 'F-35A-01',
    displayName: 'F-35A 01',
    modelUrl: '/F35_converted.json',
    hasFault: true,
    faultyPart: 'Engine',
    faultType: 'FAULT',
    detailModelUrl: '/engine_converted.json',
    detailFaultyPart: '4 central mounting shaft'
  },
  {
    id: 'aircraft-2',
    tailNumber: 'F-35A-02',
    displayName: 'F-35A 02',
    modelUrl: '/F35_converted.json',
    hasFault: true,
    faultyPart: 'Front LG',
    faultType: 'SENSOR'
  },
  {
    id: 'aircraft-3',
    tailNumber: 'F-35A-03',
    displayName: 'F-35A 03',
    modelUrl: '/F35_converted.json',
    hasFault: false,
    faultyPart: null,
    faultType: null
  },
  {
    id: 'aircraft-4',
    tailNumber: 'F-35A-04',
    displayName: 'F-35A 04',
    modelUrl: '/F35_converted.json',
    hasFault: false,
    faultyPart: null,
    faultType: null
  }
]
