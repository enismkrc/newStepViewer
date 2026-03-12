import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Entry',
    component: () => import('../views/HmsEntry.vue'),
    meta: { title: 'Aircraft Selection' }
  },
  {
    path: '/view/:aircraftId',
    name: 'View',
    component: () => import('../views/HmsViewerPage.vue'),
    meta: { title: 'Model View' }
  },
  {
    path: '/import',
    name: 'Import',
    component: () => import('../views/ImportTool.vue'),
    meta: { title: 'Model Import & Conversion' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} | HMS` : 'HMS'
})

export default router
