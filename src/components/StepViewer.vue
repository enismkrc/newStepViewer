<template>
  <div class="step-viewer">
    <div class="viewer-header">
      <h2>🛩️ Uçak Bakım Görüntüleyicisi</h2>
      <p>STEP/IGES/BREP içe aktar · Arızalı parçayı kırmızı vurgula · Tıkla → izolasyon + zoom</p>
    </div>

    <div class="fault-info-panel">
      <div class="fault-header">
        <h3>⚠️ Tespit Edilen Arıza</h3>
        <div class="fault-severity" :class="faultData.severity">
          {{ faultData.severityText }}
        </div>
      </div>

      <div class="fault-details">
        <div class="fault-item">
          <strong>Model Dosyası:</strong>
          <span class="mono">{{ selectedFile?.name || 'Seçilmedi' }}</span>
        </div>

        <div class="fault-item">
          <strong>Arızalı Parça:</strong>
          <span v-if="!parts.length">{{ faultData.componentName }}</span>
          <span v-else class="faulty-part-select">
            <select v-model="faultyPartName" class="select">
              <option v-for="p in parts" :key="p.id" :value="p.name">{{ p.name }}</option>
            </select>
          </span>
        </div>

        <div class="fault-item">
          <strong>Arıza Türü:</strong>
          <span>{{ faultData.faultType }}</span>
        </div>
        <div class="fault-item">
          <strong>Tespit Tarihi:</strong>
          <span>{{ faultData.detectionDate }}</span>
        </div>
        <div class="fault-item">
          <strong>Öngörülen Kalan Ömür:</strong>
          <span>{{ faultData.remainingLife }}</span>
        </div>
        <div class="fault-item">
          <strong>Önerilen Aksiyon:</strong>
          <span>{{ faultData.recommendedAction }}</span>
        </div>
      </div>
    </div>

    <div class="viewer-container">
      <div class="viewer-controls">
        <label class="upload-btn">
          📦 Uçak STEP/IGES/BREP/JSON Yükle
          <input
            type="file"
            class="file-input"
            accept=".step,.stp,.iges,.igs,.brep,.json"
            @change="handleFileUpload"
          />
        </label>

        <button @click="resetView" class="control-btn">🔄 Görünümü Sıfırla</button>
        <button @click="toggleHighlight" class="control-btn">
          {{ showHighlight ? '🚨 Vurguyu Kapat' : '🚨 Arızalı Parçayı Vurgula' }}
        </button>
        <button @click="toggleWireframe" class="control-btn">
          {{ wireframeMode ? '🔲 Katı' : '🔳 Tel Kafes' }}
        </button>
        <button @click="showOnlyFaulty" class="control-btn" :disabled="!parts.length">
          🔍 Sadece Arızalı
        </button>
        <button @click="showAllParts" class="control-btn" :disabled="!parts.length">
          👁️ Tüm Parçalar
        </button>
        <button v-if="isolatedPartId != null" @click="showAllParts" class="control-btn danger">
          ⬅️ İzolasyondan Çık
        </button>
      </div>

      <div class="canvas-container">
        <canvas ref="threeCanvas" class="three-canvas"></canvas>
        <div v-if="loading" class="loading-overlay">
          <div class="loading-spinner">⏳</div>
          <p>Model yükleniyor ve hazırlanıyor...</p>
        </div>
      </div>
    </div>

    <div class="component-list">
      <h3>📋 Model Parçaları</h3>
      <p v-if="parts.length" class="hint">
        İpucu: 3D sahnede bir parçaya tıkla → sadece o parça kalsın (izolasyon + zoom). Aynı parçaya tekrar tıkla → geri dön.
      </p>
      <p v-else class="hint">Önce bir STEP/IGES/BREP/JSON dosyası yükleyin.</p>

      <div class="component-grid">
        <div
          v-for="part in parts"
          :key="part.id"
          class="component-item"
          :class="{ faulty: part.isFaulty, highlighted: highlightedPartId === part.id, hidden: !part.visible }"
          @click="highlightPart(part.id)"
        >
          <div class="component-icon">{{ part.isFaulty ? '🚨' : '🧩' }}</div>
          <div class="component-info">
            <div class="component-name">{{ part.name }}</div>
            <div class="component-status" :class="part.isFaulty ? 'faulty' : 'good'">
              {{ part.isFaulty ? 'Arızalı' : 'Normal' }}
            </div>
          </div>
          <div class="component-controls">
            <button
              @click.stop="togglePartVisibility(part.id)"
              class="visibility-btn"
              :title="part.visible ? 'Parçayı Gizle' : 'Parçayı Göster'"
            >
              {{ part.visible ? '👁️' : '🙈' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import occtimportjs from 'occt-import-js'

const threeCanvas = ref(null)
const loading = ref(false)
const wireframeMode = ref(false)
const showHighlight = ref(true)
const selectedFile = ref(null)

const parts = ref([]) // { id, name, visible, isFaulty }
const faultyPartName = ref('')
const highlightedPartId = ref(null)
const isolatedPartId = ref(null)

const faultData = ref({
  componentName: 'Arızalı parça seçin',
  faultType: 'Metal Fatigue',
  detectionDate: '2024-01-15',
  remainingLife: '72 saat',
  severity: 'high',
  severityText: 'Yüksek Öncelik',
  recommendedAction: 'Acil Değişim Gerekli'
})

let scene = null
let camera = null
let renderer = null
let controls = null
let modelGroup = null
let raycaster = null
let pointer = null
let animationFrameId = null

const allMeshes = new Map() // meshIndex -> mesh
const faultMeshes = new Map() // meshIndex -> mesh
const partNameToId = new Map() // name -> id

function isFaultyName(name) {
  if (!name || !faultyPartName.value) return false
  return name.toLowerCase() === faultyPartName.value.toLowerCase()
}

function initThreeDScene() {
  const canvas = threeCanvas.value
  if (!canvas) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1020)

  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 5000)
  camera.position.set(10, 10, 10)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35)
  scene.add(ambientLight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.25)
  directionalLight.position.set(2, 3, 4).normalize()
  scene.add(directionalLight)
  const rimLight = new THREE.DirectionalLight(0x6aa6ff, 0.65)
  rimLight.position.set(-2, 0.5, -3).normalize()
  scene.add(rimLight)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.25
  controls.screenSpacePanning = false
  controls.minDistance = 2
  controls.maxDistance = 5000

  modelGroup = new THREE.Group()
  scene.add(modelGroup)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvas.addEventListener('pointerdown', onCanvasPointerDown)

  animate()
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  if (controls) controls.update()

  // Arızalı parça "kırmızı yanıyor" efekti (pulse)
  const t = performance.now() / 1000
  const pulse = 0.35 + (Math.sin(t * 4.5) + 1) * 0.325 // 0.35..1.0
  if (showHighlight.value) {
    faultMeshes.forEach((mesh) => {
      const mat = mesh.material
      if (mat && mat.isMeshStandardMaterial) {
        mat.emissive.setHex(0xff1b1b)
        mat.emissiveIntensity = pulse
      }
    })
  } else {
    faultMeshes.forEach((mesh) => {
      const mat = mesh.material
      if (mat && mat.isMeshStandardMaterial) mat.emissiveIntensity = 0
    })
  }

  if (renderer && scene && camera) renderer.render(scene, camera)
}

