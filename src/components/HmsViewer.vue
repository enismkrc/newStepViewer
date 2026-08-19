<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="title">Model View</div>
      </div>

      <div class="controls">
        <router-link :to="{ name: 'Entry' }" custom v-slot="{ navigate }">
          <Button label="Back to selection" icon="pi pi-arrow-left" severity="secondary" outlined :disabled="!modelLoaded" @click="navigate" />
        </router-link>
        <Button
          label="Reset View"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          :disabled="!modelLoaded"
          @click="resetView"
        />
        <Button
          :label="wireframe ? 'Solid' : 'Wireframe'"
          icon="pi pi-th-large"
          severity="secondary"
          outlined
          :disabled="!modelLoaded"
          @click="toggleWireframe"
        />
        <Button
          v-if="modelLoaded && hasFaults"
          :label="transparentOthers ? 'Opaque' : 'Transparent'"
          :severity="transparentOthers ? undefined : 'secondary'"
          :outlined="!transparentOthers"
          icon="pi pi-eye"
          @click="transparentOthers = !transparentOthers"
        />
        <Button
          v-if="isIsolated || isDetailView"
          label="Back to model"
          icon="pi pi-arrow-left"
          @click="showAllParts"
        />
        <Button
          v-if="isIsolated && isolatedName"
          :label="partDetailPanelOpen ? 'Close detail' : 'Part detail'"
          :severity="partDetailPanelOpen ? undefined : 'secondary'"
          :outlined="!partDetailPanelOpen"
          icon="pi pi-info-circle"
          @click="partDetailPanelOpen = !partDetailPanelOpen"
        />
      </div>
    </header>

    <div class="status" v-if="statusText || errorText">
      <div v-if="statusText" class="statusText">{{ statusText }}</div>
      <div v-if="errorText" class="errorText">{{ errorText }}</div>
    </div>

    <div class="stage-wrapper" :class="{ 'stage-wrapper-split': partDetailVisible }">
      <div class="stage" ref="stageRef">
        <canvas ref="canvasEl" class="canvas"></canvas>
        <button
          v-for="label in faultLabels"
          :key="'pin-' + label.id"
          type="button"
          class="fault-pin"
          :class="{ active: shownFaultId === label.id }"
          :style="{ left: label.x + 'px', top: label.y + 'px' }"
          @mouseenter="hoveredFaultId = label.id"
          @mouseleave="hoveredFaultId = null"
          @click="focusFault(label.id)"
        >
          {{ label.num }}
        </button>
        <div
          v-if="activeFaultLabel"
          class="fault-label-overlay"
          :style="{ left: activeFaultLabel.x + 'px', top: activeFaultLabel.y + 'px' }"
        >
          <div class="fault-label-line"></div>
          <div class="fault-label-box">
            <div v-if="activeFaultLabel.card.hasFin" class="fault-card-row fault-card-fin">
              FIN# {{ activeFaultLabel.card.fin }}
            </div>
            <div v-if="activeFaultLabel.card.lruName" class="fault-card-row">
              <span class="fault-card-label">Part:</span> {{ activeFaultLabel.card.lruName }}
            </div>
            <div class="fault-card-row">
              <span class="fault-card-label">Faults:</span> {{ activeFaultLabel.card.count }}
            </div>
            <div v-if="activeFaultLabel.card.count === 1" class="fault-card-row fault-card-desc">
              <span class="fault-card-label">Description:</span> {{ activeFaultLabel.card.description }}
            </div>
            <div v-else class="fault-card-row fault-card-desc fault-card-hint">
              Click the part to see all fault records.
            </div>
          </div>
        </div>
        <div
          v-if="hasFaults && !isIsolated"
          class="fault-list-panel"
          :style="{ width: faultPanelWidth + 'px' }"
        >
          <div class="fault-list-title">Faults ({{ faultRecordCount }})</div>
          <ul class="fault-list">
            <li
              v-for="(f, i) in faultEntries"
              :key="f.id"
              class="fault-list-item"
              :class="{ active: shownFaultId === f.id }"
              @mouseenter="hoveredFaultId = f.id"
              @mouseleave="hoveredFaultId = null"
              @click="focusFault(f.id)"
            >
              <span class="fault-list-num">{{ i + 1 }}</span>
              <span class="fault-list-text">
                <span v-if="f.card.hasFin" class="fault-list-fin">{{ f.card.fin }}</span>
                <span v-if="f.card.lruName" class="fault-list-name" :title="f.card.lruName">{{ f.card.lruName }}</span>
              </span>
              <span class="fault-list-count">{{ f.card.count }}</span>
            </li>
          </ul>
          <div
            class="fault-list-resizer"
            title="Drag to resize — double-click to reset"
            @pointerdown="startFaultPanelResize"
            @dblclick="faultPanelWidth = FAULT_PANEL_DEFAULT_WIDTH"
          ></div>
        </div>
      </div>
      <div
        v-if="partDetailVisible"
        class="part-detail-resizer"
        :style="{ right: partPanelWidth - 4 + 'px' }"
        title="Drag to resize — double-click to reset"
        @pointerdown="startPartPanelResize"
        @dblclick="resetPartPanelWidth"
      ></div>
      <aside v-if="partDetailVisible" class="part-detail-panel" :style="{ width: partPanelWidth + 'px' }">
        <div class="part-detail-panel-header">
          <h3 class="part-detail-title">Part Detail</h3>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            aria-label="Close"
            @click="partDetailPanelOpen = false"
          />
        </div>
        <div class="part-detail-heading">
          <span v-if="activePart?.hasFin" class="part-fin-badge">FIN {{ activePart.fin }}</span>
          <span class="part-detail-name">{{ activePart?.label || isolatedName }}</span>
        </div>

        <dl v-if="activeMflList.length" class="part-detail-list">
          <dt v-if="activePart?.hasFin">FIN Number</dt>
          <dd v-if="activePart?.hasFin">{{ activePart.fin }}</dd>
          <dt>Part</dt>
          <dd>{{ dash(activePart?.label) }}</dd>
          <dt>Fault Count</dt>
          <dd>{{ activeMflList.length }}</dd>
        </dl>
        <p v-else class="part-detail-empty">No MFL record for this part.</p>

        <div v-if="activeLru" class="detail-section">
          <h4 class="detail-section-title">LRU</h4>
          <dl class="part-detail-list">
            <dt>LRU Name</dt>
            <dd>{{ activeLru.name }}</dd>
          </dl>
        </div>

        <div v-if="activeContext" class="detail-section">
          <h4 class="detail-section-title">Flight</h4>
          <dl class="part-detail-list">
            <dt>Flight No</dt>
            <dd>{{ dash(activeContext.flightNo) }}</dd>
            <dt>Mission Type</dt>
            <dd>{{ dash(activeContext.missionType) }}</dd>
            <dt>Aircraft</dt>
            <dd>{{ dash(activeContext.aircraftName) }}</dd>
            <dt>Fleet</dt>
            <dd>{{ dash(activeContext.fleetName) }}</dd>
            <dt>Fleet Base</dt>
            <dd>{{ dash(activeContext.fleetBase) }}</dd>
          </dl>
        </div>

        <div v-if="activeMflList.length" class="detail-section">
          <h4 class="detail-section-title">MFL ({{ activeMflList.length }})</h4>
          <div v-for="(m, i) in activeMflList" :key="m.id" class="mfl-block" :class="severityClass(m.severity)">
            <div class="mfl-index">MFL {{ i + 1 }}</div>
            <dl class="part-detail-list">
              <dt>Fault Code</dt>
              <dd>{{ dash(m.faultCode) }}</dd>
              <dt>Severity</dt>
              <dd class="mfl-severity" :class="severityClass(m.severity)">{{ dash(m.severity) }}</dd>
              <dt>Description</dt>
              <dd>{{ dash(m.description) }}</dd>
              <dt>LRU Field Name</dt>
              <dd>{{ dash(m.lruFieldName) }}</dd>
              <dt>Category</dt>
              <dd>{{ dash(m.category) }}</dd>
              <dt>ATA Chapter</dt>
              <dd>{{ dash(m.ataChapterCode) }}</dd>
              <dt>Absolute Time</dt>
              <dd>{{ formatDateTime(m.absoluteTime) }}</dd>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType, Ref } from 'vue'
