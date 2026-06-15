<template>
  <div class="hms-entry">
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">Aircraft Health Management</h1>
        <p class="hero-subtitle">Select fleet → aircraft → flight to open the model viewer.</p>
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
        <div class="step">
          <label class="step-label" for="fleetSelect">Fleet</label>
          <div class="select-wrap">
            <select
              id="fleetSelect"
              class="select"
              :value="selectedFleetId"
              @change="onFleetChange"
            >
              <option value="" disabled>Select a fleet…</option>
              <option v-for="f in fleets" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
        </div>

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
              <option value="" disabled>{{ loadingFlights ? 'Loading flights…' : 'Select a flight…' }}</option>
              <option v-for="fl in flights" :key="fl.id" :value="fl.id">{{ fl.flightNo }}</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <section class="aircraft-section">
      <h2 class="section-title">Aircraft</h2>
      <div v-if="!selectedFleetId" class="placeholder">Choose a fleet to list aircraft.</div>
      <div v-else-if="loadingAircraft" class="placeholder">Loading aircraft…</div>
      <div v-else-if="!aircraftList.length" class="placeholder">No aircraft in this fleet.</div>
      <div v-else class="aircraft-grid">
        <button
          v-for="ac in aircraftList"
          :key="ac.id"
          type="button"
          class="aircraft-card"
          :class="{ selected: selectedAircraftId === ac.id }"
          @click="selectAircraft(ac.id)"
        >
          <span class="aircraft-tail">{{ ac.tailNumber }}</span>
          <span class="aircraft-name">{{ ac.name }}</span>
          <span v-if="selectedAircraftId === ac.id && selectedFlightId" class="aircraft-cta" @click.stop="goToView">
            Open viewer →
          </span>
          <span v-else-if="selectedAircraftId === ac.id" class="aircraft-hint">Select a flight above</span>
        </button>
      </div>

      <div v-if="selectedAircraftId && selectedFlightId" class="open-bar">
        <button type="button" class="open-btn" @click="goToView">Open model viewer</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, ref, watch, onMounted } from 'vue'
import { findAllFleets, findAircraftByFleetId } from '../api/fleet'
import { findFlightsByAircraftId } from '../api/flight'

const router = useRouter()

const fleets = ref([])
const aircraftList = ref([])
const flights = ref([])

const loadingFleets = ref(true)
const loadingAircraft = ref(false)
const loadingFlights = ref(false)
const loadError = ref('')

const selectedFleetId = ref('')
const selectedAircraftId = ref('')
const selectedFlightId = ref('')

onMounted(async () => {
  try {
    const page = await findAllFleets({ page: 0, size: 50 })
    fleets.value = page.content ?? []
  } catch (err) {
    console.error('Failed to load fleets:', err)
    loadError.value = 'Filo listesi yüklenemedi.'
  } finally {
    loadingFleets.value = false
  }
})

watch(selectedFleetId, async (fleetId) => {
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  flights.value = []
  aircraftList.value = []
  if (!fleetId) return
  loadingAircraft.value = true
  loadError.value = ''
  try {
    aircraftList.value = await findAircraftByFleetId(fleetId)
  } catch (err) {
    console.error('Failed to load aircraft:', err)
    loadError.value = 'Uçak listesi yüklenemedi.'
  } finally {
    loadingAircraft.value = false
  }
})

async function selectAircraft(aircraftId) {
  selectedAircraftId.value = aircraftId
  selectedFlightId.value = ''
  flights.value = []
  if (!aircraftId) return
  loadingFlights.value = true
  try {
    flights.value = await findFlightsByAircraftId(aircraftId)
    if (flights.value.length === 1) selectedFlightId.value = flights.value[0].id
  } catch (err) {
    console.error('Failed to load flights:', err)
    loadError.value = 'Uçuş listesi yüklenemedi.'
  } finally {
    loadingFlights.value = false
  }
}

function goToView() {
  if (!selectedAircraftId.value || !selectedFlightId.value) return
  router.push({
    name: 'View',
    params: {
      aircraftId: selectedAircraftId.value,
      flightId: selectedFlightId.value
    }
  })
}

const canReset = computed(() => !!(selectedFleetId.value || selectedAircraftId.value || selectedFlightId.value))

function resetAll() {
  selectedFleetId.value = ''
  selectedAircraftId.value = ''
  selectedFlightId.value = ''
  aircraftList.value = []
  flights.value = []
}

function onFleetChange(e) {
  selectedFleetId.value = e.target.value
}

function onFlightChange(e) {
  selectedFlightId.value = e.target.value
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
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 35%, #334155 100%);
}

.hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59, 130, 246, 0.15), transparent 60%);
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

.aircraft-section {
  padding: 32px 24px 48px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex: 1;
}

.picker-section {
  padding: 28px 24px 10px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto 14px;
}

.reset-btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-weight: 700;
}

.reset-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  max-width: 900px;
  margin: 0 auto;
}

.step {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 14px 12px;
}

.step.disabled {
  opacity: 0.6;
}

.step-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
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
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-weight: 700;
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'%3E%3Cpath fill='%2364756b' d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
}

.select:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.16);
}

.select:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  background-color: #f8fafc;
}

.data-status {
  max-width: 900px;
  margin: 0 auto 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1e40af;
  font-weight: 700;
  text-align: center;
}

.data-status-error {
  background: #fef2f2;
  color: #b91c1c;
}

.placeholder {
  max-width: 900px;
  margin: 0 auto;
  padding: 18px 16px;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  color: #64748b;
  font-weight: 700;
  background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
  text-align: center;
}

.section-title {
  margin: 0 0 20px;
  font-size: 1rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.aircraft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  max-width: 900px;
  margin: 0 auto;
}

.aircraft-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 18px 16px;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
  font-family: inherit;
}

.aircraft-card.selected {
  border-color: #1e40af;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
}

.aircraft-card:hover {
  border-color: #1e40af;
  box-shadow: 0 4px 16px rgba(30, 64, 175, 0.15);
  transform: translateY(-2px);
}

.aircraft-tail {
  font-size: 1.125rem;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.aircraft-name {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 600;
}

.aircraft-hint {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
}

.aircraft-cta {
  margin-top: 10px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e40af;
}

.open-bar {
  max-width: 900px;
  margin: 20px auto 0;
  text-align: center;
}

.open-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  background: #1e40af;
  color: #fff;
  font-weight: 700;
  font-size: 0.9375rem;
  cursor: pointer;
}

.open-btn:hover {
  background: #1e3a8a;
}
</style>
