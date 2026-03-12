<template>
  <div class="import-tool">
    <header class="import-header">
      <h1 class="import-title">Model Import & Conversion</h1>
      <p class="import-desc">Upload a STEP, IGES, BREP or JSON file. CAD files are converted to JSON for use in HMS.</p>
    </header>
    <div class="import-content">
      <StepUploadViewer :load-default-model-on-mount="false" />
    </div>
  </div>
</template>

<script setup>
import StepUploadViewer from '../components/StepUploadViewer.vue'
</script>

<style scoped>
.import-tool {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.import-header {
  margin-bottom: 8px;
}

.import-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.import-desc {
  margin: 0;
  font-size: 14px;
  color: #475569;
  line-height: 1.5;
}

.import-content {
  flex: 1;
  min-height: 0;
}
</style>
