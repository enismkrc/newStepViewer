<template>
  <div id="app">
    <header class="app-header">
      <div class="app-brand">Health Management System</div>
      <nav class="app-nav">
        <router-link to="/" class="nav-link" active-class="nav-link-active">Selection</router-link>
        <router-link to="/import" class="nav-link" active-class="nav-link-active">GLB Preview</router-link>
        <button type="button" class="theme-toggle" @click="toggleDark">
          {{ isDark ? '☀️ Light' : '🌙 Dark' }}
        </button>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

/*
 * NOT: App.vue yalnızca STANDALONE çalışmada (kendi main.js'imiz) kullanılır.
 * Buradaki dark toggle SADECE standalone'da denemek içindir; ana projede dark mode'u
 * host (<html class="dark">) yönetir, App.vue render edilmez.
 */
const isDark = ref(document.documentElement.classList.contains('dark'))
function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}
</script>

<style scoped>
#app {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.app-brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 8px;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}

.nav-link-active {
  color: var(--color-primary-600);
  background: var(--hover-bg);
}

.theme-toggle {
  margin-left: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
}

.app-main {
  padding: 24px;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
}
</style>