function clearModel() {
  if (modelGroup) {
    while (modelGroup.children.length > 0) {
      const object = modelGroup.children[0]
      modelGroup.remove(object)
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
        else object.material.dispose()
      }
    }
  }

  allMeshes.clear()
  faultMeshes.clear()
}

function onWindowResize() {
  const canvas = threeCanvas.value
  if (!canvas || !camera || !renderer) return
  const parent = canvas.parentElement
  const width = parent.clientWidth
  const height = Math.min(width * 0.75, 600)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  selectedFile.value = file
  loadFromFile(file)
  event.target.value = ''
}

async function loadFromFile(file) {
  loading.value = true
  isolatedPartId.value = null
  highlightedPartId.value = null
  parts.value = []
  faultyPartName.value = ''
  partNameToId.clear()
  clearModel()

  try {
    const fileName = file.name.toLowerCase()
    const buffer = await file.arrayBuffer()

    if (fileName.endsWith('.json')) {
      const jsonText = new TextDecoder().decode(new Uint8Array(buffer))
      const data = JSON.parse(jsonText)
      if (!data?.meshes || !Array.isArray(data.meshes)) throw new Error('JSON içinde meshes bulunamadı.')
      if (data.success === undefined) data.success = true
      renderImportedModel(data)
      initPartsFromImport(data)
      return
    }

    const occt = await occtimportjs({
      locateFile: (path, prefix) => (path.endsWith('.wasm') ? `/${path}` : prefix + path)
    })

    let importFunction = null
    if (fileName.endsWith('.step') || fileName.endsWith('.stp')) importFunction = occt.ReadStepFile
    else if (fileName.endsWith('.iges') || fileName.endsWith('.igs')) importFunction = occt.ReadIgesFile
    else if (fileName.endsWith('.brep')) importFunction = occt.ReadBrepFile
    else throw new Error('Desteklenmeyen format. (.step/.stp/.iges/.igs/.brep/.json)')

    const params = {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.08,
      angularDeflection: 0.35
    }

    const importResult = importFunction(new Uint8Array(buffer), params)
    if (!importResult?.success) throw new Error(importResult?.error || 'İçe aktarma başarısız.')

    renderImportedModel(importResult)
    initPartsFromImport(importResult)
  } catch (e) {
    console.error('Model yükleme hatası:', e)
  } finally {
    loading.value = false
  }
}

