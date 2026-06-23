<!--
  HMS MODÜL KABUĞU (ara katman: sayfa yapısı + alt-navigasyon)
  =====================================================
  Bu dosya MainLayout'un YERİNE GEÇMEZ; onun İÇİNDE çalışır.
  - MainLayout  = senin sabit yapın (profil, dark mode, üst menü...) + <router-view/>
  - HmsModule   = PrimeVue TabMenu + <router-view/>
  - HmsEntry / HmsViewerPage / ImportTool = asıl sayfalar (tüm logic burada)

  Renkler ana projenin tailwind.css/main.css değişkenlerinden gelir (köprü YOK).
  Logic YOK — onBaseChange vb. her şey HmsEntry / HmsViewerPage içinde kalır.

  KULLANIM — /hms'in component'i MainLayout; HMS route'ları onun altına nested gelir:

    {
      path: '/hms',
      component: MainLayout,
      children: [
        {
          path: '',
          component: () => import('@/views/HmsModule.vue'),
          children: [
            { path: '',  name: 'Entry',  component: () => import('@/views/HmsEntry.vue') },
            {
              path: 'view/:aircraftId/:flightId',
              name: 'View',
              component: () => import('@/views/HmsViewerPage.vue')
            },
            { path: 'import', name: 'Import', component: () => import('@/views/ImportTool.vue') }
          ]
        }
      ]
    }
-->
<template>
  <div class="component-view">
    <TabMenu :model="navItems" :active-index="activeNavIndex" class="hms-tabmenu" @tab-change="onNavChange" />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabMenu from 'primevue/tabmenu'

const route = useRoute()
const router = useRouter()

const navItems = [
  { label: 'Selection', icon: 'pi pi-list', routeName: 'Entry' },
  { label: 'GLB Preview', icon: 'pi pi-box', routeName: 'Import' }
]

const activeNavIndex = computed(() => {
  if (route.name === 'Import') return 1
  // Entry ve View (model viewer) → Selection sekmesi aktif
  return 0
})

function onNavChange(e: { index: number }) {
  const item = navItems[e.index]
  if (item?.routeName) router.push({ name: item.routeName })
}
</script>

<style scoped>
.hms-tabmenu {
  margin-bottom: 16px;
}
</style>