import Button from 'primevue/button'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ViewportGizmo } from 'three-viewport-gizmo'
import { createViewportGizmo } from '../three/viewportGizmoConfig'
import type { GizmoInstance } from '../three/viewportGizmoConfig'
import '../three/viewportGizmo.css'
import { mergeViewConfig, applyModelOrientation, frameCameraOnBox } from '../three/defaultView'
import { observeStageBackground, readStageColor } from '../three/sceneBackground'
import { disposeMaterial, isMesh, setMaterialWireframe, standardMaterialOf } from '../three/meshUtils'
import type { DisposableObject } from '../three/meshUtils'
import { finKeyOf, parseFinValue, parsePartName } from '../three/partNaming'
import type { Fault, NormalizedMflRecord } from '@/types/api-types'
import type { ViewConfigPartial } from '@/types/view-types'

/** Normalized fault definition, from either the `faults` array or `faultyPart`. */
interface FaultDef {
  /** Raw match key: MFL `finNumber` (or a plain part name for the legacy props). */
  key: string
  fin?: string
  warningFaults?: string
  records: NormalizedMflRecord[]
}

/**
 * Compact fault summary shown in the fault list and the hover card.
 *
 * Fault code / severity bilerek yer almaz: bir parçanın onlarca MFL kaydı olabilir ve
 * bunlar kayıttan kayda değişir. Tekil değerler yalnızca part detail panelinde,
 * her MFL kaydının kendi bloğunda gösterilir.
 */
interface FaultCard {
  fin: string
  hasFin: boolean
  lruName: string
  /** Yalnızca tek MFL kaydı varsa anlamlı; birden fazlasında hover kartı gizler. */
  description: string
  count: number
}

interface FaultEntry {
  id: string
  partName: string
  card: FaultCard
}

/** A part/assembly of the loaded model, indexed by its FIN key. */
interface PartInfo {
  name: string
  label: string
  fin: string
  hasFin: boolean
}

/** A fault's numbered pin, positioned in screen space over the canvas. */
interface FaultLabel {
  id: string
  num: number
  x: number
  y: number
  card: FaultCard
}

// 3D sahne arka planı --stage-bg CSS değişkeninden okunur (ana projenin temasına uyar).
let disposeStageBg: (() => void) | null = null

/**
 * HMS (Health Management System) viewer (Three.js)
 *
 * Main responsibilities:
 * - Load a GLB/glTF model from `modelUrl` (binary glTF, loaded natively by Three.js).
 * - Highlight faulty parts from API `faults[]` (part names must match glTF node names).
 * - Allow interaction: hover highlight, click to isolate a part and zoom camera to it.
 * - Optional: if `detailModelUrl` is provided, clicking the faulty part can switch to a deeper/detail model.
 */
const props = defineProps({
  modelUrl: { type: String, default: '' },
  /**
   * Name of the part that should be treated as "faulty" and highlighted in red.
   * This is passed from the parent page (selected aircraft).
   */
  faultyPart: { type: String as PropType<string | null>, default: null },
  /**
   * Optional fault type. Used by UI text for the fault overlay card.
   */
  faultType: { type: String as PropType<string | null>, default: null },
  /**
   * Optional: a second model URL for a detailed view (e.g. engine-only model).
   */
  detailModelUrl: { type: String as PropType<string | null>, default: null },
  /**
   * Optional: the faulty part name inside the detail model.
   */
  detailFaultyPart: { type: String as PropType<string | null>, default: null },
  /**
   * Optional: multiple faults for one aircraft. Each item:
   * { part: string, type?: string, fin?: string, status?: string, warningFaults?: string }
   * `part` may be a leaf part OR an assembly name (whole assembly highlights red).
   * When provided, this takes precedence over the single `faultyPart`/`faultType`.
   */
  faults: { type: Array as PropType<Fault[]>, default: () => [] },
  /**
   * MFL records for this aircraft (from API). Part detail panelinin TEK veri kaynağıdır;
   * kayıtlar `finNumber` üzerinden model parçalarına bağlanır.
   */
  mflList: { type: Array as PropType<NormalizedMflRecord[]>, default: () => [] },
  /**
   * Optional per-aircraft viewer tuning (from API / mock JSON).
   * { modelRotation?: {x,y,z}, cameraOffset?: {x,y,z}, zoom?: {...}, swapFrontBack?: boolean }
   */
  viewConfig: { type: Object as PropType<ViewConfigPartial | null>, default: null }
})

const activeViewConfig = computed(() => mergeViewConfig(props.viewConfig))

const canvasEl = ref<HTMLCanvasElement | null>(null)
const statusText = ref('Loading model...')
const errorText = ref('')
const wireframe = ref(false)

