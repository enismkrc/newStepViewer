/**
 * 3D sahne arka planını CSS değişkeninden (`--stage-bg`) okur ve ana projenin
 * dark mode'u (<html class="dark">) değişince otomatik günceller.
 *
 * Tema state'i YOK; renk doğrudan DOM'dan (hms-app değişkenlerinden) okunur.
 */
import * as THREE from 'three'

const FALLBACK = '#f1f5f9'

/** Verilen elementte çözülmüş `--stage-bg` rengini THREE.Color olarak döndürür. */
export function readStageColor(el) {
  let raw = ''
  try {
    raw = getComputedStyle(el || document.documentElement)
      .getPropertyValue('--stage-bg')
      .trim()
  } catch {
    // erişilemezse fallback
  }
  if (!raw || raw.startsWith('var(')) raw = FALLBACK
  try {
    return new THREE.Color(raw)
  } catch {
    return new THREE.Color(FALLBACK)
  }
}

/**
 * scene.background'u hemen ayarlar ve <html> class/data-theme değişimlerinde günceller.
 * @param {() => (THREE.Scene|null)} getScene
 * @param {() => (HTMLElement|null)} getEl
 * @returns {() => void} dispose (observer'ı kapatır)
 */
export function observeStageBackground(getScene, getEl) {
  const apply = () => {
    const scene = getScene()
    if (scene) scene.background = readStageColor(getEl())
  }
  apply()
  let observer = null
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  }
  return () => observer?.disconnect()
}