function initPartsFromImport(importResult) {
  const names = []
  for (const mesh of importResult.meshes || []) {
    const n = (mesh?.name || '').trim()
    if (n && !names.includes(n)) names.push(n)
  }

  if (names.length === 0) {
    // isim yoksa mesh index bazlı adlandır
    for (let i = 0; i < (importResult.meshes || []).length; i++) names.push(`Part #${i + 1}`)
  }

  names.sort((a, b) => a.localeCompare(b))
  parts.value = names.map((name, idx) => ({ id: idx + 1, name, visible: true, isFaulty: false }))
  parts.value.forEach((p) => partNameToId.set(p.name, p.id))

  const preferred = (faultData.value.componentName || '').trim()
  const found = parts.value.find((p) => p.name.toLowerCase() === preferred.toLowerCase())
  faultyPartName.value = found?.name || parts.value[0]?.name || ''
  faultData.value.componentName = faultyPartName.value || faultData.value.componentName

  updateFaultyParts()
}

function updateFaultyParts() {
  parts.value.forEach((p) => (p.isFaulty = isFaultyName(p.name)))
  faultData.value.componentName = faultyPartName.value || faultData.value.componentName

  faultMeshes.clear()
  allMeshes.forEach((mesh) => {
    const mat = mesh.material
    if (!mat || !mat.isMeshStandardMaterial) return

    const faulty = isFaultyName(mesh.userData.partName)
    mesh.userData.isFaulty = faulty

    if (faulty) {
      mat.color.setHex(0xff2d2d)
      mat.emissive.setHex(0xff1b1b)
      mat.emissiveIntensity = 0.85
      faultMeshes.set(mesh.userData.meshIndex, mesh)
    } else {
      mat.color.setHex(0xd6d9e6)
      mat.emissiveIntensity = 0
    }
  })
}

watch(faultyPartName, () => {
  updateFaultyParts()
})

function renderImportedModel(importResult) {
  if (!scene || !camera || !renderer) initThreeDScene()
  if (!modelGroup) return

  clearModel()
  if (!importResult?.meshes?.length) return

  const bbox = new THREE.Box3()
  let firstMesh = true
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

    const partName = (meshData.name || '').trim() || `Part #${meshIndex + 1}`
    const isFaulty = isFaultyName(partName)

    const material = new THREE.MeshStandardMaterial({
      color: isFaulty ? 0xff2d2d : 0xd6d9e6,
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
      wireframe: wireframeMode.value
    })
    if (isFaulty) {
      material.emissive = new THREE.Color(0xff1b1b)
      material.emissiveIntensity = 0.85
    }

    const mesh = new THREE.Mesh(geometry, material)
    const partId = partNameToId.get(partName) ?? null
    mesh.userData = { meshIndex, partName, partId, isFaulty }
    modelGroup.add(mesh)
    allMeshes.set(meshIndex, mesh)
    if (isFaulty) faultMeshes.set(meshIndex, mesh)

    if (firstMesh) {
      bbox.setFromObject(mesh)
      firstMesh = false
    } else {
      bbox.union(new THREE.Box3().setFromObject(mesh))
    }

    meshIndex++
  }

  if (!bbox.isEmpty()) focusToBox(bbox, 4.0)
}

function focusToBox(bbox, distanceMultiplier = 3.8) {
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

  const newPos = new THREE.Vector3(center.x + cameraZ * 0.55, center.y + cameraZ * 0.35, center.z + cameraZ)
  camera.position.copy(newPos)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) return
  const bbox = new THREE.Box3()
  modelGroup.traverse((child) => {
    if (child.isMesh && child.visible) bbox.union(new THREE.Box3().setFromObject(child))
  })
  if (!bbox.isEmpty()) focusToBox(bbox, 4.6)
}

function toggleHighlight() {
  showHighlight.value = !showHighlight.value
}

function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  if (modelGroup) {
    modelGroup.traverse((child) => {
      if (child.isMesh && child.material) child.material.wireframe = wireframeMode.value
    })
  }
}

function highlightPart(partId) {
  highlightedPartId.value = highlightedPartId.value === partId ? null : partId

  if (!modelGroup) return
  modelGroup.traverse((child) => {
    if (!child.isMesh || !child.material?.isMeshStandardMaterial) return
    const mat = child.material
    if (child.userData.isFaulty) {
      mat.color.setHex(0xff2d2d)
      return
    }
    if (highlightedPartId.value && child.userData.partId === highlightedPartId.value) mat.color.setHex(0x25ff7a)
    else mat.color.setHex(0xd6d9e6)
  })
}

