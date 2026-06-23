import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Entry',
    component: () => import('../views/HmsEntry.vue'),
    meta: { title: 'Aircraft Selection' }
  },
  {
    path: '/view/:aircraftId/:flightId',
    name: 'View',
    component: () => import('../views/HmsViewerPage.vue'),
    meta: { title: 'Model View' }
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('../views/ImportTool.vue'),
    meta: { title: 'GLB Preview' }
  }
]

const router = createRouter({
  // import.meta.env.BASE_URL = vite.config.js içindeki `base` değeri.
  // Uygulama bir alt yolda sunulursa (örn. /hms/) router otomatik uyumlu olur.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} | HMS` : 'HMS'
})

export default router