const modelLoaded = computed(() => meshesCount.value > 0)
const meshesCount = ref(0)
const isIsolated = ref(false)
const isolatedPartName = ref('')
// Name of the part/assembly currently isolated. For a faulty assembly this is the
// assembly name (the whole unit is isolated, not an individual sub-part).
const isolatedName = ref('')
const partDetailPanelOpen = ref(false)
const partNames = ref<string[]>([])
// FIN anahtarı -> model parçası. MFL `finNumber` alanı bu index üzerinden parçaya bağlanır.
const partIndex = ref<Map<string, PartInfo>>(new Map())
const stageRef = ref<HTMLElement | null>(null)
const transparentOthers = ref(false)
const isDetailView = ref(false)
// When a detail model is loaded, this holds the single faulty part name inside it.
const detailFaultName = ref('')
// While a part is being inspected the 3D view is read-only: clicking a part (or any of
// its sub-parts) must not change the view. "Back to model" is the only way out.
const viewOnly = computed(() => isIsolated.value || isDetailView.value)
// Part detail paneli (ve onunla birlikte sahnenin bölünmüş yerleşimi) görünür mü.
const partDetailVisible = computed(() => isIsolated.value && partDetailPanelOpen.value && !!isolatedName.value)
// Screen-space overlay labels for every fault (named parts).
// Each: { id, num, x, y, card: { fin, partName, status, warningFaults } }
const faultLabels = ref<FaultLabel[]>([])
// Which fault's detail card to show. Purely hover-driven: a card is shown only while
// the cursor is over that fault's pin, its list row, or its 3D object. When the cursor
// is not over any fault, no card is shown.
const hoveredFaultId = ref<string | null>(null)
const shownFaultId = computed(() => hoveredFaultId.value)

// Her iki yan panel de kenarından sürüklenerek genişletilebilir (uzun parça/alan adları
// için). Çift tıklama varsayılan genişliğe döndürür.
const FAULT_PANEL_DEFAULT_WIDTH = 248
const FAULT_PANEL_MIN_WIDTH = 200
const FAULT_PANEL_MAX_WIDTH = 640
const PART_PANEL_DEFAULT_WIDTH = 340
const PART_PANEL_MIN_WIDTH = 260
const PART_PANEL_MAX_WIDTH = 720
// Part detail büyürken 3D sahnenin altına düşmemesi gereken genişlik.
const MIN_STAGE_WIDTH = 320

const faultPanelWidth = ref(FAULT_PANEL_DEFAULT_WIDTH)
const partPanelWidth = ref(PART_PANEL_DEFAULT_WIDTH)

interface PanelResizeOptions {
  width: Ref<number>
  min: number
  /** Sürükleme başlarken hesaplanan üst sınır. */
  max: () => number
  /** Kolun panelin hangi kenarında olduğu: sağ kenar 1, sol kenar -1. */
  sign: 1 | -1
  /** Genişlik her değiştiğinde çalışır (ör. canvas'ı yeni boyuta uydurmak için). */
  onStep?: () => void
}

function startPanelResize(event: PointerEvent, options: PanelResizeOptions) {
  const handle = event.currentTarget as HTMLElement | null
  if (!handle) return
  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startWidth = options.width.value
  const maxWidth = Math.max(options.min, options.max())

  const onMove = (e: PointerEvent) => {
    const next = startWidth + options.sign * (e.clientX - startX)
    options.width.value = Math.min(maxWidth, Math.max(options.min, next))
    options.onStep?.()
  }
  const onUp = () => {
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onUp)
    handle.removeEventListener('pointercancel', onUp)
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  }

  handle.setPointerCapture(event.pointerId)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
}

function startFaultPanelResize(event: PointerEvent) {
  startPanelResize(event, {
    width: faultPanelWidth,
    min: FAULT_PANEL_MIN_WIDTH,
    sign: 1,
    max: () => Math.min(FAULT_PANEL_MAX_WIDTH, (stageRef.value?.clientWidth ?? FAULT_PANEL_MAX_WIDTH) - 24)
  })
}

function startPartPanelResize(event: PointerEvent) {
  startPanelResize(event, {
    width: partPanelWidth,
    min: PART_PANEL_MIN_WIDTH,
    sign: -1,
    max: () => {
      const wrapperWidth = stageRef.value?.parentElement?.clientWidth ?? PART_PANEL_MAX_WIDTH
      return Math.min(PART_PANEL_MAX_WIDTH, wrapperWidth - MIN_STAGE_WIDTH)
    },
    onStep: onResize
  })
}

function resetPartPanelWidth() {
  partPanelWidth.value = PART_PANEL_DEFAULT_WIDTH
  onResize()
}

/**
 * Normalized list of fault definitions for the current aircraft. Supports either the
 * multi-fault `faults` array or the single `faultyPart`/`faultType` props.
 */
const faultDefs = computed<FaultDef[]>(() => {
  const raw: Partial<Fault>[] = (Array.isArray(props.faults) && props.faults.length)
    ? props.faults
    : (props.faultyPart ? [{ part: props.faultyPart, type: props.faultType ?? undefined }] : [])
  // De-duplicate by FIN key while preserving order.
  const seen = new Set<string>()
  const out: FaultDef[] = []
  for (const f of raw) {
    if (!f || !f.part) continue
    const key = finKeyOf(f.part)
    if (!key || seen.has(key)) continue
    // MFL bu uçakta bulunmayan parçaların (ör. başka bir ATA bölümü) faultlarını da
    // döndürebiliyor; modelde karşılığı olmayan FIN'ler hiç listelenmez.
    if (!partIndex.value.has(key)) continue
    seen.add(key)
    out.push({
      key: f.part,
      fin: f.fin,
      warningFaults: f.warningFaults,
      records: f.records ?? []
    })
  }
  return out
})

// Names of the parts/assemblies that should be highlighted red right now.
const activeFaultNames = computed(() => {
  if (isDetailView.value) return detailFaultName.value ? [detailFaultName.value] : []
  return faultDefs.value.map((f) => partInfoFor(f.key)?.name ?? f.key)
})

/**
 * Fault list driving the side panel, the numbered pins and the hover detail cards.
 * A fault's MFL `finNumber` is resolved to the matching model part, so the list shows
 * the readable part name while highlighting/isolation still work on the real node.
 */
const faultEntries = computed<FaultEntry[]>(() => {
  if (isDetailView.value) {
    const name = detailFaultName.value
    return name
      ? [{ id: 'fault:' + finKeyOf(name), partName: name, card: makeFaultCard({ key: name, records: [] }) }]
      : []
  }
  return faultDefs.value.map((f) => ({
    id: 'fault:' + finKeyOf(f.key),
    partName: partInfoFor(f.key)?.name ?? f.key,
    card: makeFaultCard(f)
  }))
})

const hasFaults = computed(() => faultEntries.value.length > 0)

/**
 * Panel başlığındaki sayı: listelenen satır (FIN) adedi değil, o FIN'lere bağlı toplam
 * MFL kaydı adedi. Bir parçada birden fazla arıza olabildiği için ikisi aynı değil.
 */
const faultRecordCount = computed(() =>
  faultEntries.value.reduce((sum, e) => sum + e.card.count, 0)
)

// The single detail card to render (only the hovered fault), if it is on screen.
const activeFaultLabel = computed(() => {
  const id = shownFaultId.value
  if (id == null) return null
  return faultLabels.value.find((l) => l.id === id) || null
})

// Backend severity ölçeği. Sıra hem listeleme hem renklendirme için kullanılır;
// tanınmayan değerler en sona düşer ve renksiz gösterilir.
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

