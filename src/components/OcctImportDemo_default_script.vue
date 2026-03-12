<template>
  <div class="occt-import-demo">
    <h1>OCCT Import JS Demo</h1>
    <p>.step, .iges, .brep veya .json dosyası yükleyerek JSON yapısını ve 3D görselleştirmesini görün.</p>

    <div class="input-section">
      <input type="file" @change="handleFileUpload" accept=".step,.stp,.iges,.brep,.json" />
      <div class="button-group">
        <button @click="processFile" :disabled="!selectedFile || loading">
          {{ loading ? 'İşleniyor...' : 'Dosyayı İşle' }}
        </button>
        <button @click="downloadJSON" :disabled="!result || !result.success" class="download-btn">
          JSON İndir
        </button>
      </div>
    </div>

    <div v-if="loading" class="status-message">Yükleniyor ve işleniyor... Lütfen bekleyin.</div>
    <div v-if="error" class="error-message">
      <h2>Hata:</h2>
      <p>{{ error }}</p>
    </div>

    <div class="viewer-section" v-if="result && result.success">
      <h2>3D Görüntüleyici</h2>
      <canvas ref="threeCanvas" class="three-canvas"></canvas>
      <div v-if="result.success" class="success-message">
        <p>İçe aktarma başarılı! Yukarıdaki 3D model ile etkileşim kurabilirsiniz.</p>
      </div>
    </div>

    <div v-if="result" class="result-display">
      <h2>İçe Aktarma Sonucu (JSON):</h2>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<script>
