<template>
  <div class="convert-module">
    <div class="module-header">
      <h1>🔄 Convert Module</h1>
      <p>Convert STEP, IGES, or BREP files to JSON format</p>
    </div>

    <div class="input-section">
      <div class="file-upload-area" :class="{ 'drag-over': isDragOver }" 
           @drop="handleDrop" @dragover="handleDragOver" @dragleave="handleDragLeave"
           @click="triggerFileInput">
        <div class="upload-content">
          <div class="upload-icon">📁</div>
          <p>Drag & drop your CAD file here</p>
          <p class="upload-subtitle">or click to browse</p>
          <input type="file" @change="handleFileUpload" accept=".step,.stp,.iges,.igs,.brep" 
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
        <button @click="processFile" :disabled="!selectedFile || loading" class="convert-btn">
          <span v-if="loading" class="loading-spinner">⏳</span>
          {{ loading ? 'Converting...' : 'Convert to JSON' }}
        </button>
        <button @click="downloadJSON" :disabled="!result || !result.success" class="download-btn">
          💾 Download JSON
        </button>
      </div>
    </div>

    <div v-if="loading" class="status-message">
      <div class="loading-animation">⏳</div>
      <p>Processing your file... This may take a few moments.</p>
    </div>

    <div v-if="error" class="error-message">
      <h3>❌ Conversion Error</h3>
      <p>{{ error }}</p>
    </div>

    <div v-if="result && result.success" class="success-section">
      <div class="success-header">
        <h3>✅ Conversion Successful!</h3>
        <p>Your file has been converted to JSON format</p>
      </div>
      
      <div class="conversion-stats">
        <div class="stat-item">
          <span class="stat-label">Meshes:</span>
          <span class="stat-value">{{ result.meshes?.length || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">File Size:</span>
          <span class="stat-value">{{ formatFileSize(JSON.stringify(result).length) }}</span>
        </div>
      </div>
    </div>

    <div v-if="result" class="result-preview">
      <h3>📋 JSON Preview</h3>
      <div class="json-preview">
        <pre>{{ JSON.stringify(result, null, 2).substring(0, 500) }}{{ JSON.stringify(result, null, 2).length > 500 ? '...' : '' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import occtimportjs from 'occt-import-js'

const selectedFile = ref(null)
const fileContent = ref(null)
const loading = ref(false)
const result = ref(null)
const error = ref(null)
const isDragOver = ref(false)
const fileInput = ref(null)

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    processSelectedFile(file)
  }
}

function handleDrop(event) {
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer.files
  if (files.length > 0) {
    processSelectedFile(files[0])
  }
}

function handleDragOver(event) {
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(event) {
  event.preventDefault()
  isDragOver.value = false
}

function processSelectedFile(file) {
  // Dosya tipini kontrol et
  const fileName = file.name.toLowerCase()
  const validExtensions = ['.step', '.stp', '.iges', '.igs', '.brep']
  const isValidFile = validExtensions.some(ext => fileName.endsWith(ext))
  
  if (!isValidFile) {
    error.value = 'Please select a valid CAD file (.step, .stp, .iges, .igs, .brep)'
    return
  }

  selectedFile.value = file
  result.value = null
  error.value = null

  const reader = new FileReader()
  reader.onload = (e) => {
    fileContent.value = new Uint8Array(e.target.result)
  }
  reader.onerror = (e) => {
    error.value = 'Failed to read file: ' + e.target.error
    fileContent.value = null
  }
  reader.readAsArrayBuffer(file)
}

function clearFile() {
  selectedFile.value = null
  fileContent.value = null
  result.value = null
  error.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function processFile() {
  if (!fileContent.value) {
    error.value = 'No file selected or file content not loaded.'
    return
  }

  loading.value = true
  result.value = null
  error.value = null

  try {
    const occt = await occtimportjs({
      locateFile: (path, prefix) => path.endsWith('.wasm') ? `/${path}` : prefix + path
    })

    const fileName = selectedFile.value.name.toLowerCase()
    let importFunction = null

    if (fileName.endsWith('.step') || fileName.endsWith('.stp')) {
      importFunction = occt.ReadStepFile
    } else if (fileName.endsWith('.iges') || fileName.endsWith('.igs')) {
      importFunction = occt.ReadIgesFile
    } else if (fileName.endsWith('.brep')) {
      importFunction = occt.ReadBrepFile
    }

    const params = {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.1,
      angularDeflection: 0.5
    }

    const importResult = importFunction(fileContent.value, params)
    result.value = importResult

    if (!importResult.success) {
      error.value = 'Conversion failed: ' + (importResult.error || 'Unknown error.')
    }
  } catch (e) {
    error.value = 'Error during conversion: ' + e.message
    console.error(e)
  } finally {
    loading.value = false
  }
}

function downloadJSON() {
  if (!result.value || !result.value.success) {
    error.value = 'No valid result to download'
    return
  }

  try {
    const jsonString = JSON.stringify(result.value, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    
    const originalFileName = selectedFile.value?.name || 'model'
    const fileName = originalFileName.replace(/\.[^/.]+$/, '') + '_converted.json'
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    console.log('JSON file downloaded:', fileName)
  } catch (e) {
    error.value = 'Failed to download JSON: ' + e.message
    console.error('Download error:', e)
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
</script>

<style scoped>
.convert-module {
  max-width: 800px;
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
}

.file-upload-area:hover,
.file-upload-area.drag-over {
  border-color: #3498db;
  background: #e3f2fd;
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
  border-left: 4px solid #3498db;
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

.convert-btn, .download-btn {
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

.convert-btn {
  background: #27ae60;
  color: white;
}

.convert-btn:hover:not(:disabled) {
  background: #229954;
  transform: translateY(-2px);
}

.download-btn {
  background: #3498db;
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: #2980b9;
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
  background: #e8f4fd;
  border-radius: 12px;
  border-left: 4px solid #3498db;
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

.success-section {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}

.success-header {
  text-align: center;
  margin-bottom: 20px;
}

.success-header h3 {
  color: #16a34a;
  margin-bottom: 10px;
}

.conversion-stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  color: #6b7280;
  font-size: 0.9em;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  color: #1f2937;
  font-size: 1.2em;
  font-weight: bold;
}

.result-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.result-preview h3 {
  color: #374151;
  margin-bottom: 15px;
}

.json-preview {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  max-height: 300px;
  overflow-y: auto;
}

.json-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