function severityLevel(severity: string | null | undefined): string {
  return String(severity ?? '').trim().toLowerCase()
}

function severityRank(severity: string | null | undefined): number {
  const index = SEVERITY_ORDER.indexOf(severityLevel(severity))
  return index === -1 ? SEVERITY_ORDER.length : index
}

function severityClass(severity: string | null | undefined): string {
  const level = severityLevel(severity)
  return SEVERITY_ORDER.includes(level) ? `is-${level}` : ''
}

/** Empty values render as an em dash instead of a blank cell. */
function dash(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? '' : String(value).trim()
  return s || '—'
}

/** ISO timestamps are shown as readable UTC; anything else is passed through. */
function formatDateTime(value: string | null | undefined) {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

/** Model part matching a fault's FIN, or null when the FIN is not in the loaded model. */
function partInfoFor(key: string | null | undefined): PartInfo | null {
  const finKey = finKeyOf(key)
  if (!finKey) return null
  return partIndex.value.get(finKey) ?? null
}

/**
 * MFL records belonging to a FIN. `key` ham FIN de olabilir, tam node adı da
 * ("_FLT2420MG002 - INVERTER, L"); ikisi de aynı anahtara indirgenir.
 */
function recordsForKey(key: string | null | undefined): NormalizedMflRecord[] {
  const finKey = finKeyOf(key)
  if (!finKey) return []
  return props.mflList.filter((r) => (r.finKey || finKeyOf(r.fin)) === finKey)
}

/**
 * Build a compact fault summary card from the fault's MFL records plus the part name
 * parsed out of the model node (`_FLT2420MG002 - INVERTER, L` -> FIN + "INVERTER, L").
 * Shown on hover (pin / list row) and at the top of the part detail panel.
 */
function makeFaultCard(def: FaultDef): FaultCard {
  const info = partInfoFor(def.key)
  const records = def.records.length ? def.records : recordsForKey(def.key)
  const primary = records[0] ?? null
  const fallback = parseFinValue(def.fin || def.key)

  const fin = info?.fin || fallback.fin
  const hasFin = info ? info.hasFin : fallback.hasFin
  let lruName = info?.label || primary?.lruFieldName || primary?.lruModelName || def.key
  if (hasFin && lruName === fin) lruName = ''

  return {
    fin,
    hasFin: hasFin && !!fin,
    lruName,
    description: primary?.description || def.warningFaults || '—',
    count: records.length
  }
}

/** FIN + readable name of the currently isolated part/assembly. */
const activePart = computed(() => (isolatedName.value ? parsePartName(isolatedName.value) : null))

/**
 * MFL records for the currently isolated part/assembly, matched by FIN and ordered
 * critical > high > medium > low. Aynı seviyedeki kayıtlar geliş sırasını korur.
 */
const activeMflList = computed(() =>
  recordsForKey(isolatedName.value).sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
)

/**
 * Bir parçanın MFL kayıtları aynı alanı farklı değerlerle taşıyabilir (ör. iki ayrı
 * uçuş). Tekrarsız değerleri tek satırda birleştirir.
 */
function uniqueJoined(values: Array<string | null | undefined>): string {
  const out: string[] = []
  for (const value of values) {
    const s = String(value ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out.join(', ')
}

/**
 * LRU adı MFL kayıtlarındaki LRU model adından okunur. Field adı kayıttan kayda
 * değiştiği için burada değil, her MFL kaydının kendi bloğunda gösterilir.
 */
const activeLru = computed(() => {
  const records = activeMflList.value
  if (!records.length) return null
  const name = uniqueJoined(records.map((r) => r.lruModelName))
  return name ? { name } : null
})

/** Uçuş/uçak bilgisi de MFL kayıtlarından gelir (MFL birden fazla uçuşu kapsayabilir). */
const activeContext = computed(() => {
  const records = activeMflList.value
  if (!records.length) return null
  return {
    flightNo: uniqueJoined(records.map((r) => r.flightNo)),
    missionType: uniqueJoined(records.map((r) => r.missionType)),
    aircraftName: uniqueJoined(records.map((r) => r.aircraftName)),
    fleetName: uniqueJoined(records.map((r) => r.fleetName)),
    fleetBase: uniqueJoined(records.map((r) => r.fleetBase))
  }
})

watch(activeFaultNames, () => {
  // If there are faults, default to making non-faulty parts semi-transparent.
  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()
})
watch(transparentOthers, () => updateFaultyHighlight())

watch([isIsolated, partDetailPanelOpen], () => {
  setTimeout(onResize, 80)
})

watch(() => props.modelUrl, (newUrl) => {
  loadModelFromUrl(newUrl)
})

watch(() => [props.faultyPart, props.faults], () => {
  // Aircraft changed: clear isolation, show all parts, reset the camera.
  if (modelGroup) {
    modelGroup.traverse((obj) => {
      if (isMesh(obj)) obj.visible = true
    })
    isIsolated.value = false
    isolatedPartName.value = ''
    isolatedName.value = ''
    partDetailPanelOpen.value = false
    clearHover()
    resetView()
  }
  isDetailView.value = false
  detailFaultName.value = ''
  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()
}, { deep: true })

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let modelGroup: THREE.Group | null = null
let rafId: number | null = null
let raycaster: THREE.Raycaster | null = null
let pointer: THREE.Vector2 | null = null
let hoveredMesh: THREE.Mesh | null = null
let viewportGizmo: GizmoInstance | null = null
const gltfLoader = new GLTFLoader()

function initViewportGizmo() {
  const container = stageRef.value || canvasEl.value?.parentElement
  if (!camera || !renderer || !controls || !container) return

  viewportGizmo?.dispose()
  viewportGizmo = createViewportGizmo(
    ViewportGizmo,
    camera,
    renderer,
    controls,
    container,
    { swapFrontBack: activeViewConfig.value.swapFrontBack }
  )
}

function initThree() {
  const canvas = canvasEl.value
  if (!canvas) return

  scene = new THREE.Scene()
  scene.background = readStageColor(stageRef.value)

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000)
  camera.position.set(10, 8, 10)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const ambient = new THREE.AmbientLight(0xffffff, 0.35)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xffffff, 1.25)
  key.position.set(2, 3, 4).normalize()
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x6aa6ff, 0.7)
  rim.position.set(-2, 0.5, -3).normalize()
  scene.add(rim)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.screenSpacePanning = false
  controls.minDistance = 0.1
  controls.maxDistance = 100000

  modelGroup = new THREE.Group()
  applyModelOrientation(modelGroup, activeViewConfig.value)
  scene.add(modelGroup)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerdown', onPointerDown)

  initViewportGizmo()

  onResize()
  window.addEventListener('resize', onResize)
  loop()
}

const worldPos = new THREE.Vector3()
const ndc = new THREE.Vector3()