import occtimportjs from 'occt-import-js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default {
  name: 'OcctImportDemo',
  data() {
    return {
      selectedFile: null,
      fileContent: null, // Dosya içeriğini Uint8Array olarak sakla
      loading: false,
      result: null,
      error: null,
      // ÖNEMLİ: Three.js ile ilgili özellikler (scene, camera, renderer, controls, modelGroup)
      // Vue'nun reaktif işleminden kaçınmak için data()'dan kaldırıldı.
      // Bunlar initThreeDScene() içinde doğrudan this özellikleri olarak başlatılacak.
      animationFrameId: null, // Bu data()'da kalıyor çünkü Vue yaşam döngüsü ile ilgili.
    };
  },
  mounted() {
    // Bileşen yüklendikten sonra Three.js sahnesini başlat.
    // $nextTick canvas elementinin başlatma sırasında render edildiğinden emin olur.
    this.$nextTick(() => {
      this.initThreeDScene();
    });
    // Pencere boyutu değişikliklerini dinle, Three.js renderer'ını ayarla.
    window.addEventListener('resize', this.onWindowResize);
  },
  beforeUnmount() {
    // Bileşen yok edilmeden önce Three.js kaynaklarını temizle, bellek sızıntısını önle.
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null; // Referansı temizle
    }
    if (this.renderer) {
      this.renderer.dispose(); // GPU kaynaklarını serbest bırak
      this.renderer.domElement = null; // Canvas referansını kaldır
      this.renderer = null; // Referansı temizle
    }
    if (this.controls) {
      this.controls.dispose(); // Kontrolcü kaynaklarını serbest bırak
      this.controls = null; // Referansı temizle
    }
    if (this.scene) {
      // Sahnedeki tüm nesneleri dolaş, geometri ve materyallerini yok et.
      this.scene.traverse((object) => {
        if (object.isMesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      this.scene = null; // Referansı temizle
    }
    if (this.camera) {
        this.camera = null; // Referansı temizle
    }
    if (this.modelGroup) {
        this.modelGroup = null; // Referansı temizle
    }
    // Pencere boyutu değişikliği dinleyicisini kaldır.
    window.removeEventListener('resize', this.onWindowResize);
  },
  methods: {
    /**
     * Dosya giriş değişiklik olayını işle, seçilen dosya içeriğini Uint8Array olarak oku.
     * @param {Event} event Dosya giriş değişiklik olayı.
     */
    handleFileUpload(event) {
      this.selectedFile = event.target.files[0];
      this.result = null; // Önceki içe aktarma sonucunu temizle
      this.error = null;   // Önceki hata mesajını temizle
      this.fileContent = null; // Önceki dosya içeriğini temizle
      this.clearModel(); // Görüntülenen herhangi bir modeli temizle

      if (this.selectedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.fileContent = new Uint8Array(e.target.result);
        };
        reader.onerror = (e) => {
          this.error = 'Dosya okuma hatası: ' + e.target.error;
          this.fileContent = null;
        };
        reader.readAsArrayBuffer(this.selectedFile);
      }
    },

    /**
     * occt-import-js kullanarak yüklenen dosyayı işle.
     */
    async processFile() {
      if (!this.fileContent) {
        this.error = 'Dosya seçilmedi veya dosya içeriği yüklenmedi.';
        return;
      }

      this.loading = true;
      this.result = null;
      this.error = null;
      this.clearModel(); // Yeni dosya içe aktarmadan önce mevcut modeli temizle

      try {
        const fileName = this.selectedFile.name.toLowerCase();
        
        // JSON dosyası kontrolü
        if (fileName.endsWith('.json')) {
          await this.processJSONFile();
          return;
        }

        // OCCT dosyaları için normal işlem
        // Emscripten modülünü başlat.
        // .wasm dosyasının konumunu belirtmek gerekir. occt-import-js.wasm dosyasının public klasöründe olduğunu varsayıyoruz.
        const occt = await occtimportjs({
          locateFile: (path, prefix) => {
            if (path.endsWith('.wasm')) {
              return `/${path}`; // .wasm dosyasının sunucu kök dizininde olduğunu varsay
            }
            return prefix + path; // Diğer dosya yolları için geri dönüş
          }
        });

        let importFunction;

        // Dosya uzantısına göre doğru içe aktarma fonksiyonunu belirle.
        if (fileName.endsWith('.step') || fileName.endsWith('.stp')) {
          importFunction = occt.ReadStepFile;
        } else if (fileName.endsWith('.iges') || fileName.endsWith('.igs')) {
          importFunction = occt.ReadIgesFile;
        } else if (fileName.endsWith('.brep')) {
          importFunction = occt.ReadBrepFile;
        } else {
          this.error = 'Unsupported file type. Please select .step, .iges, .brep, or .json.';
          this.loading = false;
          return;
        }

        // Örnek triangülasyon parametreleri. Varsayılan değerleri kullanmak için null olarak ayarlanabilir.
        const params = {
          linearUnit: 'millimeter', // Çıktı doğrusal birimi
          linearDeflectionType: 'bounding_box_ratio', // Doğrusal sapma türü (sınırlayıcı kutuya göre oran)
          linearDeflection: 0.1, // Doğrusal sapma değeri (sınırlayıcı kutunun %10'u)
          angularDeflection: 0.5 // Açısal sapma (radyan, yaklaşık 28.6 derece)
        };

        console.log('Starting file import...');
        const importResult = importFunction(this.fileContent, params);
        console.log('Import result:', importResult);

        this.result = importResult;
        if (!importResult.success) {
          this.error = 'Import failed: ' + (importResult.error || 'Unknown error occurred during import.');
        } else {
          // İçe aktarma başarılı olduktan sonra, modeli Three.js'de render et.
          this.$nextTick(() => { // Canvas'ın render edildiğinden emin ol, sonra 3D görünümü güncelle
            this.renderModel(this.result);
          });
        }
      } catch (e) {
        this.error = 'Error during file processing: ' + e.message;
        console.error('File Processing Error:', e);
      } finally {
        this.loading = false;
      }
    },

    /**
     * JSON dosyasını işle
     */
    async processJSONFile() {
      try {
        // JSON dosyasını text olarak oku
        const text = new TextDecoder().decode(this.fileContent);
        const jsonData = JSON.parse(text);
        
        // JSON yapısını kontrol et
        if (!jsonData || typeof jsonData !== 'object') {
          throw new Error('Invalid JSON format');
        }
        
        // Meshes kontrolü
        if (!jsonData.meshes || !Array.isArray(jsonData.meshes)) {
          throw new Error('JSON file does not contain valid mesh data');
        }
        
        // Success flag'ini kontrol et veya ekle
        if (jsonData.success === undefined) {
          jsonData.success = true;
        }
        
        this.result = jsonData;
        
        if (!jsonData.success) {
          this.error = 'JSON file indicates failure: ' + (jsonData.error || 'Unknown error.');
        } else {
          // JSON işleme başarılı, Three.js'de render et
          this.$nextTick(() => {
            this.renderModel(this.result);
          });
        }
      } catch (e) {
        this.error = 'Error processing JSON file: ' + e.message;
        console.error('JSON processing error:', e);
      }
    },

    /**
     * Three.js sahnesini, kamerayı, renderer'ı ve kontrolleri başlat.
     * Bu yöntem bileşen yüklendiğinde bir kez çağrılır.
     */
    initThreeDScene() {
      const canvas = this.$refs.threeCanvas;
      if (!canvas) {
        // Canvas elementi mounted sırasında hemen kullanılabilir değilse (örneğin v-if nedeniyle),
        // renderModel $nextTick tarafından çağrıldığında tekrar başlatma denenecek.
        return;
      }

      // ÖNEMLİ: Three.js ile ilgili nesneler artık doğrudan 'this' özellikleri olarak başlatılıyor.
      // Vue bunları reaktif nesnelere dönüştürmeye çalışmayacak, bu 'modelViewMatrix' hatasını çözüyor.
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff); // Beyaz arka plan

      this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
      this.camera.position.set(5, 5, 5); // Başlangıç kamera konumu

      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio); // Yüksek DPI ekranları işle
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

      // Işıklandırma
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Daha parlak beyaz ışık
      this.scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(1, 1, 1).normalize(); // Sağ üst önden gelen ışık
      this.scene.add(directionalLight);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true; // Sönümleme etkisini etkinleştir, pürüzsüz hareket sağla
      this.controls.dampingFactor = 0.25;
      this.controls.screenSpacePanning = false; // Ekran alanı kaydırmayı yasakla
      this.controls.minDistance = 1; // Minimum yakınlaştırma mesafesi
      this.controls.maxDistance = 500; // Maksimum uzaklaştırma mesafesi

      // Model grubu: Tüm içe aktarılan mesh'ler bu gruba eklenecek, yönetim ve temizlik için kolaylık sağlar.
      this.modelGroup = new THREE.Group();
      this.scene.add(this.modelGroup);

      // Animasyon döngüsünü başlat.
      this.animate();
    },

    /**
     * Pencere boyutu değişiklik olayını işle, renderer ve kamerayı ayarla.
     */
    onWindowResize() {
      const canvas = this.$refs.threeCanvas;
      if (canvas && this.camera && this.renderer) {
        // Üst elementin genişliğini al, canvas'ı duyarlı yap.
        const parent = canvas.parentElement;
        const width = parent.clientWidth;
        // En-boy oranını koru veya maksimum yükseklik ayarla.
        const height = Math.min(width * 0.75, 500); // Maksimum yükseklik 500px olarak ayarla

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix(); // Kamera projeksiyon matrisini güncelle
        this.renderer.setSize(width, height);
      }
    },

    /**
     * Three.js animasyon döngüsü.
     */
    animate() {
      this.animationFrameId = requestAnimationFrame(this.animate); // Sonraki animasyon karesini iste
      if (this.controls) this.controls.update(); // Kontrolcüyü güncelle (sönümleme etkinse gerekli)
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera); // Sahneyi render et
      }
    },

    /**
     * modelGroup içindeki tüm mevcut mesh'leri temizle.
     * Bellek sızıntısını önlemek için Three.js geometri ve materyallerinin dispose() işlemini doğru şekilde yap.
     */
    clearModel() {
      if (this.modelGroup) {
        // Grubun tüm alt nesnelerini dolaş ve kaldır.
        while (this.modelGroup.children.length > 0) {
          const object = this.modelGroup.children[0];
          this.modelGroup.remove(object); // Gruptan kaldır

          // GPU belleğini serbest bırakmak için geometri ve materyali serbest bırak.
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      }
    },

    /**
     * occt-import-js içe aktarma sonucundaki modeli Three.js sahnesinde render et.
     * @param {Object} importResult occt-import-js'in JSON sonucu.
     */
    renderModel(importResult) {
      // Three.js sahnesinin başlatıldığından emin ol, özellikle canvas henüz kullanılabilir olduğunda.
      if (!this.scene || !this.camera || !this.renderer) {
        this.initThreeDScene();
        if (!this.scene) {
            console.error('Three.js scene still not initialized after attempt. Cannot render model.');
            return;
        }
      }

      this.clearModel(); // Yeni model render etmeden önce her zaman eski modeli temizle.

      if (!importResult || !importResult.meshes || importResult.meshes.length === 0) {
        console.warn('No meshes found in import result to render.');
        this.resetCameraView(); // Mesh yoksa kamera görünümünü sıfırla.
        return;
      }

      const bbox = new THREE.Box3();
      let firstMesh = true;
      let meshIndex = 0;

      importResult.meshes.forEach(meshData => {
        // --- 1. Veri bütünlüğü kontrolü ---
        // Position verisinin mevcut ve geçerli olduğundan emin ol.
        if (!meshData.attributes || !meshData.attributes.position || !meshData.attributes.position.array) {
            console.warn(`Mesh "${meshData.name || 'Unnamed Mesh'}" is missing valid position data. Skipping this mesh.`);
            return; // Mevcut mesh'i atla, bir sonrakini işle.
        }

        // Index verisinin mevcut ve geçerli olduğundan emin ol.
        // Kritik düzeltme: Kütüphane dokümantasyonuna göre, 'index' doğrudan 'meshData' özelliğidir, 'attributes' alt özelliği değil.
        if (!meshData.index || !meshData.index.array) {
            console.warn(`Mesh "${meshData.name || 'Unnamed Mesh'}" is missing valid index data. Skipping this mesh.`);
            return; // Mevcut mesh'i atla, bir sonrakini işle.
        }

        const geometry = new THREE.BufferGeometry();

        // --- 2. Pozisyon verilerini işle ---
        const positions = new Float32Array(meshData.attributes.position.array);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // --- 3. Normal verilerini işle (opsiyonel) ---
        if (meshData.attributes.normal && meshData.attributes.normal.array) {
          const normals = new Float32Array(meshData.attributes.normal.array);
          geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            console.warn(`Mesh "${meshData.name || 'Unnamed Mesh'}" has no normals. Computing them, which might be less efficient.`);
            geometry.computeVertexNormals(); // Normal verisi sağlanmamışsa, Three.js hesaplamayı deneyebilir.
        }

        // --- 4. İndeks verilerini işle ---
        // Vertex sayısı çok büyükse (> 65535 vertex), Uint32Array kullan.
        const indices = new (positions.length / 3 > 65535 ? Uint32Array : Uint16Array)(meshData.index.array);
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // --- 5. Materyal oluştur ---
        let material;
        if (meshData.color && meshData.color.length === 3) {
          const color = new THREE.Color(
            meshData.color[0],
            meshData.color[1],
            meshData.color[2]
          );
          material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
        } else {
          material = new THREE.MeshStandardMaterial({ 
            color: meshIndex % 2 === 0 ? 0x87CEEB : 0xB0B0B0, // Açık mavi ve açık gri alternatif
            side: THREE.DoubleSide 
          });
        }

        // --- 6. Mesh oluştur ve sahneye ekle ---
        const mesh = new THREE.Mesh(geometry, material);
        this.modelGroup.add(mesh); // Model grubuna ekle, yönetim için kolaylık sağlar.

        // --- 7. Genel sınırlayıcı kutuyu güncelle (kamera uyumu için) ---
        if (firstMesh) {
          bbox.setFromObject(mesh);
          firstMesh = false;
        } else {
          bbox.union(new THREE.Box3().setFromObject(mesh));
        }
        
        meshIndex++;
      });

      // --- 8. Kamerayı modele uyarla ---
      if (!bbox.isEmpty()) {
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bbox.getCenter(center);
        bbox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180); // FOV'u dereceden radyana dönüştür
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)); // Gerekli kamera mesafesini hesapla

        // En-boy oranına göre kamera mesafesini ayarla, modelin yatay yönde de tamamen görünmesini sağla.
        cameraZ *= (this.camera.aspect > 1 ? this.camera.aspect : 1);

        this.camera.position.copy(center); // Kamerayı modelin merkezine taşı
        this.camera.position.z += cameraZ;
        this.camera.position.y += cameraZ * 0.5; // Kamerayı biraz yükselt, daha iyi açı elde et

        this.camera.lookAt(center); // Kamerayı modelin merkezine bakacak şekilde ayarla

        if (this.controls) {
            this.controls.target.copy(center); // Kontrolcünün modelin merkezi etrafında yörünge hareketi yapmasını sağla.
            this.controls.update();
        }
      } else {
         // Model boşsa, kamerayı varsayılan konuma sıfırla.
         this.resetCameraView();
      }
    },

    /**
     * Kamerayı varsayılan görüntüleme konumuna sıfırla.
     */
    resetCameraView() {
      if (this.camera) {
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(new THREE.Vector3(0,0,0));
      }
      if (this.controls) {
        this.controls.target.set(0,0,0);
        this.controls.update();
      }
    },

    /**
     * JSON dosyasını indir
     */
    downloadJSON() {
      if (!this.result || !this.result.success) {
        this.error = 'No valid result to download';
        return;
      }

      try {
        // JSON'u formatla
        const jsonString = JSON.stringify(this.result, null, 2);
        
        // Blob oluştur
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Dosya adını oluştur
        const originalFileName = this.selectedFile?.name || 'model';
        const fileName = originalFileName.replace(/\.[^/.]+$/, '') + '_converted.json';
        
        // Download link oluştur
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        
        // Linki tıkla ve temizle
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('JSON file downloaded:', fileName);
      } catch (e) {
        this.error = 'Failed to download JSON: ' + e.message;
        console.error('Download error:', e);
      }
    }
  },
};
</script>

