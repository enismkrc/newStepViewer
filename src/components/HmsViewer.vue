<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="title">Model view</div>
      </div>

      <div class="controls">
        <button class="btn" :disabled="!modelLoaded" @click="resetView">Reset view</button>
        <button class="btn" :disabled="!modelLoaded" @click="toggleWireframe">
          {{ wireframe ? 'Solid' : 'Wireframe' }}
        </button>
        <button v-if="modelLoaded && hasFaults" type="button" class="btn btn-panel-toggle" :class="{ active: transparentOthers }" @click="transparentOthers = !transparentOthers">
          {{ transparentOthers ? 'Others opaque' : 'Others transparent' }}
        </button>
        <button v-if="isIsolated || isDetailView" class="btn btn-back" @click="showAllParts">
          ← Show all
        </button>
        <button v-if="isIsolated && partDetailData" type="button" class="btn btn-panel-toggle" :class="{ active: partDetailPanelOpen }" @click="partDetailPanelOpen = !partDetailPanelOpen">
          {{ partDetailPanelOpen ? 'Close detail' : 'Part detail' }}
        </button>
      </div>
    </header>

    <div class="status" v-if="statusText || errorText">
      <div v-if="statusText" class="statusText">{{ statusText }}</div>
      <div v-if="errorText" class="errorText">{{ errorText }}</div>
    </div>

    <div class="stage-wrapper" :class="{ 'stage-wrapper-split': isIsolated && partDetailData && partDetailPanelOpen }">
      <div class="stage" ref="stageRef">
        <canvas ref="canvasEl" class="canvas"></canvas>
        <button
          v-for="label in faultLabels"
          :key="'pin-' + label.id"
          type="button"
          class="fault-pin"
          :class="{ active: shownFaultId === label.id }"
          :style="{ left: label.x + 'px', top: label.y + 'px' }"
          @mouseenter="hoveredFaultId = label.id"
          @mouseleave="hoveredFaultId = null"
          @click="focusFault(label.id)"
        >
          {{ label.num }}
        </button>
        <div
          v-if="activeFaultLabel"
          class="fault-label-overlay"
          :style="{ left: activeFaultLabel.x + 'px', top: activeFaultLabel.y + 'px' }"
        >
          <div class="fault-label-line"></div>
          <div class="fault-label-box">
            <div class="fault-card-row fault-card-fin">FIN# {{ activeFaultLabel.card.fin }}</div>
            <div class="fault-card-row"><span class="fault-card-label">Part Name:</span> {{ activeFaultLabel.card.partName }}</div>
            <div class="fault-card-row"><span class="fault-card-label">Status:</span> <span class="fault-card-status">{{ activeFaultLabel.card.status }}</span></div>
            <div class="fault-card-row fault-card-warnings"><span class="fault-card-label">Warning/Faults:</span> {{ activeFaultLabel.card.warningFaults }}</div>
          </div>
        </div>
        <div v-if="hasFaults && !isIsolated" class="fault-list-panel">
          <div class="fault-list-title">Faults ({{ faultEntries.length }})</div>
          <ul class="fault-list">
            <li
              v-for="(f, i) in faultEntries"
              :key="f.id"
              class="fault-list-item"
              :class="{ active: shownFaultId === f.id }"
              @mouseenter="hoveredFaultId = f.id"
              @mouseleave="hoveredFaultId = null"
              @click="focusFault(f.id)"
            >
              <span class="fault-list-num">{{ i + 1 }}</span>
              <span class="fault-list-name">{{ f.card.partName }}</span>
              <span class="fault-list-status" :class="statusClass(f.card.status)">{{ f.card.status }}</span>
            </li>
          </ul>
        </div>
      </div>
      <aside v-if="isIsolated && partDetailPanelOpen && (isolatedMarkerData || partDetailData)" class="part-detail-panel">
        <div class="part-detail-panel-header">
          <h3 class="part-detail-title">{{ isolatedMarkerData ? 'Fault Detail' : 'Part Detail' }}</h3>
          <button type="button" class="part-detail-close" aria-label="Close" @click="partDetailPanelOpen = false">×</button>
        </div>
        <template v-if="isolatedMarkerData">
          <div class="part-detail-heading">{{ markerDetailData.partName }}</div>
          <dl class="part-detail-list">
            <dt>FIN</dt>
            <dd>{{ markerDetailData.fin }}</dd>
            <dt>Status</dt>
            <dd><span class="detail-status" :class="statusClass(markerDetailData.status)">{{ markerDetailData.status }}</span></dd>
            <dt>Warning/Faults</dt>
            <dd>{{ markerDetailData.warningFaults }}</dd>
            <dt>Coordinate (X, Y, Z)</dt>
            <dd>{{ markerDetailData.coordinate }}</dd>
          </dl>
        </template>
        <template v-else>
          <div class="part-detail-heading">{{ partDetailData.partName }}</div>
          <dl class="part-detail-list">
            <dt>Parent Assembly</dt>
            <dd>{{ partDetailData.parentAssembly }}</dd>
            <dt>Replacement requirement</dt>
            <dd>{{ partDetailData.replacementRequirement }}</dd>
            <dt>Stock status</dt>
            <dd>{{ partDetailData.stockStatus }}</dd>
            <dt>ATA chapter</dt>
            <dd>{{ partDetailData.ataChapter }}</dd>
            <dt>Lead time</dt>
            <dd>{{ partDetailData.leadTime }}</dd>
            <dt>Serial no. range</dt>
            <dd>{{ partDetailData.serialRange }}</dd>
            <dt>Remarks</dt>
            <dd>{{ partDetailData.remarks }}</dd>
          </dl>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * HMS (Health Management System) viewer (Three.js)
 *
 * Main responsibilities:
 * - Load a GLB/glTF model from `modelUrl` (binary glTF, loaded natively by Three.js).
 * - Highlight the "faulty" part in red. The faulty part name comes from `props.faultyPart`,
 *   which is set by the selected aircraft record (see `src/data/aircraft.js`).
 * - Allow interaction: hover highlight, click to isolate a part and zoom camera to it.
 * - Optional: if `detailModelUrl` is provided, clicking the faulty part can switch to a deeper/detail model.
 */
