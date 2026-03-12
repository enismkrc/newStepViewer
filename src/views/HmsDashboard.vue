<template>
  <div class="hms-dashboard">
    <div class="dashboard-toolbar">
      <div class="toolbar-label">Aircraft selection</div>
      <div class="aircraft-select-wrap">
        <select v-model="selectedAircraftId" class="aircraft-select">
          <option
            v-for="ac in aircraftList"
            :key="ac.id"
            :value="ac.id"
          >
            <template v-if="ac.hasFault">! </template>{{ ac.displayName }}<template v-if="ac.hasFault"> — Fault recorded</template>
          </option>
        </select>
        <span v-if="selectedAircraft?.hasFault" class="aircraft-fault-badge" title="This aircraft has a fault recorded">!</span>
      </div>
    </div>
    <div class="viewer-section">
      <HmsViewer
        v-if="selectedAircraft"
        :key="selectedAircraftId"
        :model-url="selectedAircraft.modelUrl"
        :faulty-part="selectedAircraft.faultyPart"
        :fault-type="selectedAircraft.faultType"
        :detail-model-url="selectedAircraft.detailModelUrl"
        :detail-faulty-part="selectedAircraft.detailFaultyPart"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { aircraftList } from '../data/aircraft'
import HmsViewer from '../components/HmsViewer.vue'

const selectedAircraftId = ref(aircraftList[0]?.id ?? null)

const selectedAircraft = computed(() =>
  aircraftList.find((ac) => ac.id === selectedAircraftId.value) ?? null
)
</script>

<style scoped>
.hms-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.aircraft-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.aircraft-select {
  min-width: 240px;
  padding: 10px 36px 10px 14px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}

.aircraft-select:focus {
  outline: none;
  border-color: #1e40af;
  box-shadow: 0 0 0 2px rgba(30, 64, 175, 0.2);
}

.aircraft-fault-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #b91c1c;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}

.viewer-section {
  flex: 1;
  min-height: 0;
}
</style>
