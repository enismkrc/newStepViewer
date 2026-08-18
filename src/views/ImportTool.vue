<template>
  <div class="component-view">
    <div class="page-header">
      <div>
        <h1>GLB Model Preview</h1>
      </div>
    </div>
    <div class="component-container">
      <GlbUploadViewer :view-config="previewViewConfig" />
    </div>
  </div>
</template>

<script setup lang="ts">
import GlbUploadViewer from '../components/GlbUploadViewer.vue'
import { MODEL_REGISTRY } from '../config/modelRegistry'

/** GLB preview — HMS viewer ile aynı model yönü (ViewCube + kamera). */
const previewViewConfig = MODEL_REGISTRY.DEFAULT.viewConfig
</script>