const props = defineProps({
  modelUrl: { type: String, default: '/F35.gltf' },
  /**
   * Name of the part that should be treated as "faulty" and highlighted in red.
   * This is passed from the parent page (selected aircraft).
   */
  faultyPart: { type: String, default: null },
  /**
   * Optional fault type. Used by UI text for the fault overlay card.
   */
  faultType: { type: String, default: null },
  /**
   * Optional: a second model URL for a detailed view (e.g. engine-only model).
   */
  detailModelUrl: { type: String, default: null },
  /**
   * Optional: the faulty part name inside the detail model.
   */
  detailFaultyPart: { type: String, default: null },
  /**
   * Optional: a list of coordinate-based fault markers.
   *
   * Instead of matching faults to existing parts by name, we place a small cube at
   * each given coordinate (e.g. the locations of LRUs/systems reported by an external
   * source such as an MFL list). Each cube is highlighted in red and gets its own
   * fault overlay card (arrow + info) pointing to it.
   *
   * Each item shape:
   * {
   *   position: { x, y, z },   // absolute coordinate in the model's space
   *   size: number,            // optional cube edge length (auto-sized if omitted)
   *   fin, partName, status, warningFaults  // fault overlay card content
   * }
   */
  faultMarkers: { type: Array, default: () => [] }
})

const canvasEl = ref(null)
const statusText = ref('Loading model...')
const errorText = ref('')
const wireframe = ref(false)

const modelLoaded = computed(() => meshesCount.value > 0)
const meshesCount = ref(0)
const isIsolated = ref(false)
const isolatedPartName = ref('')
// When the isolated object is a coordinate-based fault marker, its data is kept here
// so the detail panel can show fault-specific info instead of generic part info.
const isolatedMarkerData = ref(null)
const partDetailPanelOpen = ref(false)
const partNames = ref([])
const faultyPartName = ref(props.faultyPart ?? '')
const stageRef = ref(null)
const transparentOthers = ref(false)
const isDetailView = ref(false)
// Screen-space overlay labels for every fault (named part + coordinate markers).
// Each: { id, num, x, y, card: { fin, partName, status, warningFaults } }
const faultLabels = ref([])
// Which fault's detail card to show. Purely hover-driven: a card is shown only while
// the cursor is over that fault's pin, its list row, or its 3D object. When the cursor
// is not over any fault, no card is shown.
const hoveredFaultId = ref(null)
const shownFaultId = computed(() => hoveredFaultId.value)

/**
 * Unified fault list: combines an optional named-part fault (`faultyPart`) and any
 * coordinate-based markers (`faultMarkers`) into one numbered list. This drives the
 * side list panel, the numbered pins, and the hover detail cards for ALL aircraft.
 */
const faultEntries = computed(() => {
  const entries = []
  if (faultyPartName.value) {
    entries.push({
      id: 'part:' + faultyPartName.value,
      kind: 'part',
      partName: faultyPartName.value,
      card: faultCardData.value
    })
  }
  const markers = Array.isArray(props.faultMarkers) ? props.faultMarkers : []
  markers.forEach((m, i) => {
    entries.push({
      id: 'marker:' + i,
      kind: 'marker',
      markerIndex: i,
      card: markerCardData(m)
    })
  })
  return entries
})

const hasFaults = computed(() => faultEntries.value.length > 0)

// The single detail card to render (only the hovered fault), if it is on screen.
const activeFaultLabel = computed(() => {
  const id = shownFaultId.value
  if (id == null) return null
  return faultLabels.value.find((l) => l.id === id) || null
})

function statusClass(status) {
  return /fault/i.test(status || '') ? 'is-fault' : 'is-warning'
}

