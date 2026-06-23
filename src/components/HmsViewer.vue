<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="title">Model View</div>
      </div>

      <div class="controls">
        <Button
          label="Reset view"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          :disabled="!modelLoaded"
          @click="resetView"
        />
        <Button
          :label="wireframe ? 'Solid' : 'Wireframe'"
          icon="pi pi-th-large"
          severity="secondary"
          outlined
          :disabled="!modelLoaded"
          @click="toggleWireframe"
        />
        <Button
          v-if="modelLoaded && hasFaults"
          :label="transparentOthers ? 'Opaque' : 'Transparent'"
          :severity="transparentOthers ? undefined : 'secondary'"
          :outlined="!transparentOthers"
          icon="pi pi-eye"
          @click="transparentOthers = !transparentOthers"
        />
        <Button
          v-if="isIsolated || isDetailView"
          label="Show all"
          icon="pi pi-arrow-left"
          @click="showAllParts"
        />
        <Button
          v-if="isIsolated && isolatedName"
          :label="partDetailPanelOpen ? 'Close detail' : 'Part detail'"
          :severity="partDetailPanelOpen ? undefined : 'secondary'"
          :outlined="!partDetailPanelOpen"
          icon="pi pi-info-circle"
          @click="partDetailPanelOpen = !partDetailPanelOpen"
        />
      </div>
    </header>

    <div class="status" v-if="statusText || errorText">
      <div v-if="statusText" class="statusText">{{ statusText }}</div>
      <div v-if="errorText" class="errorText">{{ errorText }}</div>
    </div>

    <div class="stage-wrapper" :class="{ 'stage-wrapper-split': isIsolated && isolatedName && partDetailPanelOpen }">
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
            <div class="fault-card-row"><span class="fault-card-label">Part:</span> {{ activeFaultLabel.card.lruName }}</div>
            <div class="fault-card-row"><span class="fault-card-label">MFL Id:</span> {{ activeFaultLabel.card.mflId }}</div>
            <div class="fault-card-row fault-card-desc"><span class="fault-card-label">Description:</span> {{ activeFaultLabel.card.description }}</div>
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
              <span class="fault-list-name">{{ f.card.lruName }}</span>
              <span class="fault-list-mfl">{{ f.card.mflId }}</span>
            </li>
          </ul>
        </div>
      </div>
      <aside v-if="isIsolated && partDetailPanelOpen && isolatedName" class="part-detail-panel">
        <div class="part-detail-panel-header">
          <h3 class="part-detail-title">Part Detail</h3>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            aria-label="Close"
            @click="partDetailPanelOpen = false"
          />
        </div>
        <div class="part-detail-heading">{{ isolatedName }}</div>

        <dl v-if="activeFaultSummary" class="part-detail-list">
          <dt>FIN</dt>
          <dd>{{ activeFaultSummary.fin }}</dd>
          <dt>Part</dt>
          <dd>{{ activeFaultSummary.lruName }}</dd>
          <dt>Fault Code</dt>
          <dd>{{ activeFaultSummary.mflId }}</dd>
          <dt>Description</dt>
          <dd>{{ activeFaultSummary.description }}</dd>
        </dl>

        <div v-if="activeLru" class="detail-section">
          <h4 class="detail-section-title">LRU</h4>
          <dl class="part-detail-list">
            <dt>LRU Instance Name</dt>
            <dd>{{ activeLru.LRU_Instance_Name }}</dd>
            <dt>LRU Serial No.</dt>
            <dd>{{ activeLru.LRU_Serial_No }}</dd>
          </dl>
        </div>

        <div v-if="activeMflList.length" class="detail-section">
          <h4 class="detail-section-title">MFL ({{ activeMflList.length }})</h4>
          <div v-for="m in activeMflList" :key="m.MFL_Id" class="mfl-block">
            <dl class="part-detail-list">
              <dt>MFL Id</dt>
              <dd>{{ m.MFL_Id }}</dd>
              <dt>Field Name</dt>
              <dd>{{ m.MFL_Field_Name }}</dd>
              <dt>Description</dt>
              <dd>{{ m.MFL_Description }}</dd>
              <dt>Absolute Time</dt>
              <dd>{{ m.MFL_Absulut_time }}</dd>
              <dt>Relative Time</dt>
              <dd>{{ m.MFL_Relative_Time }}</dd>
              <dt>Category</dt>
              <dd>{{ m.Category || '—' }}</dd>
              <dt>Fault Code</dt>
              <dd>{{ m.Fault_Code }}</dd>
              <dt>Severity</dt>
              <dd><span class="detail-status" :class="statusClass(m.Severity)">{{ m.Severity }}</span></dd>
              <dt>Detail</dt>
              <dd>{{ m.Description }}</dd>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ViewportGizmo } from 'three-viewport-gizmo'
