<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="title">GLB Model Viewer</div>
        <div class="subtitle">Upload a GLB / glTF file to preview it</div>
      </div>

      <div class="controls">
        <label class="upload">
          Select file
          <input
            class="file"
            type="file"
            accept=".glb,.gltf"
            @change="onFileChange"
          />
        </label>

        <button class="btn" :disabled="!modelLoaded" @click="resetView">Reset view</button>
        <button class="btn" :disabled="!modelLoaded" @click="toggleWireframe">
          {{ wireframe ? 'Solid' : 'Wireframe' }}
        </button>
        <button class="btn" :class="{ active: treeOpen }" :disabled="!modelLoaded || !modelTree.length" @click="treeOpen = !treeOpen">
          Model tree
        </button>
        <button v-if="isIsolated" class="btn btn-back" @click="showAllParts">
          ← Show all
        </button>
        <button v-if="isIsolated && partDetailData" type="button" class="btn btn-panel-toggle" :class="{ active: partDetailPanelOpen }" @click="partDetailPanelOpen = !partDetailPanelOpen">
          {{ partDetailPanelOpen ? 'Close detail' : 'Part detail' }}
        </button>
      </div>
    </header>

    <div class="fault-row" v-if="modelLoaded && allNodeNames.length">
      <label class="fault-label">Faulty part:</label>
      <select v-model="faultyPartName" class="fault-select">
        <option value="">None</option>
        <option v-for="p in allNodeNames" :key="p" :value="p">{{ p }}</option>
      </select>
      <label v-if="faultyPartName" class="fault-check">
        <input type="checkbox" v-model="transparentOthers" />
        <span>Make other parts transparent</span>
      </label>
    </div>

    <div class="status" v-if="statusText || errorText">
      <div v-if="statusText" class="statusText">{{ statusText }}</div>
      <div v-if="errorText" class="errorText">{{ errorText }}</div>
      <div v-if="fileName" class="fileName">{{ fileName }}</div>
    </div>

    <div class="stage-wrapper" :class="{ 'stage-wrapper-split': isIsolated && partDetailData && partDetailPanelOpen }">
      <div class="stage" ref="stageRef">
        <canvas ref="canvasEl" class="canvas"></canvas>

        <div v-if="treeOpen && modelTree.length" class="tree-panel">
          <div class="tree-panel-header">
            <span class="tree-panel-title">Model tree</span>
            <div class="tree-panel-actions">
              <button type="button" class="tree-mini-btn" title="Expand all" @click="expandAllNodes">+</button>
              <button type="button" class="tree-mini-btn" title="Collapse all" @click="collapseAllNodes">−</button>
              <button type="button" class="tree-mini-btn" title="Close" @click="treeOpen = false">×</button>
            </div>
          </div>
          <div class="tree-list">
            <div
              v-for="row in flatTree"
              :key="row.id"
              class="tree-row"
              :class="{ selected: faultyPartName === row.partName }"
              :style="{ paddingLeft: 6 + row.depth * 14 + 'px' }"
            >
              <button
                v-if="row.hasChildren"
                type="button"
                class="tree-arrow"
                @click="toggleNode(row.id)"
              >{{ row.isExpanded ? '▾' : '▸' }}</button>
              <span v-else class="tree-arrow tree-arrow-empty"></span>
              <span class="tree-name" :title="row.name" @click="selectTreeNode(row)">{{ row.name }}</span>
            </div>
          </div>
        </div>
        <div
          v-if="faultLabelScreen.visible && faultCardData"
          class="fault-label-overlay"
          :style="{ left: faultLabelScreen.x + 'px', top: faultLabelScreen.y + 'px' }"
        >
          <div class="fault-label-line"></div>
          <div class="fault-label-box">
            <div class="fault-card-row fault-card-fin">FIN# {{ faultCardData.fin }}</div>
            <div class="fault-card-row"><span class="fault-card-label">Part Name:</span> {{ faultCardData.partName }}</div>
            <div class="fault-card-row"><span class="fault-card-label">Status:</span> <span class="fault-card-status">{{ faultCardData.status }}</span></div>
            <div class="fault-card-row fault-card-warnings"><span class="fault-card-label">Warning/Faults:</span> {{ faultCardData.warningFaults }}</div>
          </div>
        </div>
      </div>
      <aside v-if="isIsolated && partDetailData && partDetailPanelOpen" class="part-detail-panel">
        <div class="part-detail-panel-header">
          <h3 class="part-detail-title">Part Detail</h3>
          <button type="button" class="part-detail-close" aria-label="Close" @click="partDetailPanelOpen = false">×</button>
        </div>
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
import { ViewportGizmo } from 'three-viewport-gizmo'
import { createViewportGizmo } from '../three/viewportGizmoConfig.js'
import '../three/viewportGizmo.css'
import { DEFAULT_VIEW, frameCameraOnBox } from '../three/defaultView.js'