// Detail-panel content for an isolated coordinate-based fault marker.
const markerDetailData = computed(() => {
  const m = isolatedMarkerData.value
  if (!m) return null
  const card = markerCardData(m)
  const p = m.position || {}
  const fmt = (v) => (typeof v === 'number' ? Math.round(v) : '—')
  return {
    ...card,
    coordinate: `${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}`
  }
})

const faultCardData = computed(() => {
  // Overlay label content for the faulty part (demo data).
  // This is derived from `faultyPartName` (current faulty part name in the loaded model).
  const part = faultyPartName.value
  if (!part) return null
  const isFrontLG = part === 'Front LG' || /front\s*lg|nose\s*gear/i.test(part)
  const isFrontLGSensor = part === 'Front LG' && props.faultType === 'SENSOR'
  const isEngine = /engine/i.test(part)
  if (isFrontLG) {
    return {
      fin: '32101',
      partName: 'Front LG (Front Landing Gear)',
      status: isFrontLGSensor ? 'WARNING' : 'WARNING',
      warningFaults: isFrontLGSensor
        ? 'Sensor fault: position/weight-on-wheels (WOW). Nose gear door/strut position sensor out of tolerance. Calibrate per AMM 32-21-00 or replace sensor P/N 32101-002.'
        : 'Anomaly reported on Front Landing Gear. ATA 32-21. Inspect per AMM 32-00-00.'
    }
  }
  const isCentralMountingShaft = /central\s*mounting\s*shaft/i.test(part)
  if (isCentralMountingShaft) {
    return {
      fin: '28472',
      partName: 'Central Mounting Shaft',
      status: 'FAULT',
      warningFaults: 'Vibration exceedance at N2. Possible imbalance or bearing wear. Inspect shaft runout and bearing clearance per AMM 72-00-00. Replace if limits exceeded.'
    }
  }
  if (isEngine) {
    return {
      fin: '28472',
      partName: 'Central Mounting Shaft',
      status: 'FAULT',
      warningFaults: 'Vibration exceedance at N2. Possible imbalance or bearing wear. Inspect shaft runout and bearing clearance per AMM 72-00-00. Replace if limits exceeded.'
    }
  }
  return {
    fin: '-----',
    partName: part,
    status: 'WARNING',
    warningFaults: `Anomaly reported on ${part}. Inspect per AMM.`
  }
})

const partDetailData = computed(() => {
  const part = isolatedPartName.value
  if (!part) return null
  const isEngine = /engine/i.test(part)
  const isCentralMountingShaft = /central\s*mounting\s*shaft/i.test(part)
  const isLandingGear = /lg|landing|gear/i.test(part)
  const isFrontLGSensor = part === 'Front LG' && props.faultType === 'SENSOR'
  if (isCentralMountingShaft) {
    return {
      partName: 'Central Mounting Shaft',
      parentAssembly: 'F135-PW-100 — Jet engine Assem1 (Engine core)',
      replacementRequirement: 'On-condition; replace if runout or bearing clearance out of limits. Inspect per AMM 72-00-00.',
      stockStatus: 'In stock (1 unit) — P/N 28472-001',
      ataChapter: 'ATA 72 — Engine (72-00 Power Plant)',
      leadTime: '48–72 hours (central depot)',
      serialRange: 'SN 28472001 – 28472100',
      remarks: 'Shaft runout and bearing clearance check required. EASA Form 1 / 8130-3 required.'
    }
  }
  if (isEngine) {
    return {
      partName: 'Central Mounting Shaft',
      parentAssembly: 'F135-PW-100 — Jet engine Assem1 (Engine core)',
      replacementRequirement: 'On-condition; replace if runout or bearing clearance out of limits. Inspect per AMM 72-00-00.',
      stockStatus: 'In stock (1 unit) — P/N 28472-001',
      ataChapter: 'ATA 72 — Engine (72-00 Power Plant)',
      leadTime: '48–72 hours (central depot)',
      serialRange: 'SN 28472001 – 28472100',
      remarks: 'Shaft runout and bearing clearance check required. EASA Form 1 / 8130-3 required.'
    }
  }
  if (isLandingGear || isFrontLGSensor) {
    const isFrontLG = part === 'Front LG' || /front\s*lg|nose\s*gear/i.test(part)
    const baseRemarks = 'Oleopneumatic shock absorber check required.'
    const sensorRemarks = isFrontLGSensor
      ? ' Sensor fault: position/weight-on-wheels sensor to be calibrated or replaced. Apply AMM 32-21-00 sensor calibration/replacement procedure.'
      : ''
    return {
      partName: part === 'Front LG' ? 'Front LG (Front Landing Gear)' : part,
      parentAssembly: isFrontLG ? 'F35 Lightning II — Nose Landing Gear Assembly (ATA 32-21)' : 'F35 Lightning II — Landing Gear Assembly',
      replacementRequirement: isFrontLG
        ? 'Sensor fault: replace or calibrate per AMM 32-21-00. Scheduled overhaul per MSG-3.'
        : 'Scheduled overhaul per MSG-3; replace at wear limit',
      stockStatus: isFrontLG
        ? 'Sensor in stock (3 units) — P/N 32101-002. Assembly P/N 32101-001 on order.'
        : 'In stock (1 unit) — P/N 32101-001, available on order',
      ataChapter: isFrontLG ? 'ATA 32 — Landing Gear (32-21 Nose Gear)' : 'ATA 32 — Landing Gear',
      leadTime: isFrontLG ? '5–7 business days (sensor 24–48 h local depot)' : '5–7 business days',
      serialRange: 'SN 32101001 – 32101200',
      remarks: baseRemarks + sensorRemarks
    }
  }
  return {
    partName: part,
    parentAssembly: 'F35 Lightning II — F35v2',
    replacementRequirement: 'On-condition or scheduled per AMM and CMM',
    stockStatus: 'Supply on request',
    ataChapter: '—',
    leadTime: 'Depends on supplier',
    serialRange: '—',
    remarks: 'Part number and revision must be verified in AMM.'
  }
})