<style scoped>
.occt-import-demo {
  max-width: 900px; /* Slightly wider to accommodate viewer */
  margin: 40px auto;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h1 {
  color: #333;
  margin-bottom: 20px;
}

.input-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px; /* Spacing between input and button */
  margin-bottom: 20px;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

input[type="file"] {
  display: block;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

button {
  background-color: #42b983;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #369c73;
}

.download-btn {
  background-color: #007bff;
}

.download-btn:hover:not(:disabled) {
  background-color: #0056b3;
}

.status-message {
  margin-top: 20px;
  color: #007bff;
  font-style: italic;
}

.error-message {
  margin-top: 20px;
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 10px;
  border-radius: 5px;
}

/* New styles for 3D Viewer */
.viewer-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0; /* Separator line */
}

.viewer-section h2 {
  color: #555;
  margin-bottom: 15px;
}

.three-canvas {
  width: 100%; /* Makes canvas fill its parent's width */
  height: 500px; /* Set a fixed height for the canvas */
  display: block; /* Remove extra space below the canvas */
  background-color: #f0f0f0; /* Matches scene background for consistency */
  border: 1px solid #ddd;
  border-radius: 5px;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.1); /* Subtle shadow for depth */
}


.result-display {
  margin-top: 20px;
  text-align: left;
}

.result-display h2 {
  color: #555;
  margin-bottom: 10px;
}

.result-display pre {
  background-color: #f8f8f8;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
  overflow-x: auto;
  white-space: pre-wrap; /* Ensures long lines wrap */
  word-wrap: break-word; /* Breaks long words */
  max-height: 400px; /* Limit height to prevent excessive scrolling */
}

.success-message {
  margin-top: 10px;
  color: #28a745;
  font-weight: bold;
}
</style>