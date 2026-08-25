<template>
  <div class="hms-viewer-page component-view">
    <div v-if="loading" class="viewer-loading">
      <p>Loading aircraft…</p>
    </div>
    <div v-else-if="!aircraft" class="viewer-error">
      <p>{{ loadError || 'Aircraft not found.' }}</p>
      <router-link :to="{ name: 'Entry' }" custom v-slot="{ navigate }">
        <Button label="Back To Selection" icon="pi pi-arrow-left" severity="secondary" text @click="navigate" />
      </router-link>
    </div>
    <template v-else>
      <div class="viewer-header">
        <span class="viewer-label">
          {{ aircraft.tailNumber }} — {{ flightLabel }} — Model Viewer
        </span>
      </div>
      <div class="viewer-wrap">
        <HmsViewer
          :key="`${aircraft.id}-${flightId}`"
          :model-url="model.modelUrl"
          :view-config="model.viewConfig"
          :faults="faults"
          :mfl-list="mflList"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getAircraftById } from '../api/fleet'
import { findFlightsByAircraftId } from '../api/flight'
import { getFilteredMflData, mflListToFaults, flattenMflForViewer } from '../api/mfl'
import { attachModel } from '../config/modelRegistry'
import HmsViewer from '../components/HmsViewer.vue'
import Button from 'primevue/button'
import type { Aircraft, Fault, NormalizedMflRecord } from '@/types/api-types'
import type { ViewConfigPartial } from '@/types/view-types'

const route = useRoute()

const aircraft = ref<Aircraft | null>(null)
const mflList = ref<NormalizedMflRecord[]>([])
const faults = ref<Fault[]>([])
const flightLabel = ref('')
const loading = ref(true)
const loadError = ref('')

const flightId = computed(() => String(route.params.flightId ?? ''))

/** modelUrl/viewConfig attachModel ile loadViewerData içinde zenginleştirilir. */
const model = computed<{ modelUrl: string; viewConfig: ViewConfigPartial | null }>(() => {
  const ac = aircraft.value
  if (!ac) return { modelUrl: '', viewConfig: null }
  return { modelUrl: ac.modelUrl || '', viewConfig: ac.viewConfig ?? null }
})

async function loadViewerData(aircraftId: string, fId: string) {
  loading.value = true
  loadError.value = ''
  mflList.value = []
  faults.value = []
  flightLabel.value = ''
  try {
    // Ana projede fleet.js kullanılmıyorsa giriş ekranı uçağı router state ile geçirir.
    const fromState = history.state?.aircraft as Aircraft | undefined
    const stateAircraft: Aircraft | null =
      fromState && String(fromState.id) === String(aircraftId) ? fromState : null

    const [acRaw, flightRows, mflRaw] = await Promise.all([
      stateAircraft ? Promise.resolve(stateAircraft) : getAircraftById(aircraftId),
      findFlightsByAircraftId(aircraftId),
      getFilteredMflData(fId)
    ])
    const ac = attachModel(acRaw)
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
  () => [String(route.params.aircraftId ?? ''), String(route.params.flightId ?? '')],
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
  color: #ef4444;
}

.viewer-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 0 4px;
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