watch(faultyPartName, () => {
  // If we have a faulty part, default to making non-faulty parts semi-transparent.
  if (!faultyPartName.value) transparentOthers.value = false
  else transparentOthers.value = true
  updateFaultyHighlight()
})
watch(transparentOthers, () => updateFaultyHighlight())

watch([isIsolated, partDetailPanelOpen], () => {
  setTimeout(onResize, 80)
})

watch(() => props.modelUrl, (newUrl) => {
  loadModelFromUrl(newUrl)
  faultyPartName.value = props.faultyPart ?? ''
})

watch(() => props.faultyPart, (newVal) => {
  // Uçak değiştiğinde izolasyonu kaldır, tüm parçayı göster, kamerayı sıfırla
  if (modelGroup) {
    modelGroup.traverse((obj) => {
      if (obj.isMesh) obj.visible = true
    })
    isolatedMesh = null
    isIsolated.value = false
    isolatedPartName.value = ''
    isolatedMarkerData.value = null
    partDetailPanelOpen.value = false
    clearHover()
    resetView()
  }
  faultyPartName.value = newVal ?? ''
  transparentOthers.value = !!newVal
  isDetailView.value = false
})

let scene = null
let camera = null
let renderer = null
let controls = null
let modelGroup = null
let rafId = null
let raycaster = null
let pointer = null
let hoveredMesh = null
let isolatedMesh = null
let faultMarkerMeshes = []
const gltfLoader = new GLTFLoader()

function initThree() {
  const canvas = canvasEl.value
  if (!canvas) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf3f4f6)

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000)
  camera.position.set(10, 8, 10)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const ambient = new THREE.AmbientLight(0xffffff, 0.35)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xffffff, 1.25)
  key.position.set(2, 3, 4).normalize()
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x6aa6ff, 0.7)
  rim.position.set(-2, 0.5, -3).normalize()
  scene.add(rim)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = false
  controls.minDistance = 0.1
  controls.maxDistance = 100000

  modelGroup = new THREE.Group()
  // This FreeCAD glTF export is Z-up and its "up" is -Z. Make the aircraft sit upright
  // (+90° about world X) and yaw it -45° about world Y so the nose points toward the
  // lower-left of the initial view.
  modelGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  modelGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 4)
  scene.add(modelGroup)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerdown', onPointerDown)

  onResize()
  window.addEventListener('resize', onResize)
  loop()
}

const worldPos = new THREE.Vector3()
const ndc = new THREE.Vector3()

function loop() {
  rafId = requestAnimationFrame(loop)
  controls?.update()

  // Compute 2D screen positions for every fault overlay (named part + markers).
  const entries = faultEntries.value
  if (entries.length && modelGroup && camera && canvasEl.value) {
    const canvas = canvasEl.value
    const rect = canvas.getBoundingClientRect()
    const stage = canvas.parentElement
    const stageRect = stage.getBoundingClientRect()
    const labels = []
    entries.forEach((entry, idx) => {
      // Resolve the world position of this fault.
      let hasPos = false
      if (entry.kind === 'marker') {
        const cube = faultMarkerMeshes.find((c) => c.userData.markerIndex === entry.markerIndex)
        if (cube) {
          // While isolated, only show the isolated object's label.
          if (isIsolated.value && cube !== isolatedMesh) return
          cube.getWorldPosition(worldPos)
          hasPos = true
        }
      } else {
        // Named part: use the union bounding box center of matching meshes.
        if (isIsolated.value && !(isolatedMesh && isolatedMesh.userData.partName === entry.partName)) return
        const bbox = new THREE.Box3()
        modelGroup.traverse((obj) => {
          if (obj.isMesh && obj.userData.partName === entry.partName) bbox.union(new THREE.Box3().setFromObject(obj))
        })
        if (!bbox.isEmpty()) {
          bbox.getCenter(worldPos)
          hasPos = true
        }
      }
      if (!hasPos) return
      ndc.copy(worldPos).project(camera)
      // Skip faults that are behind the camera.
      if (ndc.z > 1) return
      const px = rect.left + (ndc.x + 1) * 0.5 * rect.width
      const py = rect.top + (1 - ndc.y) * 0.5 * rect.height
      labels.push({
        id: entry.id,
        num: idx + 1,
        x: px - stageRect.left,
        y: py - stageRect.top,
        card: entry.card
      })
    })
    faultLabels.value = labels
  } else if (faultLabels.value.length) {
    faultLabels.value = []
  }

  renderer?.render(scene, camera)
}