function togglePartVisibility(partId) {
  const part = parts.value.find((p) => p.id === partId)
  if (!part) return
  part.visible = !part.visible
  allMeshes.forEach((mesh) => {
    if (mesh.userData.partId === partId) mesh.visible = part.visible
  })
}

function showOnlyFaulty() {
  isolatedPartId.value = null
  parts.value.forEach((p) => (p.visible = p.isFaulty))
  allMeshes.forEach((mesh) => {
    const part = parts.value.find((p) => p.id === mesh.userData.partId)
    mesh.visible = part ? part.isFaulty : false
  })
}

function showAllParts() {
  isolatedPartId.value = null
  parts.value.forEach((p) => (p.visible = true))
  allMeshes.forEach((mesh) => (mesh.visible = true))
  resetView()
}

function isolatePart(partId) {
  isolatedPartId.value = partId
  parts.value.forEach((p) => (p.visible = p.id === partId))
  allMeshes.forEach((mesh) => (mesh.visible = mesh.userData.partId === partId))
  focusOnPart(partId)
}

function focusOnPart(partId) {
  if (!modelGroup) return
  const bbox = new THREE.Box3()
  let hasAny = false
  modelGroup.traverse((child) => {
    if (child.isMesh && child.visible && child.userData.partId === partId) {
      bbox.union(new THREE.Box3().setFromObject(child))
      hasAny = true
    }
  })
  if (hasAny && !bbox.isEmpty()) focusToBox(bbox, 4.2)
}

function onCanvasPointerDown(event) {
  const canvas = threeCanvas.value
  if (!canvas || !raycaster || !camera || !modelGroup) return
  if (!parts.value.length) return

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

  const hit = hits[0].object
  let partId = hit.userData?.partId

  // Eğer partId henüz set edilmemişse, partName üzerinden bulmayı dene
  if (!partId && hit.userData?.partName) partId = partNameToId.get(hit.userData.partName) ?? null
  if (!partId) return

  if (isolatedPartId.value === partId) showAllParts()
  else isolatePart(partId)
}

onMounted(() => {
  initThreeDScene()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', onWindowResize)
  const canvas = threeCanvas.value
  if (canvas) canvas.removeEventListener('pointerdown', onCanvasPointerDown)
  if (renderer) renderer.dispose()
  if (controls) controls.dispose()
})
</script>

<style scoped>
.step-viewer {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.viewer-header {
  text-align: center;
  margin-bottom: 30px;
}

.viewer-header h2 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.fault-info-panel {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 25px;
  border-radius: 15px;
  margin-bottom: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.fault-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.fault-severity {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.9em;
}

.fault-severity.high {
  background: #e74c3c;
  color: white;
}

.fault-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
}

.fault-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  opacity: 0.95;
  word-break: break-all;
}

.faulty-part-select {
  display: inline-flex;
  justify-content: flex-end;
  width: 100%;
}

.select {
  width: min(520px, 100%);
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.25);
  color: white;
  outline: none;
}

.viewer-container {
  background: white;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.viewer-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.control-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #3498db;
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-2px);
}

.control-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.control-btn.danger {
  background: #e74c3c;
}

.control-btn.danger:hover {
  background: #c0392b;
}

.upload-btn {
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

.upload-btn:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.file-input {
  display: none;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 600px;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(1200px 600px at 50% 60%, rgba(106, 166, 255, 0.25), rgba(0, 0, 0, 0));
}

.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-spinner {
  font-size: 2em;
  margin-bottom: 10px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.component-list {
  background: white;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.component-list h3 {
  color: #2c3e50;
  margin-bottom: 12px;
  text-align: center;
}

.hint {
  margin: 0 0 18px 0;
  text-align: center;
  color: #6b7280;
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.component-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  background: #ffffff;
}

.component-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.component-item.faulty {
  background: #ffeaea;
  border-color: #e74c3c;
}

.component-item.highlighted {
  background: #e8f4fd;
  border-color: #3498db;
}

.component-item.hidden {
  opacity: 0.55;
  background: #f8f9fa;
  border-color: #dee2e6;
}

.component-icon {
  font-size: 2em;
  margin-right: 15px;
}

.component-info {
  flex: 1;
}

.component-controls {
  display: flex;
  align-items: center;
  margin-left: 10px;
}

.visibility-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.visibility-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  transform: scale(1.1);
}

.component-name {
  font-weight: 650;
  color: #2c3e50;
  margin-bottom: 5px;
}

.component-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 700;
  text-transform: uppercase;
}

.component-status.good {
  background: #d4edda;
  color: #155724;
}

.component-status.faulty {
  background: #f8d7da;
  color: #721c24;
}

@media (max-width: 768px) {
  .step-viewer {
    padding: 15px;
  }
  .fault-details {
    grid-template-columns: 1fr;
  }
  .viewer-controls {
    justify-content: center;
  }
  .component-grid {
    grid-template-columns: 1fr;
  }
}
</style>