import { createViewportGizmo } from '../three/viewportGizmoConfig.js'
import '../three/viewportGizmo.css'
import { mergeViewConfig, applyModelOrientation, frameCameraOnBox } from '../three/defaultView.js'
import { observeStageBackground, readStageColor } from '../three/sceneBackground.js'

// 3D sahne arka planı --stage-bg CSS değişkeninden okunur (ana projenin temasına uyar).
let disposeStageBg = null

/**
 * HMS (Health Management System) viewer (Three.js)
 *
 * Main responsibilities:
 * - Load a GLB/glTF model from `modelUrl` (binary glTF, loaded natively by Three.js).
 * - Highlight faulty parts from API `faults[]` (part names must match glTF node names).
 * - Allow interaction: hover highlight, click to isolate a part and zoom camera to it.
 * - Optional: if `detailModelUrl` is provided, clicking the faulty part can switch to a deeper/detail model.
 */
const props = defineProps({
  modelUrl: { type: String, default: '' },
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
   * Optional: multiple faults for one aircraft. Each item:
   * { part: string, type?: string, fin?: string, status?: string, warningFaults?: string }
   * `part` may be a leaf part OR an assembly name (whole assembly highlights red).
   * When provided, this takes precedence over the single `faultyPart`/`faultType`.
   */
  faults: { type: Array, default: () => [] },
  /** LRU records for this aircraft (from API). Linked to parts via `part` field. */
  lruList: { type: Array, default: () => [] },
  /** MFL records for this aircraft (from API). Linked to parts via `part` field. */
  mflList: { type: Array, default: () => [] },
  /**
   * Optional per-aircraft viewer tuning (from API / mock JSON).
   * { modelRotation?: {x,y,z}, cameraOffset?: {x,y,z}, zoom?: {...}, swapFrontBack?: boolean }
   */
  viewConfig: { type: Object, default: null }
})

const activeViewConfig = computed(() => mergeViewConfig(props.viewConfig))

const canvasEl = ref(null)
const statusText = ref('Loading model...')
const errorText = ref('')
const wireframe = ref(false)

const modelLoaded = computed(() => meshesCount.value > 0)
const meshesCount = ref(0)
const isIsolated = ref(false)
const isolatedPartName = ref('')
// Name of the part/assembly currently isolated. For a faulty assembly this is the
// assembly name (the whole unit is isolated, not an individual sub-part).
const isolatedName = ref('')
const partDetailPanelOpen = ref(false)
const partNames = ref([])
const stageRef = ref(null)
const transparentOthers = ref(false)
const isDetailView = ref(false)
// When a detail model is loaded, this holds the single faulty part name inside it.
const detailFaultName = ref('')
// Screen-space overlay labels for every fault (named parts).
// Each: { id, num, x, y, card: { fin, partName, status, warningFaults } }
const faultLabels = ref([])
// Which fault's detail card to show. Purely hover-driven: a card is shown only while
// the cursor is over that fault's pin, its list row, or its 3D object. When the cursor
// is not over any fault, no card is shown.
const hoveredFaultId = ref(null)
const shownFaultId = computed(() => hoveredFaultId.value)

/**
 * Normalized list of fault definitions for the current aircraft. Supports either the
 * multi-fault `faults` array or the single `faultyPart`/`faultType` props.
 */
const faultDefs = computed(() => {
  const raw = (Array.isArray(props.faults) && props.faults.length)
    ? props.faults
    : (props.faultyPart ? [{ part: props.faultyPart, type: props.faultType }] : [])
  // De-duplicate by part name while preserving order.
  const seen = new Set()
  const out = []
  for (const f of raw) {
    if (!f || !f.part || seen.has(f.part)) continue
    seen.add(f.part)
    out.push({ part: f.part, type: f.type ?? null, fin: f.fin, status: f.status, warningFaults: f.warningFaults })
  }
  return out
})