function onResize() {
  const canvas = canvasEl.value
  if (!canvas || !camera || !renderer) return
  const parent = canvas.parentElement
  const width = parent.clientWidth
  const height = parent.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function disposeObject(obj) {
  // GLB models are nested hierarchies, so we dispose recursively.
  obj.traverse((c) => {
    if (c.geometry) c.geometry.dispose()
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose())
      else c.material.dispose()
    }
  })
}

function clearModel() {
  meshesCount.value = 0
  partNames.value = []
  faultyPartName.value = props.faultyPart ?? ''
  isIsolated.value = false
  isolatedPartName.value = ''
  partDetailPanelOpen.value = false
  isolatedMesh = null
  faultMarkerMeshes = []
  faultLabels.value = []
  hoveredFaultId.value = null
  isolatedMarkerData.value = null
  clearHover()
  if (!modelGroup) return
  while (modelGroup.children.length) {
    const obj = modelGroup.children[0]
    modelGroup.remove(obj)
    disposeObject(obj)
  }
}

function applyPartStyle(mesh) {
  const mat = mesh.material
  if (!mat || !mat.isMeshStandardMaterial) return
  const isFaulty = mesh.userData.isFaultMarker || (faultyPartName.value && mesh.userData.partName === faultyPartName.value)
  if (isFaulty) {
    // Fault highlight color (red) is applied here.
    mat.color.setHex(0xdc2626)
    mat.emissive.setHex(0xb91c1c)
    mat.emissiveIntensity = 0.7
    mat.transparent = false
    mat.opacity = 1
    mat.depthWrite = true
  } else {
    mat.color.setHex(0xd6d9e6)
    mat.emissive.setHex(0x000000)
    mat.emissiveIntensity = 0
    mat.transparent = transparentOthers.value
    mat.opacity = transparentOthers.value ? 0.3 : 1
    mat.depthWrite = !transparentOthers.value
  }
}

function updateFaultyHighlight() {
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (obj.isMesh && obj !== hoveredMesh) applyPartStyle(obj)
  })
  if (hoveredMesh) {
    const mat = hoveredMesh.material
    if (mat && mat.isMeshStandardMaterial) {
      mat.emissive.setHex(0x2563eb)
      mat.emissiveIntensity = 0.35
      mat.color.lerp(new THREE.Color(0xffffff), 0.15)
    }
  }
}

function setHovered(mesh) {
  if (hoveredMesh === mesh) return

  if (hoveredMesh) applyPartStyle(hoveredMesh)

  hoveredMesh = mesh

  if (!hoveredMesh) return

  const mat = hoveredMesh.material
  if (!mat || !mat.isMeshStandardMaterial) return
  mat.emissive.setHex(0x2563eb)
  mat.emissiveIntensity = 0.35
  mat.color.lerp(new THREE.Color(0xffffff), 0.15)
}

function clearHover() {
  setHovered(null)
  hoveredFaultId.value = null
  const canvas = canvasEl.value
  if (canvas) canvas.style.cursor = 'default'
}

function onPointerLeave() {
  clearHover()
}

function onPointerMove(event) {
  const canvas = canvasEl.value
  if (!canvas || !raycaster || !camera || !modelGroup) return
  if (meshesCount.value === 0) return

  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  raycaster.setFromCamera(pointer, camera)

  const meshes = []
  modelGroup.traverse((obj) => {
    if (obj.isMesh && obj.visible) meshes.push(obj)
  })
  const hits = raycaster.intersectObjects(meshes, false)

  if (!hits.length) {
    clearHover()
    return
  }

  canvas.style.cursor = 'pointer'
  const obj = hits[0].object
  setHovered(obj)
  if (obj.userData.isFaultMarker) {
    hoveredFaultId.value = 'marker:' + obj.userData.markerIndex
  } else if (faultyPartName.value && obj.userData.partName === faultyPartName.value) {
    hoveredFaultId.value = 'part:' + faultyPartName.value
  } else {
    hoveredFaultId.value = null
  }
}

