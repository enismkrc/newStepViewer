<template>
  <div id="app">
    <header class="app-header">
      <div class="app-brand">Health Management System</div>
      <nav class="app-nav">
        <router-link to="/" class="nav-link" active-class="nav-link-active">Selection</router-link>
        <router-link to="/import" class="nav-link" active-class="nav-link-active">GLB Preview</router-link>
        <button
          type="button"
          class="theme-toggle"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggle"
        >
          <span v-if="isDark">☀️ Light</span>
          <span v-else>🌙 Dark</span>
        </button>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useTheme } from './composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<style>
/* ============ TEMA DEĞİŞKENLERİ ============ */
/* Açık tema (varsayılan) */
:root {
  --bg: #f1f5f9;
  --bg-header: #ffffff;
  --panel: #ffffff;
  --panel-2: #f8fafc;
  --panel-3: #f1f5f9;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text: #0f172a;
  --text-strong: #0f172a;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;
  --accent: #1e40af;
  --accent-hover: #1e3a8a;
  --accent-text: #1e40af;
  --accent-soft: #eff6ff;
  --accent-ring: rgba(30, 64, 175, 0.16);
  --input-bg: #ffffff;
  --hero-1: #0f172a;
  --hero-2: #1e293b;
  --hero-3: #334155;
  --hero-glow: rgba(59, 130, 246, 0.15);
  --danger: #b91c1c;
  --danger-text: #b91c1c;
  --danger-soft: #fef2f2;
  --danger-border: rgba(185, 28, 28, 0.18);
  --overlay-card-bg: #ffffff;
  --overlay-card-text: #111827;
  --shadow: rgba(15, 23, 42, 0.12);
  --stage-edge: rgba(255, 255, 255, 0.6);
  --stage-glow: rgba(59, 130, 246, 0.12);
}

/* Koyu tema */
:root[data-theme="dark"] {
  --bg: #0b1220;
  --bg-header: #0f172a;
  --panel: #111a2b;
  --panel-2: #0f172a;
  --panel-3: #1e293b;
  --border: #1f2a3b;
  --border-strong: #334155;
  --text: #e2e8f0;
  --text-strong: #f8fafc;
  --text-muted: #94a3b8;
  --text-subtle: #7c8db0;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-text: #93c5fd;
  --accent-soft: rgba(59, 130, 246, 0.14);
  --accent-ring: rgba(59, 130, 246, 0.25);
  --input-bg: #0f172a;
  --hero-1: #060b16;
  --hero-2: #0f172a;
  --hero-3: #1e293b;
  --hero-glow: rgba(59, 130, 246, 0.22);
  --danger: #b91c1c;
  --danger-text: #fca5a5;
  --danger-soft: rgba(185, 28, 28, 0.16);
  --danger-border: rgba(185, 28, 28, 0.3);
  --overlay-card-bg: #111a2b;
  --overlay-card-text: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.5);
  --stage-edge: #0b1220;
  --stage-glow: rgba(59, 130, 246, 0.18);
}

/* ============ TEMEL ============ */
#app {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text);
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg);
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 24px;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.app-brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
  letter-spacing: -0.02em;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 8px;
}

.nav-link:hover {
  color: var(--text-strong);
  background: var(--panel-3);
}

.nav-link-active {
  color: var(--accent-text);
  background: var(--accent-soft);
}

.theme-toggle {
  margin-left: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  background: var(--panel-3);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.theme-toggle:hover {
  background: var(--border-strong);
}

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
