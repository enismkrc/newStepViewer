<template>
  <div class="hms-viewer-page">
    <div v-if="loading" class="viewer-loading">
      <p>Loading aircraft…</p>
    </div>
    <div v-else-if="!aircraft" class="viewer-error">
      <p>{{ loadError || 'Aircraft not found.' }}</p>
      <router-link to="/" class="back-link">← Back to selection</router-link>
    </div>
    <template v-else>
      <div class="viewer-header">
        <router-link to="/" class="back-link">← Select another aircraft</router-link>
        <span class="viewer-label">
          {{ aircraft.tailNumber }} — {{ flightLabel }} — Model viewer
        </span>
      </div>
      <div class="viewer-wrap">
        <HmsViewer
          :key="`${aircraft.id}-${flightId}`"
          :model-url="model.modelUrl"
          :view-config="model.viewConfig"
          :faults="faults"
          :mfl-list="mflList"
          :lru-list="[]"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getAircraftById } from '../api/fleet'
import { findFlightsByAircraftId } from '../api/flight'
import { getFilteredMflData, mflListToFaults, flattenMflForViewer } from '../api/mfl'
import { resolveModel } from '../config/modelRegistry'
import HmsViewer from '../components/HmsViewer.vue'

const route = useRoute()

const aircraft = ref(null)
const mflList = ref([])
const faults = ref([])
const flightLabel = ref('')
const loading = ref(true)
const loadError = ref('')

const flightId = computed(() => route.params.flightId)

/**
 * MANUEL MODEL: Model URL'i backend'den BEKLEMEYİZ. src/config/modelRegistry.js
 * üzerinden uçağın aircraftModel/id değerine göre çözülür. (Backend ileride modelUrl
 * döndürürse o önceliklidir.)
 */
const model = computed(() => {
  const ac = aircraft.value
  if (!ac) return { modelUrl: '', viewConfig: null }
  const resolved = resolveModel(ac)
  return {
    modelUrl: ac.modelUrl || resolved.modelUrl,
    viewConfig: ac.viewConfig || resolved.viewConfig
  }
})

async function loadViewerData(aircraftId, fId) {
  loading.value = true
  loadError.value = ''
  mflList.value = []
  faults.value = []
  flightLabel.value = ''
  try {
    const [ac, flightRows, mflRaw] = await Promise.all([
      getAircraftById(aircraftId),
      findFlightsByAircraftId(aircraftId),
      getFilteredMflData(fId)
    ])
    aircraft.value = ac
    if (!ac) {
      loadError.value = 'Uçak bulunamadı.'
      return
    }
    const flight = flightRows.find((f) => f.id === fId)
    flightLabel.value = flight?.flightNo ?? fId
    mflList.value = flattenMflForViewer(mflRaw)
    faults.value = mflListToFaults(mflRaw)
  } catch (err) {
    console.error('Failed to load viewer data:', err)
    loadError.value = 'Uçuş / MFL verisi yüklenemedi.'
    aircraft.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [route.params.aircraftId, route.params.flightId],
  ([aircraftId, fId]) => {
    if (aircraftId && fId) loadViewerData(aircraftId, fId)
  },
  { immediate: true }
)
</script>

<style scoped>
.hms-viewer-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.viewer-loading,
.viewer-error {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
}

.viewer-error {
  color: var(--danger-text);
}

.viewer-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 0 4px;
}

.back-link {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--accent-text);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.viewer-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-muted);
}

.viewer-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
