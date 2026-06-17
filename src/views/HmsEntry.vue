<template>
  <div class="hms-entry hms-app">
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">Aircraft Health Management</h1>
        <p class="hero-subtitle">Select base → fleet → aircraft → flight to open the model viewer.</p>
      </div>
    </section>

    <section class="picker-section">
      <div class="picker-head">
        <h2 class="section-title">Selection</h2>
        <button v-if="canReset" type="button" class="reset-btn" @click="resetAll">Reset</button>
      </div>

      <div v-if="loadingFleets" class="data-status">Loading fleets…</div>
      <div v-else-if="loadError" class="data-status data-status-error">{{ loadError }}</div>

      <div class="steps">
        <!-- 1) BASE -->
        <div class="step">
          <label class="step-label" for="baseSelect">Base</label>
          <div class="select-wrap">
            <select
              id="baseSelect"
              class="select"
              :disabled="loadingFleets || !bases.length"
              :value="selectedBase"
              @change="onBaseChange"
            >
              <option value="" disabled>Select a base…</option>
              <option v-for="b in bases" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>
        </div>

        <!-- 2) FLEET -->
        <div class="step" :class="{ disabled: !selectedBase }">
          <label class="step-label" for="fleetSelect">Fleet</label>
          <div class="select-wrap">
            <select
              id="fleetSelect"
              class="select"
              :disabled="!selectedBase"
              :value="selectedFleetId"
              @change="onFleetChange"
            >
              <option value="" disabled>{{ selectedBase ? 'Select a fleet…' : 'Select a base first' }}</option>
              <option v-for="f in fleets" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
        </div>

        <!-- 3) AIRCRAFT -->
        <div class="step" :class="{ disabled: !selectedFleetId }">
          <label class="step-label" for="aircraftSelect">Aircraft</label>
          <div class="select-wrap">
            <select
              id="aircraftSelect"
              class="select"
              :disabled="!selectedFleetId || loadingAircraft"
              :value="selectedAircraftId"
              @change="onAircraftChange"
            >
              <option value="" disabled>{{ aircraftPlaceholder }}</option>
              <option v-for="ac in aircraftList" :key="ac.id" :value="ac.id">
                {{ ac.tailNumber }} — {{ ac.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- 4) FLIGHT -->
        <div class="step" :class="{ disabled: !selectedAircraftId }">
          <label class="step-label" for="flightSelect">Flight</label>
          <div class="select-wrap">
            <select
              id="flightSelect"
              class="select"
              :disabled="!selectedAircraftId || loadingFlights"
              :value="selectedFlightId"
              @change="onFlightChange"
            >
              <option value="" disabled>{{ flightPlaceholder }}</option>
              <option v-for="fl in flights" :key="fl.id" :value="fl.id">{{ fl.flightNo }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="open-bar">
        <button type="button" class="open-btn" :disabled="!canOpen" @click="goToView">
          Open model viewer
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { findAllFleets, findAircraftByFleetId } from '../api/fleet'
import { findFlightsByAircraftId } from '../api/flight'
import { attachModel } from '../config/modelRegistry'
import '../styles/hms-theme.css'

const router = useRouter()

// Tüm filolar tek seferde alınır; base ve fleet listeleri bundan TÜRETİLİR.
const allFleets = ref([])
const aircraftList = ref([])
const flights = ref([])

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
  const set = new Set()
  for (const f of allFleets.value) {
    const b = (f.base ?? '').trim()
    if (b) set.add(b)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

// Seçili base'e ait filolar.
const fleets = computed(() => {
  if (!selectedBase.value) return []
  return allFleets.value.filter((f) => (f.base ?? '') === selectedBase.value)
})

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

function onBaseChange(e) {
  selectedBase.value = e.target.value
  // Alt seçimleri sıfırla.
  selectedFleetId.value = ''
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  aircraftList.value = []
  flights.value = []
}

async function onFleetChange(e) {
  selectedFleetId.value = e.target.value
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

async function onAircraftChange(e) {
  selectedAircraftId.value = e.target.value
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

function onFlightChange(e) {
  selectedFlightId.value = e.target.value
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
    state: { aircraft: attachModel(ac) }
  })
}
</script>

<style scoped>
.hms-entry {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
}

.hero {
  position: relative;
  padding: 48px 24px 40px;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--hero-1) 0%, var(--hero-2) 45%, var(--hero-3) 100%);
}

.hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 50% at 50% 0%, var(--hero-glow), transparent 60%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}

.hero-title {
  margin: 0 0 12px;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 800;
  color: #f8fafc;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.hero-subtitle {
  margin: 0;
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 500;
}

.picker-section {
  padding: 28px 24px 48px;
  background: var(--bg);
  border-top: 1px solid var(--border);
  flex: 1;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto 14px;
}

.reset-btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--panel-3);
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 700;
}

.reset-btn:hover {
  background: var(--border-strong);
  color: var(--text-strong);
}

/* Dikey (alt alta) adımlar */
.steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 720px;
  margin: 0 auto;
}

.step {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 14px 12px;
}

.step.disabled {
  opacity: 0.55;
}

.step-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-subtle);
  margin-bottom: 10px;
  display: block;
}

.select-wrap {
  position: relative;
}

.select {
  width: 100%;
  padding: 12px 42px 12px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--input-bg);
  color: var(--text);
  font-weight: 700;
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'%3E%3Cpath fill='%2394a3b8' d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
}

.select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.select:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  background-color: var(--panel-2);
}

.select option {
  background: var(--input-bg);
  color: var(--text);
}

.data-status {
  max-width: 720px;
  margin: 0 auto 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 700;
  text-align: center;
  border: 1px solid var(--accent-ring);
}

.data-status-error {
  background: var(--danger-soft);
  color: var(--danger-text);
  border-color: var(--danger-border);
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.open-bar {
  max-width: 720px;
  margin: 20px auto 0;
  text-align: center;
}

.open-btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: background 0.15s;
}

.open-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.open-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
