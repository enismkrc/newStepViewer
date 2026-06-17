/**
 * Tema (açık / koyu) yönetimi.
 *
 * - Tek bir paylaşılan `theme` ref'i (modül seviyesinde singleton) tüm bileşenlerce kullanılır.
 * - Seçim `localStorage`'a yazılır; ilk açılışta kayıt yoksa işletim sistemi tercihine bakılır.
 * - Aktif tema `<html data-theme="light|dark">` olarak yansıtılır; tüm CSS değişkenleri
 *   (src/App.vue içindeki :root / :root[data-theme="dark"]) buna göre çözülür.
 *
 * Kullanım:
 *   import { useTheme } from '@/composables/useTheme'
 *   const { theme, toggle, isDark } = useTheme()
 */
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'hms-theme'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage erişilemiyorsa (gizli mod vb.) sessizce geç.
  }
  // Kayıt yoksa: ana uygulama koyu temayı varsayan ortamlarda koyu başlasın.
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

function applyTheme(value) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', value)
  }
}

const theme = ref(getInitialTheme())
// İlk değeri hemen uygula (mount beklemeden, flash'ı önler).
applyTheme(theme.value)

watch(theme, (value) => {
  applyTheme(value)
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // yoksay
  }
})

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  function setTheme(value) {
    if (value === 'light' || value === 'dark') theme.value = value
  }
  return { theme, isDark, toggle, setTheme }
}
