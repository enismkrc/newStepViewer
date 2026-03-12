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
        <button v-if="modelLoaded && faultyPartName" type="button" class="btn btn-panel-toggle" :class="{ active: transparentOthers }" @click="transparentOthers = !transparentOthers">
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

const props = defineProps({
  modelUrl: { type: String, default: '/F35_converted.json' },
  faultyPart: { type: String, default: null },
  faultType: { type: String, default: null },
  detailModelUrl: { type: String, default: null },
  detailFaultyPart: { type: String, default: null }
})

const canvasEl = ref(null)
const statusText = ref('Loading model...')
const errorText = ref('')
const wireframe = ref(false)

const modelLoaded = computed(() => meshesCount.value > 0)
const meshesCount = ref(0)
const isIsolated = ref(false)
const isolatedPartName = ref('')
const partDetailPanelOpen = ref(false)
const partNames = ref([])
const faultyPartName = ref(props.faultyPart ?? '')
const lastImportResult = ref(null)
const stageRef = ref(null)
const faultLabelScreen = ref({ x: 0, y: 0, visible: false })
const transparentOthers = ref(false)
const isDetailView = ref(false)

const faultCardData = computed(() => {
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
    const isViewingFaultyPart = !isIsolated.value || (isolatedMesh && isolatedMesh.userData.partName === faultyPartName.value)
    if (!isViewingFaultyPart) {
      faultLabelScreen.value = { x: 0, y: 0, visible: false }
    } else {
      const bbox = new THREE.Box3()
      modelGroup.traverse((obj) => {
        if (obj.isMesh && obj.userData.partName === faultyPartName.value) bbox.union(new THREE.Box3().setFromObject(obj))
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

function clearModel() {
  meshesCount.value = 0
  partNames.value = []
  faultyPartName.value = props.faultyPart ?? ''
  lastImportResult.value = null
  isIsolated.value = false
  isolatedPartName.value = ''
  partDetailPanelOpen.value = false
  isolatedMesh = null
  clearHover()
  if (!modelGroup) return
  while (modelGroup.children.length) {
    const obj = modelGroup.children[0]
    modelGroup.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
      else obj.material.dispose()
    }
  }
}

function applyPartStyle(mesh) {
  const mat = mesh.material
  if (!mat || !mat.isMeshStandardMaterial) return
  const isFaulty = faultyPartName.value && mesh.userData.partName === faultyPartName.value
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
  const clickedPartName = clicked?.userData?.partName || ''
  if (isIsolated.value && clicked === isolatedMesh) {
    showAllParts()
    return
  }
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart && clickedPartName === faultyPartName.value) {
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
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3().setFromObject(mesh)
  // Bring the selected part closer in view.
  if (!bbox.isEmpty()) focusToBox(bbox, 1.2)
}

function showAllParts() {
  if (isDetailView.value) {
    loadModelFromUrl(props.modelUrl)
    faultyPartName.value = props.faultyPart ?? ''
    isDetailView.value = false
    isolatedMesh = null
    isolatedPartName.value = ''
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

function renderImported(importResult) {
  if (!importResult?.meshes?.length) return
  const bbox = new THREE.Box3()
  let first = true
  const nameSet = new Set()
  let meshIndex = 0

  for (const meshData of importResult.meshes) {
    if (!meshData?.attributes?.position?.array || !meshData?.index?.array) {
      meshIndex++
      continue
    }

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(meshData.attributes.position.array)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    if (meshData.attributes.normal?.array) {
      const normals = new Float32Array(meshData.attributes.normal.array)
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    } else {
      geometry.computeVertexNormals()
    }

    const indices = new (positions.length / 3 > 65535 ? Uint32Array : Uint16Array)(meshData.index.array)
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))

    const partName = (meshData.name && String(meshData.name).trim()) || `Parça #${meshIndex + 1}`
    nameSet.add(partName)

    const material = new THREE.MeshStandardMaterial({
      color: meshData.color && meshData.color.length === 3 ? new THREE.Color(...meshData.color) : new THREE.Color(0xd6d9e6),
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
      wireframe: wireframe.value
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.partName = partName
    modelGroup.add(mesh)
    meshesCount.value += 1

    if (first) {
      bbox.setFromObject(mesh)
      first = false
    } else {
      bbox.union(new THREE.Box3().setFromObject(mesh))
    }
    meshIndex++
  }

  partNames.value = Array.from(nameSet).sort((a, b) => a.localeCompare(b))
  faultyPartName.value = props.faultyPart ?? ''
  if (props.faultyPart) transparentOthers.value = true
  updateFaultyHighlight()
  if (!bbox.isEmpty()) focusToBox(bbox, 0.5)
}

async function loadModelFromUrl(url) {
  if (!url) return
  errorText.value = ''
  statusText.value = 'Loading model...'
  clearModel()
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`File not found: ${res.status}`)
    const text = await res.text()
    const data = JSON.parse(text)
    if (!data || !Array.isArray(data.meshes)) throw new Error('Invalid JSON: meshes array not found.')
    if (data.success === undefined) data.success = true
    lastImportResult.value = data
    renderImported(data)
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
</style>
