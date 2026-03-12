<template>
  <div class="hms-entry">
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">Aircraft Health Management</h1>
        <p class="hero-subtitle">Select in order: Country → City → Fleet → Aircraft.</p>
      </div>
    </section>

    <section class="picker-section">
      <div class="picker-head">
        <h2 class="section-title">Selection</h2>
        <button v-if="canReset" type="button" class="reset-btn" @click="resetAll">Reset</button>
      </div>

      <div class="steps">
        <div class="step">
          <label class="step-label" for="countrySelect">Country</label>
          <div class="select-wrap">
            <select id="countrySelect" class="select" :value="selectedCountry" @change="onCountryChange">
              <option value="" disabled>Select a country…</option>
              <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="step" :class="{ disabled: !selectedCountry }">
          <label class="step-label" for="citySelect">City</label>
          <div class="select-wrap">
            <select
              id="citySelect"
              class="select"
              :disabled="!selectedCountry"
              :value="selectedCity"
              @change="onCityChange"
            >
              <option value="" disabled>Select a city…</option>
              <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="step" :class="{ disabled: !selectedCity }">
          <label class="step-label" for="fleetSelect">Fleet</label>
          <div class="select-wrap">
            <select
              id="fleetSelect"
              class="select"
              :disabled="!selectedCity"
              :value="selectedFleet"
              @change="onFleetChange"
            >
              <option value="" disabled>Select a fleet…</option>
              <option v-for="f in fleets" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <section class="aircraft-section">
      <h2 class="section-title">Aircraft (Tail Number)</h2>
      <div v-if="!selectedFleet" class="placeholder">
        Choose a fleet to list aircraft.
      </div>
      <div v-else class="aircraft-grid">
        <button
          v-for="ac in filteredAircraftSorted"
          :key="ac.id"
          type="button"
          class="aircraft-card"
          @click="goToView(ac.id)"
        >
          <span class="aircraft-tail">{{ ac.tailNumber }}</span>
          <span class="aircraft-name">{{ ac.displayName }}</span>
          <span v-if="ac.hasFault" class="aircraft-fault-tag" title="Fault recorded">Fault</span>
          <span v-else class="aircraft-ok-tag">OK</span>
          <span class="aircraft-cta">Open viewer →</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { aircraftList } from '../data/aircraft'

const router = useRouter()

const selectedCountry = ref('')
const selectedCity = ref('')
const selectedFleet = ref('')

function goToView(aircraftId) {
  router.push({ name: 'View', params: { aircraftId } })
}

const countries = computed(() => {
  const set = new Set()
  for (const ac of aircraftList) set.add(ac.country || 'Unknown')
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const cities = computed(() => {
  if (!selectedCountry.value) return []
  const set = new Set()
  for (const ac of aircraftList) {
    const country = ac.country || 'Unknown'
    if (country !== selectedCountry.value) continue
    set.add(ac.city || 'Unknown')
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const fleets = computed(() => {
  if (!selectedCountry.value || !selectedCity.value) return []
  const set = new Set()
  for (const ac of aircraftList) {
    const country = ac.country || 'Unknown'
    const city = ac.city || 'Unknown'
    if (country !== selectedCountry.value) continue
    if (city !== selectedCity.value) continue
    set.add(ac.fleet || 'Default Fleet')
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const filteredAircraftSorted = computed(() => {
  if (!selectedCountry.value || !selectedCity.value || !selectedFleet.value) return []
  return aircraftList
    .filter((ac) => (ac.country || 'Unknown') === selectedCountry.value)
    .filter((ac) => (ac.city || 'Unknown') === selectedCity.value)
    .filter((ac) => (ac.fleet || 'Default Fleet') === selectedFleet.value)
    .slice()
    .sort((a, b) => (a.tailNumber || '').localeCompare(b.tailNumber || '', undefined, { numeric: true }))
})

const canReset = computed(() => !!(selectedCountry.value || selectedCity.value || selectedFleet.value))

function resetAll() {
  selectedCountry.value = ''
  selectedCity.value = ''
  selectedFleet.value = ''
}

function selectCountry(country) {
  selectedCountry.value = country
  selectedCity.value = ''
  selectedFleet.value = ''
}

function selectCity(city) {
  selectedCity.value = city
  selectedFleet.value = ''
}

function selectFleet(fleet) {
  selectedFleet.value = fleet
}

function onCountryChange(e) {
  selectCountry(e.target.value)
}

function onCityChange(e) {
  selectCity(e.target.value)
}

function onFleetChange(e) {
  selectFleet(e.target.value)
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
  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 20 20'%3E%3Cpath fill='%2364756b' d='M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z'/%3E%3C/svg%3E\");
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

.aircraft-card:hover {
  border-color: #1e40af;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  box-shadow: 0 4px 16px rgba(30, 64, 175, 0.2);
  transform: translateY(-2px);
}

.aircraft-tail {
  font-size: 1.125rem;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.aircraft-name {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 600;
}

.aircraft-fault-tag {
  margin-top: 4px;
  padding: 4px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 6px;
  align-self: flex-start;
}

.aircraft-ok-tag {
  margin-top: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #15803d;
  align-self: flex-start;
}

.aircraft-cta {
  margin-top: 10px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e40af;
  align-self: flex-start;
}

.aircraft-card:hover .aircraft-cta {
  text-decoration: underline;
}
</style>