function onPointerDown(event) {
  const canvas = canvasEl.value
  if (!canvas || !raycaster || !camera || !modelGroup) return
  if (meshesCount.value === 0) return

  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  raycaster.setFromCamera(pointer, camera)

  const meshes = []
  modelGroup.traverse((obj) => {
    if (obj.isMesh && obj.visible) meshes.push(obj)
  })
  const hits = raycaster.intersectObjects(meshes, false)
  if (!hits.length) return

  const clicked = hits[0].object
  const clickedPartName = clicked?.userData?.partName || ''
  if (isIsolated.value && clicked === isolatedMesh) {
    showAllParts()
    return
  }
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart && clickedPartName === faultyPartName.value) {
    // Detail-view switch: when user clicks the faulty part, swap to the detail model.
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      faultyPartName.value = props.detailFaultyPart
      updateFaultyHighlight()
    })
    return
  }
  isolatePart(clicked)
}

function isolatePart(mesh) {
  if (!modelGroup) return
  clearHover()
  modelGroup.traverse((obj) => {
    if (obj.isMesh) obj.visible = (obj === mesh)
  })
  isolatedMesh = mesh
  isolatedPartName.value = mesh?.userData?.partName || ''
  isolatedMarkerData.value = mesh?.userData?.isFaultMarker ? mesh.userData.markerData : null
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3().setFromObject(mesh)
  // Zoom/fit behavior when a mesh is clicked:
  // - We isolate the mesh (hide others)
  // - Then we fit the camera to the mesh bounding box via `focusToBox`
  // - Smaller multiplier => closer zoom
  if (!bbox.isEmpty()) focusToBox(bbox, 1.2)
}

function focusFault(faultId) {
  // Clicking a fault pin or a list row "drills into" that fault: focus the camera on
  // it and open the detail panel. Works for both coordinate markers and named parts.
  if (!modelGroup) return
  const entry = faultEntries.value.find((e) => e.id === faultId)
  if (!entry) return

  if (entry.kind === 'marker') {
    const cube = faultMarkerMeshes.find((c) => c.userData.markerIndex === entry.markerIndex)
    if (cube) isolatePart(cube)
    return
  }

  // Named part: if a deeper detail model exists for this part, switch to it (same as
  // clicking the part in 3D); otherwise isolate the matching mesh.
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart && entry.partName === faultyPartName.value) {
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      faultyPartName.value = props.detailFaultyPart
      updateFaultyHighlight()
    })
    return
  }
  let target = null
  modelGroup.traverse((obj) => {
    if (!target && obj.isMesh && obj.userData.partName === entry.partName) target = obj
  })
  if (target) isolatePart(target)
}

function showAllParts() {
  if (isDetailView.value) {
    loadModelFromUrl(props.modelUrl)
    faultyPartName.value = props.faultyPart ?? ''
    isDetailView.value = false
    isolatedMesh = null
    isolatedPartName.value = ''
    isolatedMarkerData.value = null
    partDetailPanelOpen.value = false
    isIsolated.value = false
    clearHover()
    return
  }
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (obj.isMesh) obj.visible = true
  })
  isolatedMesh = null
  isolatedPartName.value = ''
  isolatedMarkerData.value = null
  partDetailPanelOpen.value = false
  isIsolated.value = false
  clearHover()
  resetView()
}

function setWireframe(enabled) {
  wireframe.value = enabled
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (obj.isMesh && obj.material) obj.material.wireframe = enabled
  })
}

function toggleWireframe() {
  setWireframe(!wireframe.value)
}

function focusToBox(bbox, distanceMultiplier = 4.0) {
  // Camera fit helper. Used for:
  // - initial load (fit entire model)
  // - isolate part (fit selected part)
  if (!camera || !controls) return
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bbox.getCenter(center)
  bbox.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
  cameraZ *= camera.aspect > 1 ? camera.aspect : 1
  cameraZ *= distanceMultiplier

  camera.position.set(center.x + cameraZ * 0.55, center.y + cameraZ * 0.35, center.z + cameraZ)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) return
  const bbox = new THREE.Box3().setFromObject(modelGroup)
  if (!bbox.isEmpty()) focusToBox(bbox, 0.5)
}

function clearFaultMarkers() {
  for (const cube of faultMarkerMeshes) {
    if (modelGroup) modelGroup.remove(cube)
    cube.geometry?.dispose()
    if (cube.material) {
      if (Array.isArray(cube.material)) cube.material.forEach((m) => m.dispose())
      else cube.material.dispose()
    }
  }
  faultMarkerMeshes = []
  faultLabels.value = []
}

/**
 * Build the marker card content (FIN/part/status/warnings) from a marker record.
 */
function markerCardData(marker) {
  return {
    fin: marker?.fin ?? '-----',
    partName: marker?.partName ?? 'System',
    status: marker?.status ?? 'FAULT',
    warningFaults: marker?.warningFaults ?? `Fault reported on ${marker?.partName ?? 'system'}.`
  }
}

/**
 * Create one small cube per entry in `props.faultMarkers`, each at its own
 * coordinate. Each cube represents an external system/LRU and is highlighted
 * in red; an overlay card (arrow + info) points to each one (see `loop`).
 */