function loop() {
  rafId = requestAnimationFrame(loop)
  controls?.update()

  // Compute 2D screen positions for every fault overlay (named parts).
  const entries = faultEntries.value
  if (entries.length && modelGroup && camera && canvasEl.value) {
    const canvas = canvasEl.value
    const rect = canvas.getBoundingClientRect()
    const stageRect = (canvas.parentElement ?? canvas).getBoundingClientRect()
    const labels: FaultLabel[] = []
    entries.forEach((entry, idx) => {
      // Named part: use the union bounding box center of matching meshes.
      if (isIsolated.value && entry.partName !== isolatedName.value) return
      const bbox = new THREE.Box3()
      modelGroup!.traverse((obj) => {
        if (isMesh(obj) && meshMatchesKey(obj, entry.partName)) bbox.union(new THREE.Box3().setFromObject(obj))
      })
      if (bbox.isEmpty()) return
      bbox.getCenter(worldPos)
      ndc.copy(worldPos).project(camera!)
      // Skip faults that are behind the camera.
      if (ndc.z > 1) return
      const px = rect.left + (ndc.x + 1) * 0.5 * rect.width
      const py = rect.top + (1 - ndc.y) * 0.5 * rect.height
      labels.push({
        id: entry.id,
        num: idx + 1,
        x: px - stageRect.left,
        y: py - stageRect.top,
        card: entry.card
      })
    })
    faultLabels.value = labels
  } else if (faultLabels.value.length) {
    faultLabels.value = []
  }

  if (renderer && scene && camera) renderer.render(scene, camera)
  viewportGizmo?.render()
}

function onResize() {
  const canvas = canvasEl.value
  const parent = canvas?.parentElement
  if (!canvas || !camera || !renderer || !parent) return
  const width = parent.clientWidth
  const height = parent.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  viewportGizmo?.update()
}

function disposeObject(obj: THREE.Object3D) {
  // GLB models are nested hierarchies, so we dispose recursively.
  obj.traverse((child) => {
    const c = child as DisposableObject
    c.geometry?.dispose()
    disposeMaterial(c.material)
  })
}

function clearModel() {
  meshesCount.value = 0
  partNames.value = []
  partIndex.value = new Map()
  isIsolated.value = false
  isolatedPartName.value = ''
  isolatedName.value = ''
  partDetailPanelOpen.value = false
  faultLabels.value = []
  hoveredFaultId.value = null
  clearHover()
  if (!modelGroup) return
  while (modelGroup.children.length) {
    const obj = modelGroup.children[0]
    if (!obj) break
    modelGroup.remove(obj)
    disposeObject(obj)
  }
}

// True if the mesh belongs to ANY currently-active faulty part/assembly.
function meshIsFaulty(mesh: THREE.Object3D) {
  const names = activeFaultNames.value
  for (const n of names) {
    if (meshMatchesKey(mesh, n)) return true
  }
  return false
}

function applyPartStyle(mesh: THREE.Mesh) {
  const mat = standardMaterialOf(mesh)
  if (!mat) return
  const isFaulty = meshIsFaulty(mesh)
  if (isFaulty) {
    // Fault highlight color (red) is applied here.
    mat.color.setHex(0xdc2626)
    mat.emissive.setHex(0xb91c1c)
    mat.emissiveIntensity = 0.7
    mat.transparent = false
    mat.opacity = 1
    mat.depthWrite = true
  } else {
    mat.color.setHex(0xd6d9e6)
    mat.emissive.setHex(0x000000)
    mat.emissiveIntensity = 0
    mat.transparent = transparentOthers.value
    mat.opacity = transparentOthers.value ? 0.3 : 1
    mat.depthWrite = !transparentOthers.value
  }
}

function updateFaultyHighlight() {
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (isMesh(obj) && obj !== hoveredMesh) applyPartStyle(obj)
  })
  if (hoveredMesh) {
    const mat = standardMaterialOf(hoveredMesh)
    if (mat) {
      mat.emissive.setHex(0x2563eb)
      mat.emissiveIntensity = 0.35
      mat.color.lerp(new THREE.Color(0xffffff), 0.15)
    }
  }
}

function setHovered(mesh: THREE.Mesh | null) {
  if (hoveredMesh === mesh) return

  if (hoveredMesh) applyPartStyle(hoveredMesh)

  hoveredMesh = mesh

  if (!hoveredMesh) return

  const mat = standardMaterialOf(hoveredMesh)
  if (!mat) return
  mat.emissive.setHex(0x2563eb)
  mat.emissiveIntensity = 0.35
  mat.color.lerp(new THREE.Color(0xffffff), 0.15)
}

function clearHover() {
  setHovered(null)
  hoveredFaultId.value = null
  const canvas = canvasEl.value
  if (canvas) canvas.style.cursor = 'default'
}

function onPointerLeave() {
  clearHover()
}

function onPointerMove(event: PointerEvent) {
  const canvas = canvasEl.value
  if (!canvas || !raycaster || !pointer || !camera || !modelGroup) return
  if (meshesCount.value === 0) return

  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  raycaster.setFromCamera(pointer, camera)

  const meshes: THREE.Mesh[] = []
  modelGroup.traverse((obj) => {
    if (isMesh(obj) && obj.visible) meshes.push(obj)
  })
  const hit = raycaster.intersectObjects(meshes, false)[0]

  if (!hit) {
    clearHover()
    return
  }

  canvas.style.cursor = viewOnly.value ? 'default' : 'pointer'
  const obj = hit.object as THREE.Mesh
  setHovered(obj)
  // If the hovered mesh belongs to one of the faults, show that fault's card.
  let matchedId: string | null = null
  for (const e of faultEntries.value) {
    if (meshMatchesKey(obj, e.partName)) {
      matchedId = e.id
      break
    }
  }
  hoveredFaultId.value = matchedId
}

function onPointerDown(event: PointerEvent) {
  const canvas = canvasEl.value
  if (!canvas || !raycaster || !pointer || !camera || !modelGroup) return
  if (meshesCount.value === 0) return
  if (viewOnly.value) return

  const rect = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
  raycaster.setFromCamera(pointer, camera)

  const meshes: THREE.Mesh[] = []
  modelGroup.traverse((obj) => {
    if (isMesh(obj) && obj.visible) meshes.push(obj)
  })
  const hit = raycaster.intersectObjects(meshes, false)[0]
  if (!hit) return

  const clicked = hit.object as THREE.Mesh
  if (props.detailModelUrl && props.detailFaultyPart && meshIsFaulty(clicked)) {
    // Detail-view switch: when user clicks a faulty part, swap to the detail model.
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      detailFaultName.value = props.detailFaultyPart ?? ''
      updateFaultyHighlight()
    })
    return
  }
  // If the clicked mesh belongs to a faulty part/assembly, select the WHOLE unit
  // (e.g. clicking "Component003" inside "Left engine" selects the whole engine).
  // This prevents drilling into individual sub-parts of a faulty assembly.
  const faultName = faultNameForMesh(clicked)
  if (faultName) {
    isolateByName(faultName)
  } else {
    isolatePart(clicked)
  }
}

