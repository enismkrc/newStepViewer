<template>
  <div class="viewer-module">
    <div class="module-header">
      <h1>👁️ Görüntüleyici Modülü</h1>
      <p>JSON model dosyalarını yükleyin ve 3D olarak görselleştirin</p>
    </div>

    <div class="input-section">
      <div class="file-upload-area" :class="{ 'drag-over': isDragOver }" 
           @drop="handleDrop" @dragover="handleDragOver" @dragleave="handleDragLeave"
           @click="triggerFileInput">
        <div class="upload-content">
          <div class="upload-icon">📄</div>
          <p>JSON dosyanızı buraya sürükleyip bırakın</p>
          <p class="upload-subtitle">veya göz atmak için tıklayın</p>
          <input type="file" @change="handleFileUpload" accept=".json" 
                 ref="fileInput" class="file-input" />
        </div>
      </div>
      
      <div v-if="selectedFile" class="file-info">
        <div class="file-details">
          <span class="file-icon">📄</span>
          <div class="file-text">
            <div class="file-name">{{ selectedFile.name }}</div>
            <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
          </div>
          <button @click="clearFile" class="clear-btn">✕</button>
        </div>
      </div>

      <div class="button-group">
        <button @click="loadModel" :disabled="!selectedFile || loading" class="load-btn">
          <span v-if="loading" class="loading-spinner">⏳</span>
          {{ loading ? 'Yükleniyor...' : 'Modeli Yükle' }}
        </button>
        <button @click="resetView" :disabled="!modelLoaded" class="reset-btn">
          🔄 Görünümü Sıfırla
        </button>
        <button @click="toggleWireframe" :disabled="!modelLoaded" class="wireframe-btn">
          {{ wireframeMode ? '🔲 Katı' : '🔳 Tel Kafes' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="status-message">
      <div class="loading-animation">⏳</div>
      <p>Modeliniz yükleniyor...</p>
    </div>

    <div v-if="error" class="error-message">
      <h3>❌ Loading Error</h3>
      <p>{{ error }}</p>
    </div>

    <div v-if="modelLoaded" class="viewer-section">
      <div class="viewer-header">
        <h3>🎯 3D Model Viewer</h3>
        <div class="viewer-controls">
          <div class="control-info">
            <span>🖱️ Left: Rotate</span>
            <span>🖱️ Right: Pan</span>
            <span>🖱️ Scroll: Zoom</span>
          </div>
        </div>
      </div>
      
      <div class="canvas-container">
        <canvas ref="threeCanvas" class="three-canvas"></canvas>
      </div>

      <div class="model-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Meshes:</span>
            <span class="info-value">{{ modelData?.meshes?.length || 0 }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Vertices:</span>
            <span class="info-value">{{ totalVertices }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Triangles:</span>
            <span class="info-value">{{ totalTriangles }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">File Size:</span>
            <span class="info-value">{{ formatFileSize(JSON.stringify(modelData).length) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modelData" class="json-preview">
      <h3>📋 Model Data Preview</h3>
      <div class="preview-container">
        <pre>{{ JSON.stringify(modelData, null, 2).substring(0, 300) }}{{ JSON.stringify(modelData, null, 2).length > 300 ? '...' : '' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const selectedFile = ref(null)
const fileContent = ref(null)
const loading = ref(false)
const modelData = ref(null)
const error = ref(null)
const isDragOver = ref(false)
const fileInput = ref(null)
const threeCanvas = ref(null)
const animationFrameId = ref(null)
const wireframeMode = ref(false)

// Three.js nesneleri
let scene = null
let camera = null
let renderer = null
let controls = null
let modelGroup = null

const modelLoaded = computed(() => modelData.value && modelData.value.success)
const totalVertices = computed(() => {
  if (!modelData.value?.meshes) return 0
  return modelData.value.meshes.reduce((total, mesh) => {
    return total + (mesh.attributes?.position?.array?.length || 0) / 3
  }, 0)
})
const totalTriangles = computed(() => {
  if (!modelData.value?.meshes) return 0
  return modelData.value.meshes.reduce((total, mesh) => {
    return total + (mesh.index?.array?.length || 0) / 3
  }, 0)
})

// Dosya yükleme işlemini başlat
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    processSelectedFile(file)
  }
}

// Sürükle-bırak işlemini işle
function handleDrop(event) {
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer.files
  if (files.length > 0) {
    processSelectedFile(files[0])
  }
}

// Sürükleme işlemi sırasında görsel geri bildirim
function handleDragOver(event) {
  event.preventDefault()
  isDragOver.value = true
}

// Sürükleme işlemi bittiğinde görsel geri bildirimi kaldır
function handleDragLeave(event) {
  event.preventDefault()
  isDragOver.value = false
}

// Seçilen dosyayı işle ve doğrula
function processSelectedFile(file) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    error.value = 'Lütfen geçerli bir JSON dosyası seçin'
    return
  }

  selectedFile.value = file
  modelData.value = null
  error.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    fileContent.value = e.target.result
  }
  reader.onerror = (e) => {
    error.value = 'Dosya okuma hatası: ' + e.target.error
    fileContent.value = null
  }
  reader.readAsText(file)
}

// Seçili dosyayı ve tüm verileri temizle
function clearFile() {
  selectedFile.value = null
  fileContent.value = null
  modelData.value = null
  error.value = null
  clearModel()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// JSON dosyasını yükle ve 3D modeli oluştur
async function loadModel() {
  if (!fileContent.value) {
    error.value = 'Dosya seçilmedi veya dosya içeriği yüklenmedi.'
    return
  }

  loading.value = true
  modelData.value = null
  error.value = null
  clearModel()

  try {
    const jsonData = JSON.parse(fileContent.value)
    
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Geçersiz JSON formatı')
    }
    
    if (!jsonData.meshes || !Array.isArray(jsonData.meshes)) {
      throw new Error('JSON dosyası geçerli mesh verisi içermiyor')
    }
    
    if (jsonData.success === undefined) {
      jsonData.success = true
    }
    
    modelData.value = jsonData
    
    if (!jsonData.success) {
      error.value = 'JSON dosyası hata belirtiyor: ' + (jsonData.error || 'Bilinmeyen hata.')
    } else {
      await nextTick()
      renderModel(jsonData)
    }
  } catch (e) {
    error.value = 'JSON dosyası işleme hatası: ' + e.message
    console.error('JSON işleme hatası:', e)
  } finally {
    loading.value = false
  }
}

// Three.js 3D sahnesini başlat
function initThreeDScene() {
  const canvas = threeCanvas.value
  if (!canvas) return

  // Sahne oluştur ve arka plan rengini ayarla
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  // Perspektif kamera oluştur ve konumlandır
  camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000)
  camera.position.set(5, 5, 5)

  // WebGL renderer oluştur ve ayarla
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)

  // Ortam ışığı ekle (genel aydınlatma)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  // Yönlü ışık ekle (gölgeler için)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(1, 1, 1).normalize()
  scene.add(directionalLight)

  // Orbit kontrolleri (fare ile döndürme, yakınlaştırma)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.25
  controls.screenSpacePanning = false
  controls.minDistance = 1
  controls.maxDistance = 500

  // Model grubu oluştur (tüm modeller buraya eklenecek)
  modelGroup = new THREE.Group()
  scene.add(modelGroup)

  // Animasyon döngüsünü başlat
  animate()
}

// Animasyon döngüsü - sürekli render işlemi
function animate() {
  animationFrameId.value = requestAnimationFrame(animate)
  if (controls) controls.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// Sahnedeki tüm modelleri temizle ve bellek sızıntısını önle
function clearModel() {
  if (modelGroup) {
    while (modelGroup.children.length > 0) {
      const object = modelGroup.children[0]
      modelGroup.remove(object)
      // Geometri ve materyal belleklerini temizle
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose())
        else object.material.dispose()
      }
    }
  }
}

// JSON verisinden 3D modeli oluştur ve sahneye ekle
function renderModel(importResult) {
  if (!scene || !camera || !renderer) {
    initThreeDScene()
    if (!scene) return
  }

  clearModel()

  if (!importResult || !importResult.meshes || importResult.meshes.length === 0) {
    resetCameraView()
    return
  }

  // Modelin sınırlarını hesaplamak için kutu oluştur
  const bbox = new THREE.Box3()
  let firstMesh = true

  // Her mesh için 3D geometri oluştur
  importResult.meshes.forEach(meshData => {
    if (!meshData.attributes?.position?.array || !meshData.index?.array) {
      console.warn(`Geçersiz mesh atlanıyor: ${meshData.name}`)
      return
    }

    // BufferGeometry oluştur
    const geometry = new THREE.BufferGeometry()
    // Pozisyon verilerini ekle (x, y, z koordinatları)
    const positions = new Float32Array(meshData.attributes.position.array)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Normal vektörlerini ekle (yüzey yönü için)
    if (meshData.attributes.normal?.array) {
      const normals = new Float32Array(meshData.attributes.normal.array)
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    } else {
      // Normal vektörleri yoksa hesapla
      geometry.computeVertexNormals()
    }

    // İndeks verilerini ekle (üçgen yüzeyleri tanımlar)
    const indices = new (positions.length / 3 > 65535 ? Uint32Array : Uint16Array)(meshData.index.array)
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))

    // Materyal oluştur - renk varsa kullan, yoksa varsayılan gri
    const material = meshData.color && meshData.color.length === 3
      ? new THREE.MeshStandardMaterial({
          color: new THREE.Color(...meshData.color),
          side: THREE.DoubleSide,
          wireframe: wireframeMode.value
        })
      : new THREE.MeshStandardMaterial({ 
          color: 0xcccccc, 
          side: THREE.DoubleSide,
          wireframe: wireframeMode.value
        })

    // Mesh oluştur ve sahneye ekle
    const mesh = new THREE.Mesh(geometry, material)
    modelGroup.add(mesh)

    if (firstMesh) {
      bbox.setFromObject(mesh)
      firstMesh = false
    } else {
      bbox.union(new THREE.Box3().setFromObject(mesh))
    }
  })

  if (!bbox.isEmpty()) {
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    bbox.getCenter(center)
    bbox.getSize(size)

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= (camera.aspect > 1 ? camera.aspect : 1)
    // Increase distance multiplier significantly to fit model completely in screen
    //cameraZ *= 5.0

    camera.position.copy(center)
    camera.position.z += cameraZ
    camera.position.y += cameraZ * 0.5
    camera.lookAt(center)

    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  } else {
    resetCameraView()
  }
}

