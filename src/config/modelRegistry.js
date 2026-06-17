/**
 * MODEL REGISTRY — Uçak → 3D model (GLB/glTF) eşlemesi
 * =====================================================
 *
 * NEDEN VAR?
 * Backend şu an uçak verisinde `modelUrl` (3D model dosyasının yolu) DÖNDÜRMÜYOR.
 * Bu yüzden hangi uçağın hangi modeli kullanacağını burada MANUEL tanımlıyoruz.
 * Backend ileride `modelUrl` döndürmeye başlarsa, backend değeri otomatik olarak
 * buradaki değerin önüne geçer (bkz. `attachModel`), yani bu dosyayı silmeniz
 * gerekmez — fallback olarak kalır.
 *
 * NASIL ÇALIŞIR? (öncelik sırası)
 *   1) Backend zaten `modelUrl` döndürdüyse onu kullan.
 *   2) `byAircraftId` → o uca özel (tail-specific) model varsa onu kullan.
 *   3) `byModel` → uçağın `aircraftModel` alanına göre (örn. "KF-21") eşle.
 *   4) `DEFAULT` → hiçbiri yoksa varsayılan model.
 *
 * YENİ MODEL EKLEMEK İÇİN:
 *   - Model dosyasını `public/models/` altına koyun (örn. public/models/F-16.gltf).
 *   - Aşağıdaki `byModel` içine `'F-16': { modelUrl: '/models/F-16.gltf', viewConfig: {...} }` ekleyin.
 *   - `aircraftModel` değeri backend'den gelen alanla TAM eşleşmeli (büyük/küçük harf dahil).
 *
 * viewConfig (opsiyonel) — her uçak için kamera/model yönü ince ayarı:
 *   { modelRotation: {x,y,z}, cameraOffset: {x,y,z}, zoom: {fullModel,part,assembly}, swapFrontBack }
 *   Varsayılanlar için bkz. src/three/defaultView.js
 */

/** KF-21 için ortak görüntüleme ayarı (burun -Z yönünde olduğu için swapFrontBack=true). */
const KF21_VIEW_CONFIG = {
  modelRotation: { x: 0, y: Math.PI, z: 0 },
  cameraOffset: { x: 0.85, y: 0.65, z: -0.85 },
  swapFrontBack: true
}

export const MODEL_REGISTRY = {
  /**
   * Uçağın `aircraftModel` alanına göre eşleme (en yaygın kullanım).
   * Anahtar = backend'den gelen aircraftModel değeri.
   */
  byModel: {
    'KF-21': {
      modelUrl: '/KF-21.gltf',
      viewConfig: KF21_VIEW_CONFIG
    }
    // 'F-16': { modelUrl: '/models/F-16.gltf', viewConfig: { ... } },
  },

  /**
   * Tek bir uçağa (tail) özel override. `byModel`'in önüne geçer.
   * Anahtar = aircraft.id
   */
  byAircraftId: {
    // 'aircraft-1': { modelUrl: '/KF-21-special.gltf', viewConfig: { ... } }
  },

  /** Eşleşme bulunamazsa kullanılacak varsayılan. */
  DEFAULT: {
    modelUrl: '/KF-21.gltf',
    viewConfig: KF21_VIEW_CONFIG
  }
}

/** Backend alan adları farklı olabilir; registry eşlemesi için tek anahtar üretir. */
function getAircraftModelKey(aircraft) {
  const raw =
    aircraft.aircraftModel ??
    aircraft.model ??
    aircraft.aircraftType ??
    aircraft.type ??
    ''
  return String(raw).trim()
}

/** byModel eşlemesi — büyük/küçük harf farkını tolere eder. */
function lookupByModel(modelKey) {
  if (!modelKey) return undefined
  if (MODEL_REGISTRY.byModel[modelKey]) return MODEL_REGISTRY.byModel[modelKey]
  const lower = modelKey.toLowerCase()
  for (const [key, entry] of Object.entries(MODEL_REGISTRY.byModel)) {
    if (key.toLowerCase() === lower) return entry
  }
  return undefined
}

/**
 * Bir uçak için { modelUrl, viewConfig } çözer.
 * fleet.js kullanılmasa bile viewer/entry bu fonksiyonu (veya attachModel) çağırmalıdır.
 * @param {object|null} aircraft  Backend'den gelen uçak nesnesi (id, aircraftModel, ...)
 * @returns {{ modelUrl: string, viewConfig: object|null }}
 */
export function resolveModel(aircraft) {
  if (!aircraft) return { modelUrl: '', viewConfig: null }
  return (
    MODEL_REGISTRY.byAircraftId[aircraft.id] ??
    lookupByModel(getAircraftModelKey(aircraft)) ??
    MODEL_REGISTRY.DEFAULT
  )
}

/**
 * Uçak nesnesine `modelUrl` ve `viewConfig` ekler (zenginleştirme).
 * Backend bu alanları zaten döndürdüyse onlara dokunmaz (backend > registry).
 * @param {object|null} aircraft
 * @returns {object|null} modelUrl/viewConfig garanti edilmiş yeni nesne
 */
export function attachModel(aircraft) {
  if (!aircraft) return aircraft
  const resolved = resolveModel(aircraft)
  return {
    ...aircraft,
    modelUrl: aircraft.modelUrl ?? resolved.modelUrl,
    viewConfig: aircraft.viewConfig ?? resolved.viewConfig
  }
}