// Return the fault part/assembly name that the given mesh belongs to, or '' if none.
function faultNameForMesh(mesh: THREE.Object3D): string {
  for (const e of faultEntries.value) {
    if (meshMatchesKey(mesh, e.partName)) return e.partName
  }
  return ''
}

function isolatePart(mesh: THREE.Mesh) {
  if (!modelGroup) return
  clearHover()
  modelGroup.traverse((obj) => {
    if (isMesh(obj)) obj.visible = (obj === mesh)
  })
  isolatedPartName.value = mesh?.userData?.partName || ''
  isolatedName.value = isolatedPartName.value
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3().setFromObject(mesh)
  // Zoom/fit behavior when a mesh is clicked:
  // - We isolate the mesh (hide others)
  // - Then we fit the camera to the mesh bounding box via `focusToBox`
  // - Smaller multiplier => closer zoom
  if (!bbox.isEmpty()) focusToBox(bbox, activeViewConfig.value.zoom.part)
}

/**
 * Isolate a whole part/assembly by name: show only the meshes that belong to it (incl.
 * all sub-parts of an assembly), open the detail panel and frame the camera on it.
 */
function isolateByName(name: string) {
  if (!modelGroup || !name) return
  clearHover()
  const matches: THREE.Mesh[] = []
  modelGroup.traverse((obj) => {
    if (!isMesh(obj)) return
    const m = meshMatchesKey(obj, name)
    obj.visible = m
    if (m) matches.push(obj)
  })
  if (!matches.length) {
    // FIN modelde yoksa görünürlüğü bozmadan geri al.
    modelGroup.traverse((obj) => {
      if (isMesh(obj)) obj.visible = true
    })
    return
  }
  isolatedPartName.value = partInfoFor(name)?.name ?? name
  isolatedName.value = isolatedPartName.value
  partDetailPanelOpen.value = true
  isIsolated.value = true
  const bbox = new THREE.Box3()
  matches.forEach((m) => bbox.union(new THREE.Box3().setFromObject(m)))
  if (!bbox.isEmpty()) {
    focusToBox(bbox, matches.length === 1 ? activeViewConfig.value.zoom.part : activeViewConfig.value.zoom.assembly)
  }
}

function focusFault(faultId: string) {
  // Clicking a fault pin or a list row "drills into" that fault: isolate the whole
  // faulty unit (part or assembly) and open the detail panel.
  if (!modelGroup) return
  const entry = faultEntries.value.find((e) => e.id === faultId)
  if (!entry) return

  // If a deeper detail model exists, switch to it instead of isolating.
  if (!isDetailView.value && props.detailModelUrl && props.detailFaultyPart) {
    isDetailView.value = true
    loadModelFromUrl(props.detailModelUrl).then(() => {
      detailFaultName.value = props.detailFaultyPart ?? ''
      updateFaultyHighlight()
    })
    return
  }
  isolateByName(entry.partName)
}

function showAllParts() {
  if (isDetailView.value) {
    loadModelFromUrl(props.modelUrl)
    isDetailView.value = false
    detailFaultName.value = ''
    isolatedPartName.value = ''
    isolatedName.value = ''
    partDetailPanelOpen.value = false
    isIsolated.value = false
    clearHover()
    return
  }
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (isMesh(obj)) obj.visible = true
  })
  isolatedPartName.value = ''
  isolatedName.value = ''
  partDetailPanelOpen.value = false
  isIsolated.value = false
  clearHover()
  resetView()
}

function setWireframe(enabled: boolean) {
  wireframe.value = enabled
  if (!modelGroup) return
  modelGroup.traverse((obj) => {
    if (isMesh(obj)) setMaterialWireframe(obj.material, enabled)
  })
}

function toggleWireframe() {
  setWireframe(!wireframe.value)
}

function focusToBox(bbox: THREE.Box3, distanceMultiplier = activeViewConfig.value.zoom.fullModel) {
  frameCameraOnBox(camera, controls, bbox, distanceMultiplier, modelGroup, activeViewConfig.value)
}

function resetView() {
  if (!modelGroup || modelGroup.children.length === 0) return
  const bbox = new THREE.Box3().setFromObject(modelGroup)
  if (!bbox.isEmpty()) focusToBox(bbox, activeViewConfig.value.zoom.fullModel)
}

/**
 * Derive the part name (= glTF node name) for a primitive mesh.
 *
 * GLTFLoader stores the ORIGINAL (un-deduplicated) glTF node name in
 * `object.userData.name`. A multi-primitive mesh becomes a named Group (the node)
 * with that userData.name; its primitive children have no userData.name. So we walk
 * up from the mesh and return the nearest ancestor (incl. self) that carries a
 * `userData.name`, which is exactly the leaf node name (e.g. "Engine", "Front LG").
 */
function pickPartName(mesh: THREE.Object3D): string {
  let o: THREE.Object3D | null = mesh
  while (o && o !== modelGroup) {
    const n = o.userData && o.userData.name ? String(o.userData.name).trim() : ''
    if (n) return n
    o = o.parent
  }
  const meshName = (mesh.name || '').trim()
  return meshName || 'Part'
}

/**
 * Collect the full chain of glTF node names from `obj` up to (but excluding) `stop`.
 * The result is [leafName, parentAssembly, grandparentAssembly, ...], letting us match
 * a fault against either a leaf part OR any ancestor assembly name.
 */
function nodePath(obj: THREE.Object3D, stop: THREE.Object3D): string[] {
  const path: string[] = []
  let o: THREE.Object3D | null = obj
  while (o && o !== stop) {
    const n = o.userData && o.userData.name ? String(o.userData.name).trim() : ''
    if (n && !path.includes(n)) path.push(n)
    o = o.parent
  }
  return path
}

/**
 * True if `mesh` belongs to part/assembly `name`: matches its own leaf name OR any
 * ancestor assembly name stored in `userData.partPath`. This is what makes selecting a
 * whole assembly (e.g. "DC Converter Unit") highlight all of its sub-parts.
 */
function meshMatchesPart(mesh: THREE.Object3D | null, name: string): boolean {
  if (!name || !mesh) return false
  if (mesh.userData.partName === name) return true
  const path = mesh.userData.partPath
  return Array.isArray(path) && path.includes(name)
}

/**
 * True if `key` identifies this mesh either by exact node/assembly name or by FIN.
 * MFL faults arrive as a `finNumber` (e.g. "2420MG002") while the model node is named
 * "_FLT2420MG002 - INVERTER, L", so every lookup goes through the normalized FIN too.
 */
function meshMatchesKey(mesh: THREE.Object3D | null, key: string): boolean {
  if (!key || !mesh) return false
  if (meshMatchesPart(mesh, key)) return true
  const finKey = finKeyOf(key)
  if (!finKey) return false
  if (mesh.userData.partFin === finKey) return true
  const fins = mesh.userData.partFins
  return Array.isArray(fins) && fins.includes(finKey)
}

