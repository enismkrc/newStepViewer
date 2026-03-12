<template>
  <div id="app">
    <header class="app-header">
      <div class="app-brand">Health Management System</div>
      <nav class="app-nav">
        <router-link to="/" class="nav-link" active-class="nav-link-active">Dashboard</router-link>
        <router-link to="/import" class="nav-link" active-class="nav-link-active">Model Import</router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
#app {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #0f172a;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: #f1f5f9;
}

body {
  margin: 0;
  padding: 0;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.app-brand {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
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
  color: #475569;
  text-decoration: none;
  border-radius: 8px;
}

.nav-link:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.nav-link-active {
  color: #1e40af;
  background: #eff6ff;
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
