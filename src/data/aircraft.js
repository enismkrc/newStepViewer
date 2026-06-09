/**
 * Mock aircraft list (as if from backend).
 * All use the same test model: F35.gltf
 *
 * NOTE: `faultyPart` / `detailFaultyPart` must match a node/mesh name inside the GLB.
 * The coordinate-based `faultMarkers` (aircraft-5) are independent of part names, but
 * their X/Y/Z values must be expressed in the GLB's own coordinate space/units.
 */
export const aircraftList = [
  {
    id: 'aircraft-1',
    country: 'USA',
    city: 'Fort Worth',
    fleet: 'Training Fleet',
    tailNumber: 'F-35A-01',
    displayName: 'F-35A 01',
    modelUrl: '/F35.gltf',
    hasFault: true,
    faultyPart: 'Engine',
    faultType: 'FAULT'
    // Detail (engine) model not added yet. When ready, drop the file in public/ and
    // re-enable these two lines:
    // detailModelUrl: '/engine.glb',
    // detailFaultyPart: '4 central mounting shaft'
  },
  {
    id: 'aircraft-2',
    country: 'USA',
    city: 'Fort Worth',
    fleet: 'Training Fleet',
    tailNumber: 'F-35A-02',
    displayName: 'F-35A 02',
    modelUrl: '/F35.gltf',
    hasFault: true,
    faultyPart: 'Front LG',
    faultType: 'SENSOR'
  },
  {
    id: 'aircraft-3',
    country: 'USA',
    city: 'Edwards AFB',
    fleet: 'Operational Fleet',
    tailNumber: 'F-35A-03',
    displayName: 'F-35A 03',
    modelUrl: '/F35.gltf',
    hasFault: false,
    faultyPart: null,
    faultType: null
  },
  {
    id: 'aircraft-4',
    country: 'UK',
    city: 'RAF Marham',
    fleet: 'Operational Fleet',
    tailNumber: 'F-35A-04',
    displayName: 'F-35A 04',
    modelUrl: '/F35.gltf',
    hasFault: false,
    faultyPart: null,
    faultType: null
  },
  {
    // Coordinate-based fault demo: instead of matching named parts, we place small
    // red cubes at given coordinates (representing external systems/LRUs reported by
    // an MFL list) and point a fault card at each one.
    id: 'aircraft-5',
    country: 'UK',
    city: 'RAF Marham',
    fleet: 'Operational Fleet',
    tailNumber: 'F-35A-05',
    displayName: 'F-35A 05 (MFL demo)',
    modelUrl: '/F35.gltf',
    hasFault: true,
    faultyPart: null,
    faultType: null,
    // Coordinates are in the F35 model space (X: ±5282, Y: 0–4709, Z: -15597 to -50).
    // `size` is optional per marker; tune it manually here.
    faultMarkers: [
      {
        position: { x: 0, y: 2600, z: -2000 },
        size: 250,
        fin: '34221',
        partName: 'IMU / Air Data System (LRU)',
        status: 'FAULT',
        warningFaults: 'LRU BIT failure from MFL. Inertial Measurement Unit data invalid. Inspect connector; replace LRU per AMM 34-21-00 if BIT does not clear.'
      },
      {
        position: { x: -3800, y: 2300, z: -8000 },
        size: 250,
        fin: '24310',
        partName: 'Left Wing Fuel Pump',
        status: 'WARNING',
        warningFaults: 'Left wing boost pump low output pressure. Possible cavitation or wear. Inspect per AMM 28-22-00.'
      },
      {
        position: { x: 3800, y: 2300, z: -8000 },
        size: 250,
        fin: '27155',
        partName: 'Right Aileron Actuator',
        status: 'FAULT',
        warningFaults: 'Flight control actuator position feedback out of range. Possible hydraulic/electrical fault. Inspect per AMM 27-10-00.'
      },
      {
        position: { x: 0, y: 2400, z: -13500 },
        size: 250,
        fin: '72018',
        partName: 'Engine Exhaust Temp Sensor',
        status: 'WARNING',
        warningFaults: 'EGT sensor reading intermittent. Possible harness chafing near tail. Inspect per AMM 77-21-00.'
      },
      {
        position: { x: 0, y: 3600, z: -5500 },
        size: 250,
        fin: '23044',
        partName: 'Comm/Nav Antenna Unit',
        status: 'FAULT',
        warningFaults: 'Upper fuselage antenna unit no response on self-test. Check coax connection; replace unit per AMM 23-10-00.'
      }
    ]
  }
]