/**
 * Bake a mesh's world transform into a fresh position(+normal+index)-only geometry, so
 * all geometries of one part can be merged (mergeGeometries needs matching attributes).
 *
 * BELLEK NOTU: Burada bilerek `toNonIndexed()` KULLANMIYORUZ. De-index etmek paylaşılan
 * vertex'leri çoğaltıp vertex sayısını birkaç katına çıkarır ve büyük CAD modellerinde
 * RAM'i patlatır (sekme çöker). Index korunur; sadece position/normal/index kopyalanır
 * (uv, color, tangent gibi gereksiz attribute'lar atılır).
 */
function bakeGeometry(mesh: THREE.Mesh): THREE.BufferGeometry | null {
  const src = mesh.geometry
  if (!src) return null
  const pos = src.getAttribute('position')
  if (!pos) return null
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', pos.clone())
  const normal = src.getAttribute('normal')
  if (normal) out.setAttribute('normal', normal.clone())
  if (src.index) out.setIndex(src.index.clone())
  out.applyMatrix4(mesh.matrixWorld) // position + normal'ı world uzayına taşır
  if (!normal) out.computeVertexNormals()
  return out
}

/**
 * Bir parçaya ait geometrileri mergeGeometries için uyumlu hale getirir.
 * mergeGeometries tüm girdilerin AYNI index durumunda (hepsi indexed ya da hepsi
 * non-indexed) olmasını ister. Karışıksa (nadir) hepsini de-index ederiz; bu sadece
 * o parça için geçerli olduğundan genel bellek kazancı korunur.
 */
function normalizePartGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const anyIndexed = geoms.some((g) => g.index)
  const allIndexed = geoms.every((g) => g.index)
  if (anyIndexed && !allIndexed) {
    return geoms.map((g) => {
      const ng = g.toNonIndexed()
      if (ng !== g) g.dispose()
      return ng
    })
  }
  return geoms
}

/**
 * Render a loaded glTF/GLB into the scene.
 *
 * glTF/STEP exports often split a single part into many primitive meshes. We merge
 * all primitives that belong to the same node into ONE mesh per part, so the HMS
 * logic (fault highlight by part name, isolation, bounding-box fit) works on whole
 * parts instead of individual triangle chunks. Materials are replaced with a fresh
 * MeshStandardMaterial so per-mesh highlight/hover/transparency is safe.
 */
function renderGltf(gltf: GLTF) {
  const root = gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null)
  if (!root) throw new Error('glTF does not contain a scene.')
  if (!modelGroup) return

  root.updateMatrixWorld(true)

  const partGeoms = new Map<string, THREE.BufferGeometry[]>()
  const partPaths = new Map<string, string[]>()
  const order: string[] = []
  root.traverse((obj) => {
    if (!isMesh(obj)) return
    const partName = pickPartName(obj)
    const geom = bakeGeometry(obj)
    if (!geom) return
    if (!partGeoms.has(partName)) {
      partGeoms.set(partName, [])
      partPaths.set(partName, nodePath(obj, root))
      order.push(partName)
    }
    partGeoms.get(partName)!.push(geom)
  })

  for (const partName of order) {
    let geoms = partGeoms.get(partName)!
    if (geoms.length > 1) geoms = normalizePartGeoms(geoms)
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false)
    if (!merged) continue
    geoms.forEach((g) => { if (g !== merged) g.dispose() })

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd6d9e6),
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
      wireframe: wireframe.value
    })
    const mesh = new THREE.Mesh(merged, material)
    const path = partPaths.get(partName) || [partName]
    const parsed = parsePartName(partName)
    mesh.userData.partName = partName
    mesh.userData.partLabel = parsed.label
    mesh.userData.partFin = parsed.finKey
    mesh.userData.partPath = path
    mesh.userData.partFins = path.map((n) => parsePartName(n).finKey)
    modelGroup.add(mesh)
    meshesCount.value += 1
  }

  // FIN -> parça indeksi. Yaprak parçalar önce yazılır, ardından üst montaj adları;
  // böylece MFL `finNumber` hem tekil parçaya hem de bir montaja denk gelebilir.
  const index = new Map<string, PartInfo>()
  const addToIndex = (name: string) => {
    const parsed = parsePartName(name)
    if (!parsed.finKey || index.has(parsed.finKey)) return
    index.set(parsed.finKey, {
      name,
      label: parsed.label,
      fin: parsed.fin,
      hasFin: parsed.hasFin
    })
  }
  for (const partName of order) addToIndex(partName)
  for (const partName of order) (partPaths.get(partName) || []).forEach(addToIndex)
  partIndex.value = index

  // Free the original (now-unused) glTF scene resources.
  root.traverse((obj) => {
    if (isMesh(obj)) {
      obj.geometry?.dispose()
      disposeMaterial(obj.material)
    }
  })

  partNames.value = order.slice().sort((a, b) => a.localeCompare(b))

  transparentOthers.value = activeFaultNames.value.length > 0
  updateFaultyHighlight()

  modelGroup.updateMatrixWorld(true)
  const fitBox = new THREE.Box3().setFromObject(modelGroup)
  if (!fitBox.isEmpty()) focusToBox(fitBox, activeViewConfig.value.zoom.fullModel)
}

async function loadModelFromUrl(url: string) {
  if (!url) return
  errorText.value = ''
  statusText.value = 'Loading model...'
  clearModel()
  try {
    const gltf = await gltfLoader.loadAsync(url)
    renderGltf(gltf)
    setWireframe(wireframe.value)
    statusText.value = `Loaded. Mesh count: ${meshesCount.value}`
  } catch (e) {
    console.error(e)
    errorText.value = (e instanceof Error && e.message) || String(e)
    statusText.value = ''
  }
}

onMounted(() => {
  initThree()
  disposeStageBg = observeStageBackground(() => scene, () => stageRef.value)
  loadModelFromUrl(props.modelUrl)
})

onBeforeUnmount(() => {
  disposeStageBg?.()
  window.removeEventListener('resize', onResize)
  if (rafId) cancelAnimationFrame(rafId)
  const canvas = canvasEl.value
  if (canvas) {
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('pointerdown', onPointerDown)
  }
  viewportGizmo?.dispose()
  controls?.dispose()
  renderer?.dispose()
  viewportGizmo = null
  scene = camera = renderer = controls = modelGroup = null
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
}

.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.status {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.statusText {
  color: var(--text-primary);
  font-weight: 700;
}

.errorText {
  margin-top: 6px;
  color: #ef4444;
  font-weight: 700;
}

.stage-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  height: min(72vh, 720px);
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--border-color);
}

.stage-wrapper-split {
  flex-direction: row;
  align-items: stretch;
}

