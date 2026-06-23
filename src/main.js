import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import App from './App.vue'
import router from './router'

// Ana projedeki ile aynı global stiller (standalone için).
// Ana projeye gömerken bu iki dosyayı KOPYALAMAYIN; host kendi tailwind.css/main.css'ini kullanır.
import './assets/tailwind.css'
import './assets/main.css'
import 'primeicons/primeicons.css'

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      // Ana proje dark mode'u <html class="dark"> ile döner (tailwind.css :root.dark).
      darkModeSelector: '.dark'
    }
  }
})
app.use(router)
app.mount('#app')
