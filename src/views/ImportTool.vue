<template>
  <div class="component-view">
    <div class="page-header">
      <div>
        <h1>GLB Model Preview</h1>
        <p>Upload a GLB / glTF file to preview it. GLB files are used directly by HMS — no conversion needed.</p>
      </div>
    </div>
    <div class="component-container">
      <GlbUploadViewer />
    </div>
  </div>
</template>

<script setup>
import GlbUploadViewer from '../components/GlbUploadViewer.vue'
</script>
