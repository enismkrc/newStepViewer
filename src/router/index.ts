import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
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
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${String(to.meta.title)} | HMS` : 'HMS'
})

export default router
