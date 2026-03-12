<template>
  <div class="hms-viewer-page">
    <div v-if="!aircraft" class="viewer-error">
      <p>Aircraft not found.</p>
      <router-link to="/" class="back-link">← Back to selection</router-link>
    </div>
    <template v-else>
      <div class="viewer-header">
        <router-link to="/" class="back-link">← Select another aircraft</router-link>
        <span class="viewer-label">{{ aircraft.tailNumber }} — Model viewer</span>
      </div>
      <div class="viewer-wrap">
        <HmsViewer
          :key="aircraft.id"
          :model-url="aircraft.modelUrl"
          :faulty-part="aircraft.faultyPart"
          :fault-type="aircraft.faultType"
          :detail-model-url="aircraft.detailModelUrl"
          :detail-faulty-part="aircraft.detailFaultyPart"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { aircraftList } from '../data/aircraft'
import HmsViewer from '../components/HmsViewer.vue'

const route = useRoute()

const aircraft = computed(() => {
  const id = route.params.aircraftId
  return aircraftList.find((ac) => ac.id === id) ?? null
})
</script>

<style scoped>
.hms-viewer-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-height: 0;
}

.viewer-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.back-link {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e40af;
  text-decoration: none;
  padding: 8px 0;
}

.back-link:hover {
  text-decoration: underline;
}

.viewer-label {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #334155;
}

.viewer-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.viewer-error {
  padding: 32px;
  text-align: center;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  color: #b91c1c;
}

.viewer-error .back-link {
  display: inline-block;
  margin-top: 12px;
}
</style>
