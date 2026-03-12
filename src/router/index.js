import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/HmsDashboard.vue'),
    meta: { title: 'Health Management System' }
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