const canvasEl = ref(null)
const statusText = ref('Select a GLB / glTF file to load.')
const errorText = ref('')
const fileName = ref('')
const wireframe = ref(false)

const modelLoaded = computed(() => meshesCount.value > 0)
const meshesCount = ref(0)
const isIsolated = ref(false)
const isolatedPartName = ref('')
const partDetailPanelOpen = ref(false)
const partNames = ref([])
const faultyPartName = ref('')
const stageRef = ref(null)
const faultLabelScreen = ref({ x: 0, y: 0, visible: false })
const transparentOthers = ref(false)

// Model tree (glTF node hierarchy) shown as a collapsible panel.
const modelTree = ref([])
const expandedNodes = ref(new Set())
const treeOpen = ref(false)

/** Flatten the tree into rows for rendering, honoring each node's expanded state. */
const flatTree = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const hasChildren = n.children && n.children.length > 0
      const isExpanded = expandedNodes.value.has(n.id)
      out.push({ id: n.id, name: n.name, partName: n.partName, depth, hasChildren, isExpanded })
      if (hasChildren && isExpanded) walk(n.children, depth + 1)
    }
  }
  walk(modelTree.value, 0)
  return out
})

/** All node names (assemblies + leaves) for the "Faulty part" dropdown. */
const allNodeNames = computed(() => {
  const set = new Set()
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.name) set.add(n.name)
      if (n.children) walk(n.children)
    }
  }
  walk(modelTree.value)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const faultCardData = computed(() => {
  const part = faultyPartName.value
  if (!part) return null
  const isEngine = /engine/i.test(part)
  const isFrontLG = /front\s*lg|nose\s*gear/i.test(part)
  if (isEngine) {
    return {
      fin: '28471',
      partName: part,
      status: 'FAULT',
      warningFaults: 'High TET (Turbine Exit Temp). N2 vibration exceedance. Inspect for FOD / blade damage.'
    }
  }
  if (isFrontLG) {
    return {
      fin: '32101',
      partName: 'Front LG (Front Landing Gear)',
      status: 'WARNING',
      warningFaults: 'Sensor fault: position/weight-on-wheels (WOW). Nose gear door/strut position sensor out of tolerance. Calibrate per AMM 32-21-00 or replace sensor P/N 32101-002.'
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
  const isLandingGear = /lg|landing|gear/i.test(part)
  if (isEngine) {
    return {
      partName: part,
      parentAssembly: 'Propulsion module',
      replacementRequirement: 'On-condition; replace if TET/vibration limits exceeded or FOD confirmed',
      stockStatus: 'In stock (2 units) — P/N 28471-001',
      ataChapter: 'ATA 72 — Engine',
      leadTime: '24–48 hours (local depot)',
      serialRange: 'SN 28471001 – 28471250',
      remarks: 'Turbine blade inspection recommended. EASA Form 1 / 8130-3 required.'
    }
  }
  if (isLandingGear) {
    const isFrontLG = /front\s*lg|nose\s*gear/i.test(part)
    return {
      partName: part === 'Front LG' ? 'Front LG (Front Landing Gear)' : part,
      parentAssembly: isFrontLG ? 'Nose landing gear assembly' : 'Landing gear assembly',
      replacementRequirement: isFrontLG
        ? 'Sensor fault: replace or calibrate per AMM 32-21-00. Main gear scheduled per MSG-3.'
        : 'Scheduled overhaul per MSG-3; replace at wear limit',
      stockStatus: isFrontLG ? 'Sensor in stock (3 units) — P/N 32101-002. Assembly P/N 32101-001 on order.' : 'In stock (1 unit) — P/N 32101-001, available on order',
      ataChapter: isFrontLG ? 'ATA 32 — Landing Gear (32-21 Nose Gear)' : 'ATA 32 — Landing Gear',
      leadTime: isFrontLG ? '5–7 business days (sensor 24–48 h local depot)' : '5–7 business days',
      serialRange: 'SN 32101001 – 32101200',
      remarks: 'Oleopneumatic shock absorber check required. Position/WOW sensor calibration for Front LG per AMM 32-21-00.'
    }
  }
  return {
    partName: part,
    parentAssembly: 'Aircraft assembly',
    replacementRequirement: 'On-condition or scheduled per AMM and CMM',
    stockStatus: 'Supply on request',
    ataChapter: '—',
    leadTime: 'Depends on supplier',
    serialRange: '—',
    remarks: 'Part number and revision must be verified in AMM.'
  }
})

watch(faultyPartName, () => {
  if (!faultyPartName.value) transparentOthers.value = false
  else transparentOthers.value = true
  updateFaultyHighlight()
})
watch(transparentOthers, () => updateFaultyHighlight())

watch([isIsolated, partDetailPanelOpen], () => {
  setTimeout(onResize, 80)
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
    container
  )
}

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

  if (faultyPartName.value && modelGroup && camera && canvasEl.value) {
    const isViewingFaultyPart = !isIsolated.value || meshMatchesPart(isolatedMesh, faultyPartName.value)
    if (!isViewingFaultyPart) {
      faultLabelScreen.value = { x: 0, y: 0, visible: false }
    } else {
      const bbox = new THREE.Box3()
      modelGroup.traverse((obj) => {
        if (obj.isMesh && meshMatchesPart(obj, faultyPartName.value)) bbox.union(new THREE.Box3().setFromObject(obj))
      })
      if (!bbox.isEmpty()) {
        bbox.getCenter(worldPos)
        ndc.copy(worldPos).project(camera)
        const canvas = canvasEl.value
        const rect = canvas.getBoundingClientRect()
        const stage = canvas.parentElement
        const stageRect = stage.getBoundingClientRect()
        const px = rect.left + (ndc.x + 1) * 0.5 * rect.width
        const py = rect.top + (1 - ndc.y) * 0.5 * rect.height
        faultLabelScreen.value = {
          x: px - stageRect.left,
          y: py - stageRect.top,
          visible: true
        }
      } else {
        faultLabelScreen.value = { x: 0, y: 0, visible: false }
      }
    }
  } else {
    faultLabelScreen.value = { x: 0, y: 0, visible: false }
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
  faultyPartName.value = ''
  modelTree.value = []
  expandedNodes.value = new Set()
  isIsolated.value = false
  isolatedPartName.value = ''
  partDetailPanelOpen.value = false
  isolatedMesh = null
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
  const isFaulty = meshMatchesPart(mesh, faultyPartName.value)
  if (isFaulty) {
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
  setHovered(hits[0].object)
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
  if (isIsolated.value && clicked === isolatedMesh) {
    showAllParts()
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
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3().setFromObject(mesh)
  if (!bbox.isEmpty()) focusToBox(bbox, 1.2)
}

function showAllParts() {
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (obj.isMesh) obj.visible = true
  })
  isolatedMesh = null
  isolatedPartName.value = ''
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

function focusToBox(bbox, distanceMultiplier = DEFAULT_VIEW.zoom.fullModel) {
  frameCameraOnBox(camera, controls, bbox, distanceMultiplier, null, DEFAULT_VIEW)
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) return
  const bbox = new THREE.Box3().setFromObject(modelGroup)
  if (!bbox.isEmpty()) focusToBox(bbox, DEFAULT_VIEW.zoom.fullModel)
}

let treeIdCounter = 0

/**
 * Build a nested tree of named glTF nodes from the loaded scene. Unnamed wrapper nodes
 * are skipped and their children are bubbled up, so the tree only shows meaningful
 * assembly / part names.
 */
function buildTree(root) {
  treeIdCounter = 0
  const walk = (obj) => {
    const name = obj.userData && obj.userData.name ? String(obj.userData.name).trim() : ''
    const childNodes = []
    for (const child of obj.children || []) childNodes.push(...walk(child))
    if (name) return [{ id: 't' + treeIdCounter++, name, partName: name, children: childNodes }]
    return childNodes
  }
  const out = []
  for (const child of root.children || []) out.push(...walk(child))
  return out
}

function toggleNode(id) {
  const s = new Set(expandedNodes.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedNodes.value = s
}

function collectExpandableIds(nodes, acc) {
  for (const n of nodes) {
    if (n.children && n.children.length) {
      acc.push(n.id)
      collectExpandableIds(n.children, acc)
    }
  }
  return acc
}

function expandAllNodes() {
  expandedNodes.value = new Set(collectExpandableIds(modelTree.value, []))
}

function collapseAllNodes() {
  expandedNodes.value = new Set()
}

/**
 * Click a tree node to mark that node (assembly or leaf) as faulty -> it turns red.
 * Clicking the already-selected node clears the selection. The camera frames the node
 * but other parts stay visible/clickable so the user can still drill into a sub-part.
 */
function selectTreeNode(row) {
  if (faultyPartName.value === row.partName) {
    faultyPartName.value = ''
    return
  }
  faultyPartName.value = row.partName
  if (!modelGroup) return
  const matches = []
  modelGroup.traverse((o) => {
    if (o.isMesh && meshMatchesPart(o, row.partName)) matches.push(o)
  })
  if (matches.length) {
    const bbox = new THREE.Box3()
    matches.forEach((m) => bbox.union(new THREE.Box3().setFromObject(m)))
    if (!bbox.isEmpty()) focusToBox(bbox, 1.6)
  }
}

/**
 * Derive the part name (= glTF node name) for a primitive mesh. GLTFLoader stores the
 * original glTF node name in `userData.name`; for multi-primitive meshes only the node
 * (Group) carries it, so we return the nearest ancestor (incl. self) that has one.
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
 * Collect the full chain of glTF node names from `obj` up to (but excluding) `stop`:
 * [leafName, parentAssembly, grandparentAssembly, ...].
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
 * ancestor assembly name in `userData.partPath`. Lets a whole assembly highlight red.
 */
function meshMatchesPart(mesh, name) {
  if (!name || !mesh) return false
  if (mesh.userData.partName === name) return true
  const path = mesh.userData.partPath
  return Array.isArray(path) && path.includes(name)
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
 * Render a loaded glTF/GLB into the scene, merging all primitives that belong to the
 * same node into ONE mesh per part (so isolation / highlight work on whole parts).
 */
function renderGltf(gltf) {
  const root = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null)
  if (!root) throw new Error('glTF does not contain a scene.')

  root.updateMatrixWorld(true)

  // Build the node tree (for the model tree panel) from the original glTF hierarchy
  // before we merge/dispose it.
  modelTree.value = buildTree(root)
  expandedNodes.value = new Set(
    modelTree.value.filter((n) => n.children && n.children.length).map((n) => n.id)
  )

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
    mesh.userData.partPath = partPaths.get(partName) || [partName]
    modelGroup.add(mesh)
    meshesCount.value += 1
  }

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
  if (partNames.value.includes('Engine')) faultyPartName.value = 'Engine'
  if (faultyPartName.value) transparentOthers.value = true
  updateFaultyHighlight()

  modelGroup.updateMatrixWorld(true)
  const fitBox = new THREE.Box3().setFromObject(modelGroup)
  if (!fitBox.isEmpty()) focusToBox(fitBox, DEFAULT_VIEW.zoom.fullModel)
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  fileName.value = file.name
  errorText.value = ''
  statusText.value = 'Loading...'
  clearModel()

  try {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
      throw new Error('Unsupported file type. (.glb, .gltf)')
    }

    const buffer = await file.arrayBuffer()
    const gltf = await gltfLoader.parseAsync(buffer, '')
    renderGltf(gltf)
    setWireframe(wireframe.value)
    statusText.value = `Loaded. Mesh count: ${meshesCount.value}`
  } catch (e) {
    console.error(e)
    errorText.value = e?.message || String(e)
    statusText.value = ''
  } finally {
    event.target.value = ''
  }
}

onMounted(() => {
  initThree()
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
  color: #2c3e50;
}

.subtitle {
  margin-top: 4px;
  color: #6b7280;
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.upload {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #e0e6ff;
  background: linear-gradient(135deg, #111a3a, #243b6b);
  color: white;
  cursor: pointer;
  user-select: none;
  font-weight: 700;
}

.file {
  display: none;
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

.btn.active {
  background: #1e40af;
  color: white;
  border-color: #1e40af;
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

.fault-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.fault-label {
  font-weight: 700;
  color: #374151;
}

.fault-select {
  min-width: 200px;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: white;
  font-size: 14px;
  color: #111827;
}

.fault-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  user-select: none;
}

.fault-check input {
  width: 16px;
  height: 16px;
  accent-color: #b91c1c;
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

.fileName {
  margin-top: 6px;
  color: #6b7280;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
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
  z-index: 5;
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

.tree-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 6;
  width: 260px;
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(17, 24, 39, 0.15);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.15);
  overflow: hidden;
}

.tree-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.1);
  background: #f8fafc;
}

.tree-panel-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
}

.tree-panel-actions {
  display: flex;
  gap: 4px;
}

.tree-mini-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #475569;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.tree-mini-btn:hover {
  background: #e2e8f0;
}

.tree-list {
  overflow-y: auto;
  padding: 4px 0;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 6px;
  min-height: 26px;
  font-size: 13px;
  color: #1f2937;
}
.tree-row.selected {
  background: rgba(220, 38, 38, 0.12);
}
.tree-row.selected .tree-name {
  color: #b91c1c;
  font-weight: 700;
}

.tree-arrow {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.tree-arrow-empty {
  cursor: default;
}

.tree-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  padding: 3px 2px;
  border-radius: 4px;
}
.tree-name:hover {
  background: rgba(37, 99, 235, 0.1);
}
</style>