function addFaultMarkers() {
  if (!modelGroup) return
  clearFaultMarkers()
  const markers = Array.isArray(props.faultMarkers) ? props.faultMarkers : []
  if (markers.length === 0) return

  // Default cube size: ~1.5% of the model's largest dimension, used when a marker
  // does not specify its own `size`.
  let maxDim = 0
  const modelBox = new THREE.Box3().setFromObject(modelGroup)
  if (!modelBox.isEmpty()) {
    const s = new THREE.Vector3()
    modelBox.getSize(s)
    maxDim = Math.max(s.x, s.y, s.z)
  }
  const defaultSize = maxDim > 0 ? maxDim * 0.015 : 1

  markers.forEach((marker, i) => {
    const pos = marker.position || { x: 0, y: 0, z: 0 }
    const size = marker.size && marker.size > 0 ? marker.size : defaultSize

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.7,
      roughness: 0.5,
      metalness: 0.2,
      wireframe: wireframe.value
    })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0)
    cube.scale.setScalar(size)
    cube.userData.isFaultMarker = true
    cube.userData.markerIndex = i
    cube.userData.markerData = marker
    cube.userData.partName = marker.partName || `Fault ${i + 1}`
    modelGroup.add(cube)
    faultMarkerMeshes.push(cube)
  })
}

/**
 * Derive the part name (= glTF node name) for a primitive mesh.
 *
 * GLTFLoader stores the ORIGINAL (un-deduplicated) glTF node name in
 * `object.userData.name`. A multi-primitive mesh becomes a named Group (the node)
 * with that userData.name; its primitive children have no userData.name. So we walk
 * up from the mesh and return the nearest ancestor (incl. self) that carries a
 * `userData.name`, which is exactly the leaf node name (e.g. "Engine", "Front LG").
 */
function pickPartName(mesh) {
  let o = mesh
  while (o && o !== modelGroup) {
    const n = o.userData && o.userData.name ? String(o.userData.name).trim() : ''
    if (n) return n
    o = o.parent
  }
  const meshName = (mesh.name || '').trim()
  return meshName || 'Part'
}

/**
 * Bake a mesh's world transform into a fresh position+normal-only geometry, so all
 * geometries of one part can be merged (mergeGeometries needs matching attributes).
 */
function bakeGeometry(mesh) {
  const src = mesh.geometry
  if (!src) return null
  const g = src.index ? src.toNonIndexed() : src.clone()
  g.applyMatrix4(mesh.matrixWorld)
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', g.getAttribute('position'))
  if (g.getAttribute('normal')) out.setAttribute('normal', g.getAttribute('normal'))
  else out.computeVertexNormals()
  if (g !== src) g.dispose()
  return out
}

/**
 * Render a loaded glTF/GLB into the scene.
 *
 * glTF/STEP exports often split a single part into many primitive meshes. We merge
 * all primitives that belong to the same node into ONE mesh per part, so the HMS
 * logic (fault highlight by part name, isolation, bounding-box fit) works on whole
 * parts instead of individual triangle chunks. Materials are replaced with a fresh
 * MeshStandardMaterial so per-mesh highlight/hover/transparency is safe.
 */
function renderGltf(gltf) {
  const root = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null)
  if (!root) throw new Error('glTF does not contain a scene.')

  root.updateMatrixWorld(true)

  const partGeoms = new Map()
  const order = []
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const partName = pickPartName(obj)
    const geom = bakeGeometry(obj)
    if (!geom) return
    if (!partGeoms.has(partName)) {
      partGeoms.set(partName, [])
      order.push(partName)
    }
    partGeoms.get(partName).push(geom)
  })

  for (const partName of order) {
    const geoms = partGeoms.get(partName)
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false)
    if (!merged) continue
    geoms.forEach((g) => { if (g !== merged) g.dispose() })

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd6d9e6),
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
      wireframe: wireframe.value
    })
    const mesh = new THREE.Mesh(merged, material)
    mesh.userData.partName = partName
    modelGroup.add(mesh)
    meshesCount.value += 1
  }

  // Free the original (now-unused) glTF scene resources.
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    }
  })

  partNames.value = order.slice().sort((a, b) => a.localeCompare(b))

  if (Array.isArray(props.faultMarkers) && props.faultMarkers.length > 0) {
    // Coordinate-based faults: place a red cube at each marker location.
    addFaultMarkers()
    faultyPartName.value = ''
    transparentOthers.value = true
  } else {
    faultyPartName.value = props.faultyPart ?? ''
    if (props.faultyPart) transparentOthers.value = true
  }
  updateFaultyHighlight()

  modelGroup.updateMatrixWorld(true)
  const fitBox = new THREE.Box3().setFromObject(modelGroup)
  if (!fitBox.isEmpty()) focusToBox(fitBox, 0.5)
}

async function loadModelFromUrl(url) {
  if (!url) return
  errorText.value = ''
  statusText.value = 'Loading model...'
  clearModel()
  try {
    const gltf = await gltfLoader.loadAsync(url)
    renderGltf(gltf)
    setWireframe(wireframe.value)
    statusText.value = `Loaded. Mesh count: ${meshesCount.value}`
  } catch (e) {
    console.error(e)
    errorText.value = e?.message || String(e)
    statusText.value = ''
  }
}

