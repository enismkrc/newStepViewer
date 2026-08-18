<template>
  <div class="component-view">
    <div class="page-header">
      <div>
        <h1>Aircraft Health Management</h1>
      </div>
      <div class="header-actions">
        <Button
          v-if="canReset"
          label="Reset"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          @click="resetAll"
        />
      </div>
    </div>

    <div class="component-container">
      <div v-if="loadingFleets" class="hms-status">Loading fleets…</div>
      <div v-else-if="loadError" class="hms-status hms-status-error">{{ loadError }}</div>

      <div class="steps">
        <!-- 1) BASE -->
        <div class="step">
          <label class="step-label">Base</label>
          <Select
            :model-value="selectedBase"
            :options="bases"
            placeholder="Select a base…"
            :disabled="loadingFleets || !bases.length"
            fluid
            @change="onBaseChange"
          />
        </div>

        <!-- 2) FLEET -->
        <div class="step" :class="{ disabled: !selectedBase }">
          <label class="step-label">Fleet</label>
          <Select
            :model-value="selectedFleetId"
            :options="fleetOptions"
            option-label="name"
            option-value="id"
            :placeholder="selectedBase ? 'Select a fleet…' : 'Select a base first'"
            :disabled="!selectedBase"
            fluid
            @change="onFleetChange"
          />
        </div>

        <!-- 3) AIRCRAFT -->
        <div class="step" :class="{ disabled: !selectedFleetId }">
          <label class="step-label">Aircraft</label>
          <Select
            :model-value="selectedAircraftId"
            :options="aircraftOptions"
            option-label="label"
            option-value="id"
            :placeholder="aircraftPlaceholder"
            :disabled="!selectedFleetId || loadingAircraft"
            fluid
            @change="onAircraftChange"
          />
        </div>

        <!-- 4) FLIGHT -->
        <div class="step" :class="{ disabled: !selectedAircraftId }">
          <label class="step-label">Flight</label>
          <Select
            :model-value="selectedFlightId"
            :options="flights"
            option-label="flightNo"
            option-value="id"
            :placeholder="flightPlaceholder"
            :disabled="!selectedAircraftId || loadingFlights"
            fluid
            @change="onFlightChange"
          />
        </div>
      </div>

      <div class="open-bar">
        <Button
          label="Open Model Viewer"
          icon="pi pi-box"
          :disabled="!canOpen"
          fluid
          @click="goToView"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { HistoryState } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import Select from 'primevue/select'
import type { SelectChangeEvent } from 'primevue/select'
import Button from 'primevue/button'
import { findAllFleets, findAircraftByFleetId } from '../api/fleet'
import { findFlightsByAircraftId } from '../api/flight'
import { attachModel } from '../config/modelRegistry'
import type { Aircraft, Fleet, Flight } from '@/types/api-types'

const router = useRouter()

// Tüm filolar tek seferde alınır; base ve fleet listeleri bundan TÜRETİLİR.
const allFleets = ref<Fleet[]>([])
const aircraftList = ref<Aircraft[]>([])
const flights = ref<Flight[]>([])

const loadingFleets = ref(true)
const loadingAircraft = ref(false)
const loadingFlights = ref(false)
const loadError = ref('')

const selectedBase = ref('')
const selectedFleetId = ref('')
const selectedAircraftId = ref('')
const selectedFlightId = ref('')

// Fleet response'undaki `base` alanından benzersiz base listesi (alfabetik).
const bases = computed(() => {
  const set = new Set<string>()
  for (const f of allFleets.value) {
    const b = (f.base ?? '').trim()
    if (b) set.add(b)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

// Seçili base'e ait filolar (PrimeVue Select için {id,name} listesi).
const fleetOptions = computed(() => {
  if (!selectedBase.value) return []
  return allFleets.value.filter((f) => (f.base ?? '') === selectedBase.value)
})

// PrimeVue Select tek bir optionLabel string'i ister; "tail — name" birleşik etiket.
const aircraftOptions = computed(() =>
  aircraftList.value.map((a) => ({ ...a, label: `${a.tailNumber} — ${a.name}` }))
)

const aircraftPlaceholder = computed(() => {
  if (!selectedFleetId.value) return 'Select a fleet first'
  if (loadingAircraft.value) return 'Loading aircraft…'
  if (!aircraftList.value.length) return 'No aircraft in this fleet'
  return 'Select an aircraft…'
})

const flightPlaceholder = computed(() => {
  if (!selectedAircraftId.value) return 'Select an aircraft first'
  if (loadingFlights.value) return 'Loading flights…'
  if (!flights.value.length) return 'No flights for this aircraft'
  return 'Select a flight…'
})

onMounted(async () => {
  try {
    const page = await findAllFleets({ page: 0, size: 200 })
    allFleets.value = page.content ?? []
  } catch (err) {
    console.error('Failed to load fleets:', err)
    loadError.value = 'Filo listesi yüklenemedi.'
  } finally {
    loadingFleets.value = false
  }
})

// PrimeVue Select @change payload: { originalEvent, value }
function onBaseChange(e: SelectChangeEvent) {
  selectedBase.value = e.value
  selectedFleetId.value = ''
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  aircraftList.value = []
  flights.value = []
}

async function onFleetChange(e: SelectChangeEvent) {
  selectedFleetId.value = e.value
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  aircraftList.value = []
  flights.value = []
  if (!selectedFleetId.value) return
  loadingAircraft.value = true
  loadError.value = ''
  try {
    aircraftList.value = await findAircraftByFleetId(selectedFleetId.value)
  } catch (err) {
    console.error('Failed to load aircraft:', err)
    loadError.value = 'Uçak listesi yüklenemedi.'
  } finally {
    loadingAircraft.value = false
  }
}

async function onAircraftChange(e: SelectChangeEvent) {
  selectedAircraftId.value = e.value
  selectedFlightId.value = ''
  flights.value = []
  if (!selectedAircraftId.value) return
  loadingFlights.value = true
  try {
    flights.value = await findFlightsByAircraftId(selectedAircraftId.value)
    if (flights.value.length === 1) selectedFlightId.value = flights.value[0].id
  } catch (err) {
    console.error('Failed to load flights:', err)
    loadError.value = 'Uçuş listesi yüklenemedi.'
  } finally {
    loadingFlights.value = false
  }
}

function onFlightChange(e: SelectChangeEvent) {
  selectedFlightId.value = e.value
}

const canOpen = computed(() => !!(selectedAircraftId.value && selectedFlightId.value))
const canReset = computed(() =>
  !!(selectedBase.value || selectedFleetId.value || selectedAircraftId.value || selectedFlightId.value)
)

function resetAll() {
  selectedBase.value = ''
  selectedFleetId.value = ''
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  aircraftList.value = []
  flights.value = []
}

function goToView() {
  if (!canOpen.value) return
  const ac = aircraftList.value.find((a) => a.id === selectedAircraftId.value)
  router.push({
    name: 'View',
    params: {
      aircraftId: selectedAircraftId.value,
      flightId: selectedFlightId.value
    },
    // fleet.js kullanılmasa bile viewer'da modelUrl garanti edilir.
    state: { aircraft: attachModel(ac ?? null) as unknown as HistoryState }
  })
}
</script>

<style scoped>
.hms-status {
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--hover-bg);
  color: var(--text-secondary);
  font-weight: 600;
}

.hms-status-error {
  background: rgba(220, 38, 38, 0.1);
  color: #ef4444;
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.step.disabled {
  opacity: 0.55;
}

.step-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.open-bar {
  margin-top: 20px;
}
</style>