// Names of the parts/assemblies that should be highlighted red right now.
const activeFaultNames = computed(() => {
  if (isDetailView.value) return detailFaultName.value ? [detailFaultName.value] : []
  return faultDefs.value.map((f) => f.part)
})

/**
 * Fault list driving the side panel, the numbered pins and the hover detail cards.
 * Faults are always tied to a real, named part/assembly inside the model.
 */
const faultEntries = computed(() => {
  if (isDetailView.value) {
    return detailFaultName.value
      ? [{ id: 'part:' + detailFaultName.value, partName: detailFaultName.value, card: makeFaultCard(detailFaultName.value, null) }]
      : []
  }
  return faultDefs.value.map((f) => ({
    id: 'part:' + f.part,
    partName: f.part,
    card: makeFaultCard(f.part, f.type, f)
  }))
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

/**
 * Build a compact fault summary card from aircraft fault + LRU/MFL API data.
 * Shown on hover (pin / list row). Full detail is in the part detail panel.
 */
function makeFaultCard(part, type, override = {}) {
  if (!part) return null
  const mflRecords = props.mflList.filter((r) => r.part === part || r.finNumber === part)
  const primaryMfl = mflRecords[0] ?? null
  return {
    fin: override.fin ?? part,
    lruName: part,
    mflId: primaryMfl?.Fault_Code ?? primaryMfl?.MFL_Id ?? '—',
    description: primaryMfl?.Description ?? override.warningFaults ?? '—'
  }
}

/** Summary card for the currently isolated part (same fields as hover card). */
const activeFaultSummary = computed(() => {
  const name = isolatedName.value
  if (!name) return null
  const fault = faultDefs.value.find((f) => f.part === name)
  return makeFaultCard(name, fault?.type ?? null, fault ?? {})
})

/** LRU record for the currently isolated part/assembly. */
const activeLru = computed(() => {
  const name = isolatedName.value
  if (!name) return null
  return props.lruList.find((r) => r.part === name) ?? null
})

/** MFL records for the currently isolated part/assembly. */
const activeMflList = computed(() => {
  const name = isolatedName.value
  if (!name) return []
  return props.mflList.filter((r) => r.part === name)
})

watch(activeFaultNames, () => {
  // If there are faults, default to making non-faulty parts semi-transparent.
  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()
})
watch(transparentOthers, () => updateFaultyHighlight())

watch([isIsolated, partDetailPanelOpen], () => {
  setTimeout(onResize, 80)
})

watch(() => props.modelUrl, (newUrl) => {
  loadModelFromUrl(newUrl)
})

watch(() => [props.faultyPart, props.faults], () => {
  // Aircraft changed: clear isolation, show all parts, reset the camera.
  if (modelGroup) {
    modelGroup.traverse((obj) => {
      if (obj.isMesh) obj.visible = true
    })
    isolatedMesh = null
    isIsolated.value = false
    isolatedPartName.value = ''
    isolatedName.value = ''
    partDetailPanelOpen.value = false
    clearHover()
    resetView()
  }
  isDetailView.value = false
  detailFaultName.value = ''
  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()
}, { deep: true })

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
let viewportGizmo = null
const gltfLoader = new GLTFLoader()

function initViewportGizmo() {
  const container = stageRef.value || canvasEl.value?.parentElement
  if (!camera || !renderer || !controls || !container) return

  viewportGizmo?.dispose()
  viewportGizmo = createViewportGizmo(
    ViewportGizmo,
    camera,
    renderer,
    controls,
    container,
    { swapFrontBack: activeViewConfig.value.swapFrontBack }
  )
}

function initThree() {
  const canvas = canvasEl.value
  if (!canvas) return

  scene = new THREE.Scene()
  scene.background = readStageColor(stageRef.value)

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
  applyModelOrientation(modelGroup, activeViewConfig.value)
  scene.add(modelGroup)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerdown', onPointerDown)

  initViewportGizmo()

  onResize()
  window.addEventListener('resize', onResize)
  loop()
}

const worldPos = new THREE.Vector3()
const ndc = new THREE.Vector3()

function loop() {
  rafId = requestAnimationFrame(loop)
  controls?.update()

  // Compute 2D screen positions for every fault overlay (named parts).
  const entries = faultEntries.value
  if (entries.length && modelGroup && camera && canvasEl.value) {
    const canvas = canvasEl.value
    const rect = canvas.getBoundingClientRect()
    const stage = canvas.parentElement
    const stageRect = stage.getBoundingClientRect()
    const labels = []
    entries.forEach((entry, idx) => {
      // Named part: use the union bounding box center of matching meshes.
      if (isIsolated.value && entry.partName !== isolatedName.value) return
      const bbox = new THREE.Box3()
      modelGroup.traverse((obj) => {
        if (obj.isMesh && meshMatchesPart(obj, entry.partName)) bbox.union(new THREE.Box3().setFromObject(obj))
      })
      if (bbox.isEmpty()) return
      bbox.getCenter(worldPos)
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
  viewportGizmo?.render()
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
  viewportGizmo?.update()
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
  isIsolated.value = false
  isolatedPartName.value = ''
  isolatedName.value = ''
  partDetailPanelOpen.value = false
  isolatedMesh = null
  faultLabels.value = []
  hoveredFaultId.value = null
  clearHover()
  if (!modelGroup) return
  while (modelGroup.children.length) {
    const obj = modelGroup.children[0]
    modelGroup.remove(obj)
    disposeObject(obj)
  }
}

// True if the mesh belongs to ANY currently-active faulty part/assembly.
function meshIsFaulty(mesh) {
  const names = activeFaultNames.value
  for (const n of names) {
    if (meshMatchesPart(mesh, n)) return true
  }
  return false
}

function applyPartStyle(mesh) {
  const mat = mesh.material
  if (!mat || !mat.isMeshStandardMaterial) return
  const isFaulty = meshIsFaulty(mesh)
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
  // If the hovered mesh belongs to one of the faults, show that fault's card.
  let matchedId = null
  for (const e of faultEntries.value) {
    if (meshMatchesPart(obj, e.partName)) {
      matchedId = e.id
      break
    }
  }
  hoveredFaultId.value = matchedId
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
  // Clicking the currently-isolated unit again returns to the full model.
  if (isIsolated.value && meshMatchesPart(clicked, isolatedName.value)) {
    showAllParts()
    return
  }
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart && meshIsFaulty(clicked)) {
    // Detail-view switch: when user clicks a faulty part, swap to the detail model.
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      detailFaultName.value = props.detailFaultyPart
      updateFaultyHighlight()
    })
    return
  }
  // If the clicked mesh belongs to a faulty part/assembly, select the WHOLE unit
  // (e.g. clicking "Component003" inside "Left engine" selects the whole engine).
  // This prevents drilling into individual sub-parts of a faulty assembly.
  const faultName = faultNameForMesh(clicked)
  if (faultName) {
    isolateByName(faultName)
  } else {
    isolatePart(clicked)
  }
}

// Return the fault part/assembly name that the given mesh belongs to, or '' if none.
function faultNameForMesh(mesh) {
  for (const e of faultEntries.value) {
    if (meshMatchesPart(mesh, e.partName)) return e.partName
  }
  return ''
}

function isolatePart(mesh) {
  if (!modelGroup) return
  clearHover()
  modelGroup.traverse((obj) => {
    if (obj.isMesh) obj.visible = (obj === mesh)
  })
  isolatedMesh = mesh
  isolatedPartName.value = mesh?.userData?.partName || ''
  isolatedName.value = isolatedPartName.value
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3().setFromObject(mesh)
  // Zoom/fit behavior when a mesh is clicked:
  // - We isolate the mesh (hide others)
  // - Then we fit the camera to the mesh bounding box via `focusToBox`
  // - Smaller multiplier => closer zoom
  if (!bbox.isEmpty()) focusToBox(bbox, activeViewConfig.value.zoom.part)
}

/**
 * Isolate a whole part/assembly by name: show only the meshes that belong to it (incl.
 * all sub-parts of an assembly), open the detail panel and frame the camera on it.
 */
function isolateByName(name) {
  if (!modelGroup || !name) return
  clearHover()
  const matches = []
  modelGroup.traverse((obj) => {
    if (!obj.isMesh) return
    const m = meshMatchesPart(obj, name)
    obj.visible = m
    if (m) matches.push(obj)
  })
  if (!matches.length) return
  isolatedMesh = matches.length === 1 ? matches[0] : null
  isolatedPartName.value = name
  isolatedName.value = name
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3()
  matches.forEach((m) => bbox.union(new THREE.Box3().setFromObject(m)))
  if (!bbox.isEmpty()) {
    focusToBox(bbox, matches.length === 1 ? activeViewConfig.value.zoom.part : activeViewConfig.value.zoom.assembly)
  }
}

function focusFault(faultId) {
  // Clicking a fault pin or a list row "drills into" that fault: isolate the whole
  // faulty unit (part or assembly) and open the detail panel.
  if (!modelGroup) return
  const entry = faultEntries.value.find((e) => e.id === faultId)
  if (!entry) return

  // If a deeper detail model exists, switch to it instead of isolating.
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart) {
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      detailFaultName.value = props.detailFaultyPart
      updateFaultyHighlight()
    })
    return
  }
  isolateByName(entry.partName)
}