onMounted(() => {
  initThree()
  loadModelFromUrl(props.modelUrl)
  faultyPartName.value = props.faultyPart ?? ''
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (rafId) cancelAnimationFrame(rafId)
  const canvas = canvasEl.value
  if (canvas) {
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('pointerdown', onPointerDown)
  }
  controls?.dispose()
  renderer?.dispose()
  scene = camera = renderer = controls = modelGroup = null
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.title {
  font-size: 22px;
  font-weight: 800;
  color: #2c3e50;
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #dbe2ff;
  background: white;
  cursor: pointer;
  font-weight: 700;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-back {
  background: #1e40af;
  color: white;
  border-color: #1e40af;
}

.btn-panel-toggle {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}
.btn-panel-toggle.active {
  background: #1e40af;
  color: white;
  border-color: #1e40af;
}

.status {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.statusText {
  color: #111827;
  font-weight: 700;
}

.errorText {
  margin-top: 6px;
  color: #b91c1c;
  font-weight: 700;
}

.stage-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  height: min(72vh, 720px);
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.12);
}

.stage-wrapper-split {
  flex-direction: row;
  align-items: stretch;
}

.stage-wrapper-split .stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 0;
  border: none;
  border-right: 1px solid rgba(17, 24, 39, 0.1);
}

.stage-wrapper-split .part-detail-panel {
  flex-shrink: 0;
  min-height: 0;
  max-height: 100%;
  border-radius: 0;
  border: none;
}

.part-detail-panel {
  width: 340px;
  max-width: 100%;
  padding: 20px 18px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  overflow-y: auto;
  overflow-x: hidden;
}

.part-detail-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.part-detail-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.part-detail-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.part-detail-close:hover {
  background: #cbd5e1;
  color: #334155;
}

.part-detail-heading {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #1e40af;
}

.part-detail-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.part-detail-list dt {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin: 0 0 2px 0;
}

.part-detail-list dd {
  margin: 0 0 4px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #334155;
}

.part-detail-list dd:last-of-type {
  margin-bottom: 0;
}

.detail-status {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 4px;
}

.detail-status.is-fault {
  color: #b91c1c;
  background: #fee2e2;
}

.detail-status.is-warning {
  color: #92400e;
  background: #fef3c7;
}

.stage {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(1200px 600px at 50% 60%, rgba(59, 130, 246, 0.12), rgba(255, 255, 255, 0.6));
}

.stage-wrapper:not(.stage-wrapper-split) .stage {
  border-radius: 14px;
}

.fault-label-overlay {
  position: absolute;
  transform: translate(-50%, 0);
  pointer-events: none;
  z-index: 7;
}

.fault-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #dc2626;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(185, 28, 28, 0.45);
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.fault-pin:hover,
.fault-pin.active {
  transform: translate(-50%, -50%) scale(1.25);
  box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(185, 28, 28, 0.5);
  z-index: 8;
}

.fault-list-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 248px;
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12);
  overflow: hidden;
  z-index: 9;
}

.fault-list-title {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #b91c1c;
  background: #fef2f2;
  border-bottom: 1px solid rgba(185, 28, 28, 0.18);
}

.fault-list {
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
}

.fault-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.fault-list-item:hover,
.fault-list-item.active {
  background: #fef2f2;
}

.fault-list-item.active {
  box-shadow: inset 0 0 0 1px rgba(185, 28, 28, 0.4);
}

.fault-list-num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fault-list-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fault-list-status {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  border-radius: 4px;
}

.fault-list-status.is-fault {
  color: #b91c1c;
  background: #fee2e2;
}

.fault-list-status.is-warning {
  color: #92400e;
  background: #fef3c7;
}

.fault-label-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  margin-left: -1px;
  width: 2px;
  height: 50px;
  background: #b91c1c;
  border-radius: 1px;
}

.fault-label-box {
  position: absolute;
  bottom: 52px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 200px;
  max-width: 320px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #b91c1c;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(185, 28, 28, 0.2);
  font-size: 12px;
  color: #111827;
  line-height: 1.45;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.fault-label-box::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -6px;
  border: 6px solid transparent;
  border-top-color: #b91c1c;
}

.fault-card-row {
  margin-bottom: 6px;
}
.fault-card-row:last-child {
  margin-bottom: 0;
}

.fault-card-fin {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: #7f1d1d;
  border-bottom: 1px solid rgba(185, 28, 28, 0.25);
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.fault-card-label {
  font-weight: 600;
  color: #374151;
  margin-right: 4px;
}

.fault-card-status {
  font-weight: 700;
  color: #b91c1c;
  letter-spacing: 0.03em;
}

.fault-card-warnings {
  white-space: normal;
  word-break: break-word;
  font-size: 11px;
  color: #4b5563;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.fault-card-warnings .fault-card-label {
  display: block;
  margin-bottom: 2px;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
