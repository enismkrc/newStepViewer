<template>
  <div class="hms-dashboard">
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">Aircraft Health Management</h1>
        <p class="hero-subtitle">Select an aircraft by Tail Number to inspect model and faults</p>
      </div>
    </section>

    <section class="aircraft-section">
      <h2 class="section-title">Aircraft by Tail Number</h2>
      <div class="aircraft-grid">
        <button
          v-for="ac in aircraftSortedByTailNumber"
          :key="ac.id"
          type="button"
          class="aircraft-card"
          :class="{ selected: selectedAircraftId === ac.id }"
          @click="selectedAircraftId = ac.id"
        >
          <span class="aircraft-tail">{{ ac.tailNumber }}</span>
          <span class="aircraft-name">{{ ac.displayName }}</span>
          <span v-if="ac.hasFault" class="aircraft-fault-tag" title="Fault recorded">Fault</span>
          <span v-else class="aircraft-ok-tag">OK</span>
        </button>
      </div>
    </section>

    <section v-if="selectedAircraft" class="viewer-section">
      <div class="viewer-header">
        <span class="viewer-label">Model view — {{ selectedAircraft.tailNumber }}</span>
        <button
          type="button"
          class="viewer-clear-btn"
          @click="selectedAircraftId = null"
        >
          Change aircraft
        </button>
      </div>
      <HmsViewer
        :key="selectedAircraftId"
        :model-url="selectedAircraft.modelUrl"
        :faulty-part="selectedAircraft.faultyPart"
        :fault-type="selectedAircraft.faultType"
        :detail-model-url="selectedAircraft.detailModelUrl"
        :detail-faulty-part="selectedAircraft.detailFaultyPart"
      />
    </section>

    <div v-else class="viewer-placeholder">
      <div class="placeholder-icon" aria-hidden="true">✈</div>
      <p class="placeholder-text">Select an aircraft above to view 3D model and health data</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { aircraftList } from '../data/aircraft'
import HmsViewer from '../components/HmsViewer.vue'

const selectedAircraftId = ref(null)

const aircraftSortedByTailNumber = computed(() =>
  [...aircraftList].sort((a, b) => (a.tailNumber || '').localeCompare(b.tailNumber || '', undefined, { numeric: true }))
)

const selectedAircraft = computed(() =>
  aircraftList.find((ac) => ac.id === selectedAircraftId.value) ?? null
)
</script>

<style scoped>
.hms-dashboard {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  min-height: 100%;
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
  padding: 32px 24px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
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
  border-color: #94a3b8;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.aircraft-card.selected {
  border-color: #1e40af;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  box-shadow: 0 4px 16px rgba(30, 64, 175, 0.2);
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

.viewer-section {
  flex: 1;
  min-height: 0;
  padding: 0 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.viewer-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #334155;
}

.viewer-clear-btn {
  padding: 8px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.viewer-clear-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.viewer-placeholder {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
  border-radius: 14px;
  margin: 0 24px 24px;
  border: 2px dashed #cbd5e1;
}

.placeholder-icon {
  font-size: 3rem;
  opacity: 0.5;
  line-height: 1;
}

.placeholder-text {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
}
</style>