function showAllParts() {
  if (isDetailView.value) {
    loadModelFromUrl(props.modelUrl)
    isDetailView.value = false
    detailFaultName.value = ''
    isolatedMesh = null
    isolatedPartName.value = ''
    isolatedName.value = ''
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
  isolatedName.value = ''
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

function focusToBox(bbox, distanceMultiplier = activeViewConfig.value.zoom.fullModel) {
  frameCameraOnBox(camera, controls, bbox, distanceMultiplier, modelGroup, activeViewConfig.value)
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) return
  const bbox = new THREE.Box3().setFromObject(modelGroup)
  if (!bbox.isEmpty()) focusToBox(bbox, activeViewConfig.value.zoom.fullModel)
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
 * Collect the full chain of glTF node names from `obj` up to (but excluding) `stop`.
 * The result is [leafName, parentAssembly, grandparentAssembly, ...], letting us match
 * a fault against either a leaf part OR any ancestor assembly name.
 */
function nodePath(obj, stop) {
  const path = []
  let o = obj
  while (o && o !== stop) {
    const n = o.userData && o.userData.name ? String(o.userData.name).trim() : ''
    if (n && !path.includes(n)) path.push(n)
    o = o.parent
  }
  return path
}

/**
 * True if `mesh` belongs to part/assembly `name`: matches its own leaf name OR any
 * ancestor assembly name stored in `userData.partPath`. This is what makes selecting a
 * whole assembly (e.g. "DC Converter Unit") highlight all of its sub-parts.
 */
function meshMatchesPart(mesh, name) {
  if (!name || !mesh) return false
  if (mesh.userData.partName === name) return true
  const path = mesh.userData.partPath
  return Array.isArray(path) && path.includes(name)
}

/**
 * Bake a mesh's world transform into a fresh position(+normal+index)-only geometry, so
 * all geometries of one part can be merged (mergeGeometries needs matching attributes).
 *
 * BELLEK NOTU: Burada bilerek `toNonIndexed()` KULLANMIYORUZ. De-index etmek paylaşılan
 * vertex'leri çoğaltıp vertex sayısını birkaç katına çıkarır ve büyük CAD modellerinde
 * RAM'i patlatır (sekme çöker). Index korunur; sadece position/normal/index kopyalanır
 * (uv, color, tangent gibi gereksiz attribute'lar atılır).
 */
function bakeGeometry(mesh) {
  const src = mesh.geometry
  if (!src) return null
  const pos = src.getAttribute('position')
  if (!pos) return null
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', pos.clone())
  const normal = src.getAttribute('normal')
  if (normal) out.setAttribute('normal', normal.clone())
  if (src.index) out.setIndex(src.index.clone())
  out.applyMatrix4(mesh.matrixWorld) // position + normal'ı world uzayına taşır
  if (!normal) out.computeVertexNormals()
  return out
}

/**
 * Bir parçaya ait geometrileri mergeGeometries için uyumlu hale getirir.
 * mergeGeometries tüm girdilerin AYNI index durumunda (hepsi indexed ya da hepsi
 * non-indexed) olmasını ister. Karışıksa (nadir) hepsini de-index ederiz; bu sadece
 * o parça için geçerli olduğundan genel bellek kazancı korunur.
 */
function normalizePartGeoms(geoms) {
  const anyIndexed = geoms.some((g) => g.index)
  const allIndexed = geoms.every((g) => g.index)
  if (anyIndexed && !allIndexed) {
    return geoms.map((g) => {
      const ng = g.toNonIndexed()
      if (ng !== g) g.dispose()
      return ng
    })
  }
  return geoms
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
  const partPaths = new Map()
  const order = []
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const partName = pickPartName(obj)
    const geom = bakeGeometry(obj)
    if (!geom) return
    if (!partGeoms.has(partName)) {
      partGeoms.set(partName, [])
      partPaths.set(partName, nodePath(obj, root))
      order.push(partName)
    }
    partGeoms.get(partName).push(geom)
  })

  for (const partName of order) {
    let geoms = partGeoms.get(partName)
    if (geoms.length > 1) geoms = normalizePartGeoms(geoms)
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
    mesh.userData.partPath = partPaths.get(partName) || [partName]
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

  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()

  modelGroup.updateMatrixWorld(true)
  const fitBox = new THREE.Box3().setFromObject(modelGroup)
  if (!fitBox.isEmpty()) focusToBox(fitBox, activeViewConfig.value.zoom.fullModel)
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
  disposeStageBg = observeStageBackground(() => scene, () => stageRef.value)
  loadModelFromUrl(props.modelUrl)
})