.stage-wrapper-split .stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 0;
  border: none;
  border-right: 1px solid var(--border-color);
}

.stage-wrapper-split .part-detail-panel {
  flex-shrink: 0;
  min-height: 0;
  max-height: 100%;
  border-radius: 0;
  border: none;
}

.part-detail-panel {
  container-type: inline-size;
  container-name: part-detail;
  min-width: 260px;
  max-width: 100%;
  padding: 20px 18px;
  background: var(--bg-primary);
  overflow-y: auto;
  overflow-x: hidden;
}

/*
 * Kol panelin İÇİNDE değil, wrapper'a göre konumlanır: panel dikey kayan bir kap
 * olduğu için içine konsaydı içerikle birlikte kayıp gözden kaybolurdu.
 */
.part-detail-resizer {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
  transition: background 0.12s ease;
  z-index: 10;
}

.part-detail-resizer:hover,
.part-detail-resizer:active {
  background: rgba(37, 99, 235, 0.35);
}

.part-detail-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.part-detail-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.part-detail-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--color-primary-600);
}

.part-fin-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 4px;
  color: #b91c1c;
  background: rgba(220, 38, 38, 0.12);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.part-detail-name {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--text-primary);
  word-break: break-word;
}

.part-detail-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/*
 * Etiket ve değer, aralarındaki boşluk komşu satırlarınkinden belirgin şekilde küçük
 * tutularak ve her satır ince bir çizgiyle ayrılarak görsel olarak eşleştirilir.
 */
.part-detail-list {
  margin: 0;
}

.part-detail-list dt {
  margin: 0 0 3px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.part-detail-list dd {
  margin: 0 0 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
  word-break: break-word;
}

.part-detail-list dd:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

/*
 * Panel yeterince genişletildiğinde etiketler sola hizalı ayrı bir sütuna geçer; dar
 * kaldığında üstteki dikey düzen korunur. Container query desteklenmeyen tarayıcıda
 * dikey düzen kullanılmaya devam eder.
 */
@container part-detail (min-width: 360px) {
  .part-detail-list {
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr);
    align-items: baseline;
  }

  .part-detail-list dt {
    margin: 0;
    padding: 9px 12px 9px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .part-detail-list dd {
    margin: 0;
    padding: 9px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .part-detail-list dt:first-of-type,
  .part-detail-list dd:first-of-type {
    padding-top: 0;
  }

  .part-detail-list dt:last-of-type,
  .part-detail-list dd:last-of-type {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.detail-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.detail-section-title::before {
  content: '';
  flex-shrink: 0;
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: var(--color-primary-600);
}

/* Soldaki renkli şerit, kayıtları severity'ye göre göz gezdirerek ayırt etmeyi sağlar. */
.mfl-block {
  padding: 12px 14px;
  margin-bottom: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--border-color);
  border-radius: 8px;
}

.mfl-block:last-child {
  margin-bottom: 0;
}

.mfl-block.is-critical {
  border-left-color: #dc2626;
}

.mfl-block.is-high {
  border-left-color: #ea580c;
}

.mfl-block.is-medium {
  border-left-color: #ca8a04;
}

.mfl-block.is-low {
  border-left-color: #0284c7;
}

.mfl-index {
  margin-bottom: 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.mfl-severity {
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mfl-severity.is-critical {
  color: #dc2626;
}

.mfl-severity.is-high {
  color: #ea580c;
}

.mfl-severity.is-medium {
  color: #ca8a04;
}

.mfl-severity.is-low {
  color: #0284c7;
}

.stage {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(1200px 600px at 50% 60%, rgba(59, 130, 246, 0.12), var(--bg-tertiary));
}

.stage-wrapper:not(.stage-wrapper-split) .stage {
  border-radius: 14px;
}

.fault-label-overlay {
  position: absolute;
  transform: translate(-50%, 0);
  pointer-events: none;
  z-index: 7;
}

.fault-pin {
  position: absolute;
  /* Small + semi-transparent by default so it does not hide the faulty part. */
  transform: translate(-50%, -50%) scale(0.7);
  opacity: 0.5;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #dc2626;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(185, 28, 28, 0.45);
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
}

.fault-pin:hover,
.fault-pin.active {
  /* On hover/selection: grow to full size and become fully opaque. */
  transform: translate(-50%, -50%) scale(1.25);
  opacity: 1;
  box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(185, 28, 28, 0.5);
  z-index: 8;
}

.fault-list-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  min-width: 200px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 6px 20px var(--shadow-color);
  overflow: hidden;
  z-index: 9;
}

.fault-list-title {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #ef4444;
  background: rgba(220, 38, 38, 0.1);
  border-bottom: 1px solid rgba(220, 38, 38, 0.28);
}

.fault-list {
  margin: 0;
  /* Sağdaki boşluk, kaydırma çubuğunun sürükleme kolunun altında kalmasını önler. */
  margin-right: 8px;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
}

.fault-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.fault-list-item:hover,
.fault-list-item.active {
  background: rgba(220, 38, 38, 0.1);
}

.fault-list-item.active {
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.28);
}

.fault-list-num {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fault-list-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.fault-list-fin {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: #ef4444;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fault-list-name {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fault-list-count {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-muted);
  background: var(--hover-bg, rgba(120, 120, 120, 0.15));
}

.fault-list-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
  transition: background 0.12s ease;
}

.fault-list-resizer:hover,
.fault-list-resizer:active {
  background: linear-gradient(to right, transparent, rgba(220, 38, 38, 0.35));
}

.fault-list-status {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  border-radius: 4px;
}

.fault-list-status.is-fault {
  color: #b91c1c;
  background: #fee2e2;
}

.fault-list-status.is-warning {
  color: #92400e;
  background: #fef3c7;
}

.fault-label-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  margin-left: -1px;
  width: 2px;
  height: 50px;
  background: #b91c1c;
  border-radius: 1px;
}

.fault-label-box {
  position: absolute;
  bottom: 52px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 200px;
  max-width: 320px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border: 1px solid #dc2626;
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--shadow-color);
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.45;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.fault-label-box::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -6px;
  border: 6px solid transparent;
  border-top-color: #b91c1c;
}

.fault-card-row {
  margin-bottom: 6px;
}
.fault-card-row:last-child {
  margin-bottom: 0;
}

.fault-card-fin {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: #ef4444;
  border-bottom: 1px solid rgba(220, 38, 38, 0.28);
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.fault-card-label {
  font-weight: 600;
  color: var(--text-muted);
  margin-right: 4px;
}

.fault-card-status {
  font-weight: 700;
  color: #b91c1c;
  letter-spacing: 0.03em;
}

.fault-card-desc {
  white-space: normal;
  word-break: break-word;
  font-size: 11px;
  color: var(--text-primary);
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
}

.fault-card-desc .fault-card-label {
  display: block;
  margin-bottom: 2px;
}

.fault-card-hint {
  color: var(--text-muted);
  font-style: italic;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