function resetCameraView() {
  if (camera) {
    camera.position.set(5, 5, 5)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
  }
  if (controls) {
    controls.target.set(0, 0, 0)
    controls.update()
  }
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) {
    resetCameraView()
    return
  }

  // Modelin bounding box'ını hesapla
  const bbox = new THREE.Box3()
  modelGroup.traverse((child) => {
    if (child.isMesh) {
      bbox.union(new THREE.Box3().setFromObject(child))
    }
  })

  if (!bbox.isEmpty()) {
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    bbox.getCenter(center)
    bbox.getSize(size)

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= (camera.aspect > 1 ? camera.aspect : 1)
    // Modeli ekrana sığdırmak için yeterli mesafe
    cameraZ *= 2.0

    camera.position.copy(center)
    camera.position.z += cameraZ
    camera.position.y += cameraZ * 0.5
    camera.lookAt(center)

    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  } else {
    resetCameraView()
  }
}

function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  if (modelGroup) {
    modelGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = wireframeMode.value
      }
    })
  }
}

function onWindowResize() {
  const canvas = threeCanvas.value
  if (canvas && camera && renderer) {
    const parent = canvas.parentElement
    const width = parent.clientWidth
    const height = Math.min(width * 0.75, 600)

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

onMounted(() => {
  nextTick(() => initThreeDScene())
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  if (animationFrameId.value) cancelAnimationFrame(animationFrameId.value)
  if (renderer) {
    renderer.dispose()
    renderer.domElement = null
    renderer = null
  }
  if (controls) controls.dispose()
  scene?.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose()
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
      else obj.material?.dispose()
    }
  })
  scene = camera = modelGroup = null
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.viewer-module {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.module-header {
  text-align: center;
  margin-bottom: 30px;
}

.module-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 2.5em;
}

.module-header p {
  color: #7f8c8d;
  font-size: 1.1em;
}

.input-section {
  margin-bottom: 30px;
}

.file-upload-area {
  border: 3px dashed #bdc3c7;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8f9fa;
  margin-bottom: 20px;
  position: relative;
}

.file-upload-area:hover,
.file-upload-area.drag-over {
  border-color: #e74c3c;
  background: #fdf2f2;
}

.upload-content {
  pointer-events: none;
}

.file-upload-area {
  position: relative;
}

.upload-icon {
  font-size: 3em;
  margin-bottom: 15px;
}

.upload-content p {
  margin: 5px 0;
  color: #7f8c8d;
}

.upload-subtitle {
  font-size: 0.9em;
  color: #95a5a6;
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.file-info {
  margin-bottom: 20px;
}

.file-details {
  display: flex;
  align-items: center;
  padding: 15px;
  background: #ecf0f1;
  border-radius: 8px;
  border-left: 4px solid #e74c3c;
}

.file-icon {
  font-size: 1.5em;
  margin-right: 15px;
}

.file-text {
  flex: 1;
}

.file-name {
  font-weight: bold;
  color: #2c3e50;
}

.file-size {
  color: #7f8c8d;
  font-size: 0.9em;
}

.clear-btn {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1.2em;
}

.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.load-btn, .reset-btn, .wireframe-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: bold;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.load-btn {
  background: #e74c3c;
  color: white;
}

.load-btn:hover:not(:disabled) {
  background: #c0392b;
  transform: translateY(-2px);
}

.reset-btn {
  background: #f39c12;
  color: white;
}

.reset-btn:hover:not(:disabled) {
  background: #e67e22;
  transform: translateY(-2px);
}

.wireframe-btn {
  background: #9b59b6;
  color: white;
}

.wireframe-btn:hover:not(:disabled) {
  background: #8e44ad;
  transform: translateY(-2px);
}

button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-message {
  text-align: center;
  padding: 30px;
  background: #fef3e2;
  border-radius: 12px;
  border-left: 4px solid #f39c12;
}

.loading-animation {
  font-size: 2em;
  margin-bottom: 15px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.error-message {
  background: #fdf2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.error-message h3 {
  color: #dc2626;
  margin-bottom: 10px;
}

.viewer-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.viewer-header h3 {
  color: #2c3e50;
  margin: 0;
}

.viewer-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.control-info {
  display: flex;
  gap: 15px;
  font-size: 0.9em;
  color: #7f8c8d;
}

.canvas-container {
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.three-canvas {
  width: 100%;
  height: 500px;
  display: block;
  border-radius: 4px;
}

.model-info {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.info-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.info-label {
  display: block;
  color: #6b7280;
  font-size: 0.9em;
  margin-bottom: 5px;
}

.info-value {
  display: block;
  color: #1f2937;
  font-size: 1.3em;
  font-weight: bold;
}

.json-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.json-preview h3 {
  color: #374151;
  margin-bottom: 15px;
}

.preview-container {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  max-height: 200px;
  overflow-y: auto;
}

.preview-container pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

@media (max-width: 768px) {
  .viewer-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .control-info {
    flex-direction: column;
    gap: 5px;
  }
  
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