onBeforeUnmount(() => {
  disposeStageBg?.()
  window.removeEventListener('resize', onResize)
  if (rafId) cancelAnimationFrame(rafId)
  const canvas = canvasEl.value
  if (canvas) {
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('pointerdown', onPointerDown)
  }
  viewportGizmo?.dispose()
  controls?.dispose()
  renderer?.dispose()
  viewportGizmo = null
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
  color: var(--text-primary);
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.status {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.statusText {
  color: var(--text-primary);
  font-weight: 700;
}

.errorText {
  margin-top: 6px;
  color: #ef4444;
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
  border: 1px solid var(--border-color);
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
  border-right: 1px solid var(--border-color);
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
  background: var(--bg-primary);
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
  color: var(--text-muted);
}

.part-detail-heading {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--color-primary-600);
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
  color: var(--text-muted);
  margin: 0 0 2px 0;
}

.part-detail-list dd {
  margin: 0 0 4px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

.part-detail-list dd:last-of-type {
  margin-bottom: 0;
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.detail-section-title {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.mfl-block {
  padding: 12px;
  margin-bottom: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.mfl-block:last-child {
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
  background: radial-gradient(1200px 600px at 50% 60%, rgba(59, 130, 246, 0.12), var(--bg-tertiary));
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
  /* Small + semi-transparent by default so it does not hide the faulty part. */
  transform: translate(-50%, -50%) scale(0.7);
  opacity: 0.5;
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
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
}

.fault-pin:hover,
.fault-pin.active {
  /* On hover/selection: grow to full size and become fully opaque. */
  transform: translate(-50%, -50%) scale(1.25);
  opacity: 1;
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 6px 20px var(--shadow-color);
  overflow: hidden;
  z-index: 9;
}

.fault-list-title {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #ef4444;
  background: rgba(220, 38, 38, 0.1);
  border-bottom: 1px solid rgba(220, 38, 38, 0.28);
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
  background: rgba(220, 38, 38, 0.1);
}

.fault-list-item.active {
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.28);
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fault-list-mfl {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
  background: var(--bg-primary);
  border: 1px solid #dc2626;
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--shadow-color);
  font-size: 12px;
  color: var(--text-primary);
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
  color: #ef4444;
  border-bottom: 1px solid rgba(220, 38, 38, 0.28);
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.fault-card-label {
  font-weight: 600;
  color: var(--text-muted);
  margin-right: 4px;
}

.fault-card-status {
  font-weight: 700;
  color: #b91c1c;
  letter-spacing: 0.03em;
}

.fault-card-desc {
  white-space: normal;
  word-break: break-word;
  font-size: 11px;
  color: var(--text-primary);
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.fault-card-desc .fault-card-label {
  display: block;
  margin-bottom: 2px;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
