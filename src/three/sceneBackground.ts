/**
 * 3D sahne arka planını CSS değişkeninden (`--stage-bg`) okur ve ana projenin
 * dark mode'u (<html class="dark">) değişince otomatik günceller.
 */
import * as THREE from 'three'

const FALLBACK = '#f1f5f9'

export function readStageColor(el?: Element | null): THREE.Color {
  let raw = ''
  try {
    raw = getComputedStyle(el || document.documentElement)
      .getPropertyValue('--bg-secondary')
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

export function observeStageBackground(
  getScene: () => THREE.Scene | null,
  getEl: () => HTMLElement | null
): () => void {
  const apply = () => {
    const scene = getScene()
    if (scene) scene.background = readStageColor(getEl())
  }
  apply()
  let observer: MutationObserver | null = null
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  }
  return () => observer?.disconnect()
}
