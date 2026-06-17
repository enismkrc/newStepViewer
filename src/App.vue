<template>
  <div id="app" class="hms-app">
    <header class="app-header">
      <div class="app-brand">Health Management System</div>
      <nav class="app-nav">
        <router-link to="/" class="nav-link" active-class="nav-link-active">Selection</router-link>
        <router-link to="/import" class="nav-link" active-class="nav-link-active">GLB Preview</router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import './styles/hms-theme.css'
</script>

<style>
/*
 * NOT: Bu stiller yalnızca STANDALONE çalışmada (kendi main.js'imiz) kullanılır.
 * Ana projeye gömerken App.vue render edilmez; renkler hms-theme.css (.hms-app) +
 * ana projenin main.css değişkenlerinden gelir.
 */
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
  background: var(--bg-secondary, #f1f5f9);
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

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
</style>
