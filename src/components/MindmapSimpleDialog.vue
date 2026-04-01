<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import MindMap from 'simple-mind-map/full.js'
import 'simple-mind-map/dist/simpleMindMap.esm.css'

interface MindmapRootNode {
  data: {
    text: string
    expand?: boolean
    richText?: boolean
    resetRichText?: boolean
    dir?: 'left' | 'right'
    [key: string]: unknown
  }
  children?: MindmapRootNode[]
}

interface MindmapFullScene {
  layout?: string
  root?: MindmapRootNode
  theme?: {
    template?: string
    config?: Record<string, unknown>
  }
  view?: unknown
}

interface MindmapSavePayload {
  title: string
  previewUrl: string
  scene: MindmapFullScene
}

interface MindmapNodeInstance {
  uid?: string
  isRoot?: boolean
  getData: (key?: string) => unknown
  getStyle: (prop: string, root?: boolean) => unknown
}

interface MindmapNodeStyleForm {
  text: string
  textColor: string
  fontSize: number
  fillColor: string
  lineColor: string
}

interface MindmapTemplateChild {
  data: {
    text: string
    expand?: boolean
    richText?: boolean
    resetRichText?: boolean
    dir?: 'left' | 'right'
    [key: string]: unknown
  }
  children?: MindmapTemplateChild[]
}

interface MindmapTemplateItem {
  key: string
  label: string
  text: string
  hint: 'topic' | 'todo' | 'idea' | 'question' | 'decision' | 'summary' | 'branch'
  children?: MindmapTemplateChild[]
}

const templateItems: MindmapTemplateItem[] = [
  { key: 'topic', label: '主题', text: '新主题', hint: 'topic' },
  { key: 'todo', label: '待办', text: '待办事项', hint: 'todo' },
  { key: 'idea', label: '想法', text: '创意想法', hint: 'idea' },
  { key: 'question', label: '问题', text: '待确认问题', hint: 'question' },
  { key: 'decision', label: '决策', text: '决策结论', hint: 'decision' },
  { key: 'summary', label: '总结', text: '阶段总结', hint: 'summary' },
  {
    key: 'branch',
    label: '双分支',
    text: '分支主题',
    hint: 'branch',
    children: [{ data: { text: '分支 A', expand: true } }, { data: { text: '分支 B', expand: true } }],
  },
]

const templateItemMap = new Map<string, MindmapTemplateItem>(templateItems.map((item) => [item.key, item]))
const DEFAULT_MINDMAP_LAYOUT = 'mindMap'

const props = defineProps<{
  mode: 'insert' | 'edit'
  title: string
  initialScene: unknown
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'save', payload: MindmapSavePayload): void
}>()

const hostRef = ref<HTMLDivElement | null>(null)
const canvasWrapRef = ref<HTMLDivElement | null>(null)
const titleInput = ref(props.title || '思维导图')
const saving = ref(false)
const exporting = ref(false)
const error = ref('')
const isFullscreen = ref(false)
const zoomPercent = ref(100)
const jsonVisible = ref(false)
const jsonContent = ref('')
const jsonCopied = ref(false)
const draggingTemplateKey = ref<string | null>(null)
const canvasDropActive = ref(false)
const selectedNodeUid = ref('')
const selectedNodeIsRoot = ref(false)
const nodeStyleForm = ref<MindmapNodeStyleForm>(createDefaultNodeStyleForm())
const contextMenuRef = ref<HTMLDivElement | null>(null)
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTargetIsRoot = ref(false)

let mindMap: MindMap | null = null
let selectedNode: MindmapNodeInstance | null = null
let copyTimer: ReturnType<typeof setTimeout> | null = null
let scaleListener: (() => void) | null = null
let dataChangeListener: (() => void) | null = null
let nodeActiveListener: ((node: unknown, activeNodeList: unknown) => void) | null = null
let drawClickListener: (() => void) | null = null
let nodeContextmenuListener: ((event: unknown, node: unknown) => void) | null = null
let contextmenuListener: ((event: unknown) => void) | null = null
let globalPointerListener: ((event: MouseEvent) => void) | null = null

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑思维导图（simple-mind-map）' : '插入思维导图（simple-mind-map）'))
const confirmText = computed(() => {
  if (saving.value) return '保存中...'
  return props.mode === 'edit' ? '保存' : '插入'
})
const fullscreenButtonText = computed(() => (isFullscreen.value ? '退出全屏' : '全屏编辑'))
const exportButtonText = computed(() => (exporting.value ? '导出中...' : '导出图片'))
const jsonButtonText = computed(() => (jsonVisible.value ? '刷新 JSON' : '查看 JSON'))
const hasSelectedNode = computed(() => Boolean(selectedNodeUid.value))
const nodeTypeLabel = computed(() => (selectedNodeIsRoot.value ? '中心主题' : '分支主题'))
const contextMenuTip = computed(() => (contextMenuTargetIsRoot.value ? '中心主题不可删除' : '可新增子节点/同级节点，或删除当前节点'))

watch(
  () => props.title,
  (value) => {
    titleInput.value = value || '思维导图'
  }
)

/**
 * Handle createDefaultNodeStyleForm logic.
 * @returns Return value.
 */
function createDefaultNodeStyleForm(): MindmapNodeStyleForm {
  return {
    text: '',
    textColor: '#2b3d55',
    fontSize: 16,
    fillColor: '#ffffff',
    lineColor: '#549688',
  }
}

/**
 * Handle createPlainNodeData logic.
 * @param text - Parameter.
 * @param extra - Parameter.
 * @returns Return value.
 */
function createPlainNodeData(text: string, extra: Partial<MindmapRootNode['data']> = {}): MindmapRootNode['data'] {
  return {
    text,
    expand: true,
    richText: false,
    resetRichText: true,
    ...extra,
  }
}

/**
 * Handle createDefaultRoot logic.
 * @returns Return value.
 */
function createDefaultRoot(): MindmapRootNode {
  return {
    data: createPlainNodeData('中心主题'),
    children: [
      {
        data: createPlainNodeData('分支主题 A', { dir: 'right' }),
      },
      {
        data: createPlainNodeData('分支主题 B', { dir: 'left' }),
      },
    ],
  }
}

function cloneScene<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

/**
 * Handle toClampedNumber logic.
 * @param value - Parameter.
 * @param fallback - Parameter.
 * @param min - Parameter.
 * @param max - Parameter.
 * @returns Return value.
 */
function toClampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

/**
 * Handle rgbToHex logic.
 * @param r - Parameter.
 * @param g - Parameter.
 * @param b - Parameter.
 * @returns Return value.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(channel)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Handle normalizeColor logic.
 * @param value - Parameter.
 * @param fallback - Parameter.
 * @returns Return value.
 */
function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback

  const normalized = value.trim()
  if (!normalized) return fallback

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase()
  }

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase()
  }

  if (typeof document === 'undefined') return fallback

  const probe = document.createElement('span')
  probe.style.color = normalized
  document.body.appendChild(probe)
  const computed = window.getComputedStyle(probe).color
  probe.remove()

  const match = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!match) return fallback

  const r = Number(match[1])
  const g = Number(match[2])
  const b = Number(match[3])
  if (![r, g, b].every((channel) => Number.isFinite(channel))) return fallback

  return rgbToHex(r, g, b)
}

/**
 * Handle toPlainNodeText logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function toPlainNodeText(value: unknown): string {
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return ''
    if (!raw.includes('<')) return raw

    try {
      const container = document.createElement('div')
      container.innerHTML = raw
      return (container.textContent || '').trim()
    } catch {
      return raw.replace(/<[^>]+>/g, '').trim()
    }
  }

  if (value && typeof value === 'object') {
    const maybeValue = (value as { value?: unknown }).value
    if (typeof maybeValue === 'string') {
      return toPlainNodeText(maybeValue)
    }
  }

  return ''
}

/**
 * Handle sanitizeRootNode logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function sanitizeRootNode(value: unknown): MindmapRootNode {
  const sanitizeNode = (nodeValue: unknown, fallbackText: string): MindmapRootNode => {
    if (!nodeValue || typeof nodeValue !== 'object') {
      return {
        data: createPlainNodeData(fallbackText),
        children: [],
      }
    }

    const rawNode = cloneScene(nodeValue as MindmapRootNode) as MindmapRootNode
    const rawData =
      rawNode.data && typeof rawNode.data === 'object'
        ? rawNode.data
        : ({
            text: fallbackText,
          } as MindmapRootNode['data'])

    const text = toPlainNodeText(rawData.text)
    const dir = rawData.dir === 'left' || rawData.dir === 'right' ? rawData.dir : undefined
    const normalizedData = createPlainNodeData(text || fallbackText, dir ? { dir } : {})

    Object.keys(rawData).forEach((key) => {
      if (key === 'text' || key === 'expand' || key === 'richText' || key === 'resetRichText' || key === 'dir') return
      normalizedData[key] = rawData[key]
    })

    if (typeof rawData.expand === 'boolean') {
      normalizedData.expand = rawData.expand
    }
    rawNode.data = normalizedData

    const rawChildren = Array.isArray(rawNode.children) ? rawNode.children : []
    rawNode.children = rawChildren
      .filter((child) => Boolean(child) && typeof child === 'object')
      .map((child) => sanitizeNode(child, '分支主题'))

    return rawNode
  }

  return sanitizeNode(value, '中心主题')
}

/**
 * Handle normalizeScene logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function normalizeScene(value: unknown): MindmapFullScene {
  const fallback: MindmapFullScene = {
    layout: DEFAULT_MINDMAP_LAYOUT,
    root: createDefaultRoot(),
  }

  if (!value || typeof value !== 'object') return fallback

  const raw = toRaw(value as object) as Record<string, unknown>

  if (raw.root && typeof raw.root === 'object') {
    return {
      layout: typeof raw.layout === 'string' ? raw.layout : DEFAULT_MINDMAP_LAYOUT,
      root: sanitizeRootNode(raw.root),
      theme: raw.theme && typeof raw.theme === 'object' ? cloneScene(raw.theme as MindmapFullScene['theme']) : undefined,
      view: raw.view ? cloneScene(raw.view) : undefined,
    }
  }

  if (raw.data && typeof raw.data === 'object') {
    return {
      layout: DEFAULT_MINDMAP_LAYOUT,
      root: sanitizeRootNode(raw),
    }
  }

  return fallback
}

/**
 * Handle getRootNode logic.
 * @returns Return value.
 */
function getRootNode(): MindmapNodeInstance | null {
  const root = (mindMap as unknown as { renderer?: { root?: MindmapNodeInstance } })?.renderer?.root
  return root ?? null
}

/**
 * Handle getActiveNodes logic.
 * @returns Return value.
 */
function getActiveNodes(): MindmapNodeInstance[] {
  const list = (mindMap as unknown as { renderer?: { activeNodeList?: MindmapNodeInstance[] } })?.renderer?.activeNodeList
  return Array.isArray(list) ? list : []
}

/**
 * Handle findNodeByUid logic.
 * @param uid - Parameter.
 * @returns Return value.
 */
function findNodeByUid(uid: string): MindmapNodeInstance | null {
  if (!uid) return null
  const renderer = (mindMap as unknown as { renderer?: { findNodeByUid?: (id: string) => MindmapNodeInstance | null } })?.renderer
  if (!renderer?.findNodeByUid) return null
  return renderer.findNodeByUid(uid) ?? null
}

/**
 * Handle isMindmapNode logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function isMindmapNode(value: unknown): value is MindmapNodeInstance {
  if (!value || typeof value !== 'object') return false
  const candidate = value as MindmapNodeInstance
  return typeof candidate.getData === 'function' && typeof candidate.getStyle === 'function'
}

/**
 * Handle readNodeStyle logic.
 * @param node - Parameter.
 * @returns Return value.
 */
function readNodeStyle(node: MindmapNodeInstance): MindmapNodeStyleForm {
  const fallback = createDefaultNodeStyleForm()
  const text = toPlainNodeText(node.getData('text'))
  const textColor = normalizeColor(node.getStyle('color'), fallback.textColor)
  const fontSize = toClampedNumber(node.getStyle('fontSize'), fallback.fontSize, 10, 72)
  const fillColor = normalizeColor(node.getStyle('fillColor'), fallback.fillColor)
  const lineColor = normalizeColor(node.getStyle('lineColor'), fallback.lineColor)

  return {
    text,
    textColor,
    fontSize,
    fillColor,
    lineColor,
  }
}

/**
 * Handle setSelection logic.
 * @param node - Parameter.
 */
function setSelection(node: MindmapNodeInstance | null) {
  selectedNode = node
  if (!node) {
    selectedNodeUid.value = ''
    selectedNodeIsRoot.value = false
    nodeStyleForm.value = createDefaultNodeStyleForm()
    return
  }

  selectedNodeUid.value = String(node.uid ?? node.getData('uid') ?? '')
  selectedNodeIsRoot.value = Boolean(node.isRoot)
  nodeStyleForm.value = readNodeStyle(node)
}

/**
 * Handle getPrimaryTargetNode logic.
 * @returns Return value.
 */
function getPrimaryTargetNode(): MindmapNodeInstance | null {
  if (selectedNode) return selectedNode
  const active = getActiveNodes()
  if (active.length > 0) return active[0]
  return getRootNode()
}

/**
 * Handle hideContextMenu logic.
 */
function hideContextMenu() {
  contextMenuVisible.value = false
}

/**
 * Handle isMouseEventLike logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function isMouseEventLike(value: unknown): value is MouseEvent {
  if (!value || typeof value !== 'object') return false
  const candidate = value as MouseEvent
  return typeof candidate.clientX === 'number' && typeof candidate.clientY === 'number'
}

/**
 * Handle clampContextMenuWithinCanvas logic.
 */
function clampContextMenuWithinCanvas() {
  const wrap = canvasWrapRef.value
  const menu = contextMenuRef.value
  if (!wrap || !menu) return

  const minPadding = 8
  const maxX = Math.max(minPadding, wrap.clientWidth - menu.offsetWidth - minPadding)
  const maxY = Math.max(minPadding, wrap.clientHeight - menu.offsetHeight - minPadding)
  contextMenuX.value = Math.min(maxX, Math.max(minPadding, contextMenuX.value))
  contextMenuY.value = Math.min(maxY, Math.max(minPadding, contextMenuY.value))
}

/**
 * Handle openContextMenu logic.
 * @param event - Parameter.
 * @param node - Parameter.
 */
function openContextMenu(event: MouseEvent, node: MindmapNodeInstance | null) {
  if (saving.value) return
  event.preventDefault()
  event.stopPropagation()

  if (node) {
    setSelection(node)
    contextMenuTargetIsRoot.value = Boolean(node.isRoot)
  } else {
    contextMenuTargetIsRoot.value = selectedNodeIsRoot.value
  }

  const wrap = canvasWrapRef.value
  if (!(wrap instanceof HTMLElement)) {
    contextMenuX.value = 16
    contextMenuY.value = 16
    contextMenuVisible.value = true
    return
  }

  const rect = wrap.getBoundingClientRect()
  const rawX = event.clientX - rect.left + wrap.scrollLeft
  const rawY = event.clientY - rect.top + wrap.scrollTop

  contextMenuX.value = rawX
  contextMenuY.value = rawY
  contextMenuVisible.value = true
  void nextTick(() => {
    clampContextMenuWithinCanvas()
  })
}

/**
 * Handle getFullScene logic.
 * @returns Return value.
 */
function getFullScene(): MindmapFullScene {
  if (!mindMap) {
    return {
      layout: DEFAULT_MINDMAP_LAYOUT,
      root: createDefaultRoot(),
    }
  }

  try {
    const scene = mindMap.getData(true) as MindmapFullScene
    if (scene && scene.root) {
      const normalized = cloneScene(scene)
      normalized.root = sanitizeRootNode(normalized.root)
      return normalized
    }
  } catch {
    // ignore and fallback
  }

  return {
    layout: DEFAULT_MINDMAP_LAYOUT,
    root: createDefaultRoot(),
  }
}

/**
 * Handle disableRichTextPlugin logic.
 * @param instance - Parameter.
 */
function disableRichTextPlugin(instance: MindMap) {
  const richTextInstance = (instance as unknown as { richText?: { constructor?: unknown } }).richText
  const removePlugin = (instance as unknown as { removePlugin?: (plugin: unknown) => void }).removePlugin
  if (!richTextInstance?.constructor || typeof removePlugin !== 'function') return

  removePlugin.call(instance, richTextInstance.constructor)
}

/**
 * Handle disableScrollbarPlugin logic.
 * @param instance - Parameter.
 */
function disableScrollbarPlugin(instance: MindMap) {
  // simple-mind-map scrollbar plugin may call getBBox() on detached SVG groups.
  const scrollbarInstance = (instance as unknown as { scrollbar?: { constructor?: unknown } }).scrollbar
  const removePlugin = (instance as unknown as { removePlugin?: (plugin: unknown) => void }).removePlugin
  if (!scrollbarInstance?.constructor || typeof removePlugin !== 'function') return

  try {
    removePlugin.call(instance, scrollbarInstance.constructor)
  } catch {
    // Ignore plugin detach failure and continue with editor usage.
  }
}

/**
 * Handle guardScrollbarUpdate logic.
 * @param instance - Parameter.
 */
function guardScrollbarUpdate(instance: MindMap) {
  // Defensive guard for runtime environments where SVG getBBox can throw.
  const scrollbar = (instance as unknown as { scrollbar?: { updateScrollbar?: (...args: unknown[]) => unknown } }).scrollbar
  if (!scrollbar || typeof scrollbar.updateScrollbar !== 'function') return

  const rawUpdate = scrollbar.updateScrollbar.bind(scrollbar)
  scrollbar.updateScrollbar = (...args: unknown[]) => {
    try {
      return rawUpdate(...args)
    } catch {
      return null
    }
  }
}

/**
 * Handle updateZoomPercent logic.
 */
function updateZoomPercent() {
  const scale = Number(mindMap?.view?.scale)
  zoomPercent.value = Number.isFinite(scale) ? Math.round(scale * 100) : 100
}

/**
 * Handle refreshJson logic.
 */
function refreshJson() {
  jsonContent.value = JSON.stringify(getFullScene(), null, 2)
}

/**
 * Handle onCancel logic.
 */
function onCancel() {
  if (saving.value) return
  emit('cancel')
}

/**
 * Handle toggleFullscreen logic.
 */
function toggleFullscreen() {
  if (saving.value) return
  isFullscreen.value = !isFullscreen.value
  requestAnimationFrame(() => {
    fitToView()
  })
}

/**
 * Handle zoomIn logic.
 */
function zoomIn() {
  if (!mindMap || saving.value) return
  mindMap.view.enlarge(undefined, undefined, false)
  updateZoomPercent()
}

/**
 * Handle zoomOut logic.
 */
function zoomOut() {
  if (!mindMap || saving.value) return
  mindMap.view.narrow(undefined, undefined, false)
  updateZoomPercent()
}

/**
 * Handle fitToView logic.
 */
function fitToView() {
  if (!mindMap || saving.value) return
  mindMap.view.fit(() => {}, false, undefined)
  updateZoomPercent()
}

/**
 * Handle normalizeExportDataUrl logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function normalizeExportDataUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

/**
 * Handle buildSvgDataUrl logic.
 * @param svgText - Parameter.
 * @returns Return value.
 */
function buildSvgDataUrl(svgText: string): string {
  const normalized = svgText.trim()
  if (!normalized) return ''
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`
}

/**
 * Handle getMindmapSvgSnapshot logic.
 * @param padding - Parameter.
 * @returns Return value.
 */
function getMindmapSvgSnapshot(padding = 24): string {
  if (!mindMap) return ''

  const instance = mindMap as unknown as {
    getSvgData?: (options?: Record<string, unknown>) => {
      svgHTML?: string
      svg?: { svg?: () => string }
    }
  }

  if (typeof instance.getSvgData !== 'function') return ''

  try {
    const result = instance.getSvgData({
      paddingX: padding,
      paddingY: padding,
      ignoreWatermark: true,
    })

    if (result && typeof result.svgHTML === 'string' && result.svgHTML.trim()) {
      return result.svgHTML
    }

    const svgObj = result?.svg
    if (svgObj && typeof svgObj.svg === 'function') {
      const svgText = svgObj.svg()
      return typeof svgText === 'string' ? svgText : ''
    }
  } catch {
    // ignore and fallback
  }

  return ''
}

/**
 * Handle captureLiveSvgPreviewDataUrl logic.
 * @returns Return value.
 */
function captureLiveSvgPreviewDataUrl(): string {
  const host = hostRef.value
  if (!host) return ''

  const svg = host.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) return ''

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  let viewBox = ''
  try {
    const box = svg.getBBox()
    if (Number.isFinite(box.width) && Number.isFinite(box.height) && box.width > 0 && box.height > 0) {
      const padding = 24
      const x = Math.floor(box.x - padding)
      const y = Math.floor(box.y - padding)
      const width = Math.ceil(box.width + padding * 2)
      const height = Math.ceil(box.height + padding * 2)
      viewBox = `${x} ${y} ${Math.max(1, width)} ${Math.max(1, height)}`
    }
  } catch {
    // ignore
  }

  if (!viewBox) {
    const rect = svg.getBoundingClientRect()
    const fallbackWidth = Math.max(1, Math.round(rect.width) || 1)
    const fallbackHeight = Math.max(1, Math.round(rect.height) || 1)
    viewBox = `0 0 ${fallbackWidth} ${fallbackHeight}`
  }

  clone.setAttribute('viewBox', viewBox)
  const parts = viewBox.split(/\s+/)
  if (parts.length === 4) {
    const width = Number(parts[2])
    const height = Number(parts[3])
    if (Number.isFinite(width) && width > 0) clone.setAttribute('width', String(Math.round(width)))
    if (Number.isFinite(height) && height > 0) clone.setAttribute('height', String(Math.round(height)))
  }

  try {
    const serialized = new XMLSerializer().serializeToString(clone)
    return buildSvgDataUrl(serialized)
  } catch {
    return ''
  }
}

/**
 * Handle waitForMindmapRenderReady logic.
 * @returns Return value.
 */
async function waitForMindmapRenderReady(): Promise<void> {
  if (!mindMap) return

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

  await new Promise<void>((resolve) => {
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      resolve()
    }

    try {
      mindMap?.render(() => done())
    } catch {
      done()
      return
    }

    window.setTimeout(done, 120)
  })
}

/**
 * Handle trimImageByContent logic.
 * @param dataUrl - Parameter.
 * @param padding - Parameter.
 * @returns Return value.
 */
async function trimImageByContent(dataUrl: string, padding = 20): Promise<string> {
  if (!dataUrl) return ''

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('预览图加载失败'))
    img.src = dataUrl
  })

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.naturalWidth || image.width
  sourceCanvas.height = image.naturalHeight || image.height
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return dataUrl

  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) return dataUrl
  sourceCtx.drawImage(image, 0, 0)

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const pixels = imageData.data

  const bgR = pixels[0] ?? 0
  const bgG = pixels[1] ?? 0
  const bgB = pixels[2] ?? 0
  const bgA = pixels[3] ?? 0

  let minX = sourceCanvas.width
  let minY = sourceCanvas.height
  let maxX = -1
  let maxY = -1
  const hasVisibleAlphaBg = bgA > 8

  for (let y = 0; y < sourceCanvas.height; y += 1) {
    for (let x = 0; x < sourceCanvas.width; x += 1) {
      const offset = (y * sourceCanvas.width + x) * 4
      const r = pixels[offset] ?? 0
      const g = pixels[offset + 1] ?? 0
      const b = pixels[offset + 2] ?? 0
      const a = pixels[offset + 3] ?? 0
      if (a <= 8) continue

      let isContent = true
      if (hasVisibleAlphaBg) {
        const delta = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) + Math.abs(a - bgA)
        isContent = delta > 24
      }
      if (!isContent) continue

      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) {
    return ''
  }

  const cropLeft = Math.max(0, minX - padding)
  const cropTop = Math.max(0, minY - padding)
  const cropRight = Math.min(sourceCanvas.width - 1, maxX + padding)
  const cropBottom = Math.min(sourceCanvas.height - 1, maxY + padding)
  const cropWidth = Math.max(1, cropRight - cropLeft + 1)
  const cropHeight = Math.max(1, cropBottom - cropTop + 1)

  if (cropWidth === sourceCanvas.width && cropHeight === sourceCanvas.height) {
    return dataUrl
  }

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = cropWidth
  outputCanvas.height = cropHeight
  const outputCtx = outputCanvas.getContext('2d')
  if (!outputCtx) return dataUrl

  outputCtx.drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  )

  return outputCanvas.toDataURL('image/png')
}

/**
 * Handle ensurePreviewHasContent logic.
 * @param dataUrl - Parameter.
 * @param padding - Parameter.
 * @returns Return value.
 */
async function ensurePreviewHasContent(dataUrl: string, padding = 24): Promise<string> {
  const normalized = normalizeExportDataUrl(dataUrl)
  if (!normalized) return ''

  try {
    const trimmed = await trimImageByContent(normalized, padding)
    if (trimmed) return trimmed
  } catch {
    // ignore and fallback
  }

  return ''
}

/**
 * Handle exportSvgDataUrl logic.
 * @param fileName - Parameter.
 * @returns Return value.
 */
async function exportSvgDataUrl(fileName: string): Promise<string> {
  if (!mindMap) return ''
  const safeName = fileName.trim() || '思维导图'
  try {
    const svgDataUrl = await mindMap.export('svg', false, safeName)
    return normalizeExportDataUrl(svgDataUrl)
  } catch {
    return ''
  }
}

/**
 * Handle exportPngDataUrl logic.
 * @param fileName - Parameter.
 * @param transparent - Parameter.
 * @returns Return value.
 */
async function exportPngDataUrl(fileName: string, transparent = false): Promise<string> {
  if (!mindMap) return ''
  const safeName = fileName.trim() || '思维导图'
  try {
    const pngDataUrl = await mindMap.export('png', false, safeName, transparent)
    return normalizeExportDataUrl(pngDataUrl)
  } catch {
    return ''
  }
}

/**
 * Handle exportPreviewDataUrl logic.
 * @param fileName - Parameter.
 * @returns Return value.
 */
async function exportPreviewDataUrl(fileName: string): Promise<string> {
  if (!mindMap) return ''
  const safeName = fileName.trim() || '思维导图'

  const svgSnapshot = getMindmapSvgSnapshot(24)
  if (svgSnapshot) {
    const dataUrl = buildSvgDataUrl(svgSnapshot)
    const checked = await ensurePreviewHasContent(dataUrl, 24)
    if (checked) return checked
  }

  const transparentPng = await exportPngDataUrl(safeName, true)
  if (transparentPng) {
    const checked = await ensurePreviewHasContent(transparentPng, 24)
    if (checked) return checked
  }

  const fullPng = await exportPngDataUrl(safeName, false)
  if (fullPng) {
    const checked = await ensurePreviewHasContent(fullPng, 24)
    if (checked) return checked
  }

  const exportedSvg = await exportSvgDataUrl(safeName)
  if (exportedSvg) {
    const checked = await ensurePreviewHasContent(exportedSvg, 24)
    if (checked) return checked
  }

  const liveSvg = captureLiveSvgPreviewDataUrl()
  if (liveSvg) {
    const checked = await ensurePreviewHasContent(liveSvg, 24)
    if (checked) return checked
  }

  return ''
}

/**
 * Handle undo logic.
 */
function undo() {
  if (!mindMap || saving.value) return
  mindMap.execCommand('BACK')
}

/**
 * Handle redo logic.
 */
function redo() {
  if (!mindMap || saving.value) return
  mindMap.execCommand('FORWARD')
}

/**
 * Handle setDefaultScene logic.
 */
function setDefaultScene() {
  if (!mindMap || saving.value) return
  mindMap.setData(createDefaultRoot())
  const root = getRootNode()
  setSelection(root)
  fitToView()
}

/**
 * Handle clearScene logic.
 */
function clearScene() {
  if (!mindMap || saving.value) return
  mindMap.setData({
    data: createPlainNodeData('中心主题'),
    children: [],
  })
  const root = getRootNode()
  setSelection(root)
  fitToView()
}

/**
 * Handle createInsertNodeData logic.
 * @param text - Parameter.
 * @param extras - Parameter.
 */
function createInsertNodeData(text: string, extras: Partial<MindmapRootNode['data']> = {}) {
  return createPlainNodeData(text, {
    ...extras,
  })
}

/**
 * Handle insertTemplateNode logic.
 * @param item - Parameter.
 * @param mode - Parameter.
 */
function insertTemplateNode(item: MindmapTemplateItem, mode: 'child' | 'sibling' = 'child') {
  if (!mindMap || saving.value) return

  const targetNode = getPrimaryTargetNode()
  if (!targetNode) {
    error.value = '未找到可插入的目标节点'
    return
  }

  const children = item.children ? cloneScene(item.children) : []
  const insertData = createInsertNodeData(item.text)

  if (mode === 'sibling' && !targetNode.isRoot) {
    mindMap.execCommand('INSERT_NODE', false, [targetNode], insertData, children)
  } else {
    mindMap.execCommand('INSERT_CHILD_NODE', false, [targetNode], insertData, children)
  }

  error.value = ''
}

/**
 * Handle addChildNodeQuick logic.
 */
function addChildNodeQuick() {
  insertTemplateNode({ key: 'quick-child', label: '子节点', text: '子主题', hint: 'topic' }, 'child')
}

/**
 * Handle addSiblingNodeQuick logic.
 */
function addSiblingNodeQuick() {
  insertTemplateNode({ key: 'quick-sibling', label: '同级节点', text: '同级主题', hint: 'topic' }, 'sibling')
}

/**
 * Handle removeSelectedNode logic.
 */
function removeSelectedNode() {
  if (!mindMap || saving.value || !selectedNode) return

  if (selectedNode.isRoot) {
    error.value = '中心主题不可删除'
    return
  }

  mindMap.execCommand('REMOVE_NODE', [selectedNode])
  error.value = ''

  requestAnimationFrame(() => {
    const active = getActiveNodes()
    setSelection(active[0] ?? null)
  })
}

/**
 * Handle runContextMenuAction logic.
 * @param action - Parameter.
 */
function runContextMenuAction(action: 'child' | 'sibling' | 'delete') {
  if (saving.value) return

  switch (action) {
    case 'child':
      addChildNodeQuick()
      break
    case 'sibling':
      addSiblingNodeQuick()
      break
    case 'delete':
      if (!contextMenuTargetIsRoot.value) {
        removeSelectedNode()
      }
      break
    default:
      break
  }

  hideContextMenu()
}

/**
 * Handle getTemplateByKey logic.
 * @param key - Parameter.
 * @returns Return value.
 */
function getTemplateByKey(key: string): MindmapTemplateItem | null {
  return templateItemMap.get(key) ?? null
}

/**
 * Handle getTemplateKeyFromTransfer logic.
 * @param dataTransfer - Parameter.
 * @returns Return value.
 */
function getTemplateKeyFromTransfer(dataTransfer: DataTransfer | null): string | null {
  if (!dataTransfer) return null
  return dataTransfer.getData('application/x-mindmap-template') || dataTransfer.getData('text/plain') || null
}

/**
 * Handle hasTemplateDragPayload logic.
 * @param dataTransfer - Parameter.
 * @returns Return value.
 */
function hasTemplateDragPayload(dataTransfer: DataTransfer | null): boolean {
  if (draggingTemplateKey.value) return true
  if (!dataTransfer) return false
  const types = Array.from(dataTransfer.types || [])
  return types.includes('application/x-mindmap-template') || types.includes('text/plain')
}

/**
 * Handle onTemplateDragStart logic.
 * @param event - Parameter.
 * @param key - Parameter.
 */
function onTemplateDragStart(event: DragEvent, key: string) {
  if (!event.dataTransfer || saving.value) return
  draggingTemplateKey.value = key
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-mindmap-template', key)
  event.dataTransfer.setData('text/plain', key)
}

/**
 * Handle onTemplateDragEnd logic.
 */
function onTemplateDragEnd() {
  draggingTemplateKey.value = null
}

/**
 * Handle onCanvasDragOver logic.
 * @param event - Parameter.
 */
function onCanvasDragOver(event: DragEvent) {
  if (saving.value) return
  if (!hasTemplateDragPayload(event.dataTransfer)) return

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  canvasDropActive.value = true
}

/**
 * Handle onCanvasDragLeave logic.
 * @param event - Parameter.
 */
function onCanvasDragLeave(event: DragEvent) {
  const wrapper = event.currentTarget as HTMLElement | null
  const relatedTarget = event.relatedTarget as Node | null
  if (wrapper && relatedTarget && wrapper.contains(relatedTarget)) return
  canvasDropActive.value = false
}

/**
 * Handle onCanvasDrop logic.
 * @param event - Parameter.
 */
function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  canvasDropActive.value = false
  if (saving.value) return

  const key = getTemplateKeyFromTransfer(event.dataTransfer) || draggingTemplateKey.value
  draggingTemplateKey.value = null
  if (!key) return

  const item = getTemplateByKey(key)
  if (!item) return

  insertTemplateNode(item, 'child')
}

/**
 * Handle onNodeStyleInput logic.
 */
function onNodeStyleInput() {
  if (!mindMap || saving.value || !selectedNode) return

  const normalized: MindmapNodeStyleForm = {
    text: toPlainNodeText(nodeStyleForm.value.text),
    textColor: normalizeColor(nodeStyleForm.value.textColor, '#2b3d55'),
    fontSize: toClampedNumber(nodeStyleForm.value.fontSize, 16, 10, 72),
    fillColor: normalizeColor(nodeStyleForm.value.fillColor, '#ffffff'),
    lineColor: normalizeColor(nodeStyleForm.value.lineColor, '#549688'),
  }

  nodeStyleForm.value = normalized

  mindMap.execCommand('SET_NODE_TEXT', selectedNode, normalized.text, false, true)
  mindMap.execCommand('SET_NODE_STYLES', selectedNode, {
    color: normalized.textColor,
    fontSize: normalized.fontSize,
    fillColor: normalized.fillColor,
    lineColor: normalized.lineColor,
  })
}

/**
 * Handle resetSelectedNodeStyle logic.
 */
function resetSelectedNodeStyle() {
  if (!selectedNode || saving.value) return

  const defaults = createDefaultNodeStyleForm()
  nodeStyleForm.value = {
    ...nodeStyleForm.value,
    textColor: defaults.textColor,
    fontSize: defaults.fontSize,
    fillColor: defaults.fillColor,
    lineColor: defaults.lineColor,
  }

  onNodeStyleInput()
}

/**
 * Handle exportImage logic.
 */
async function exportImage() {
  if (!mindMap || exporting.value || saving.value) return
  exporting.value = true
  error.value = ''

  try {
    const fileName = titleInput.value.trim() || '思维导图'
    await waitForMindmapRenderReady()
    const result = await exportPngDataUrl(fileName, false)
    if (!result) {
      throw new Error('导出失败：未获取到图片数据')
    }

    const link = document.createElement('a')
    link.href = result
    link.download = `${fileName}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导出失败，请重试'
  } finally {
    exporting.value = false
  }
}

/**
 * Handle openJsonPanel logic.
 */
function openJsonPanel() {
  if (saving.value) return
  jsonVisible.value = true
  jsonCopied.value = false
  refreshJson()
}

/**
 * Handle closeJsonPanel logic.
 */
function closeJsonPanel() {
  jsonVisible.value = false
  jsonCopied.value = false
}

/**
 * Handle copyJson logic.
 */
function copyJson() {
  if (!jsonContent.value) return

  try {
    void navigator.clipboard.writeText(jsonContent.value)
    jsonCopied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      jsonCopied.value = false
    }, 1200)
  } catch {
    jsonCopied.value = false
  }
}

/**
 * Handle onConfirm logic.
 */
async function onConfirm() {
  if (!mindMap || saving.value) return

  saving.value = true
  error.value = ''

  try {
    const normalizedTitle = titleInput.value.trim() || '思维导图'
    const scene = getFullScene()
    await waitForMindmapRenderReady()

    const previewUrl = await exportPreviewDataUrl(normalizedTitle)
    if (!previewUrl) {
      throw new Error('保存失败：未生成有效预览图，请调整节点后重试')
    }

    emit('save', {
      title: normalizedTitle,
      previewUrl,
      scene,
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '思维导图保存失败，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!hostRef.value) return

  const scene = normalizeScene(props.initialScene)

  try {
    mindMap = new MindMap({
      el: hostRef.value,
      data: scene.root ?? createDefaultRoot(),
      layout: scene.layout || DEFAULT_MINDMAP_LAYOUT,
      theme: scene.theme?.template || 'default',
      fit: true,
      mousewheelAction: 'zoom',
      isShowScrollbar: false,
    } as unknown as ConstructorParameters<typeof MindMap>[0])

    disableRichTextPlugin(mindMap)
    disableScrollbarPlugin(mindMap)
    guardScrollbarUpdate(mindMap)

    if (scene.theme?.config || scene.view) {
      mindMap.setFullData(scene)
    }

    scaleListener = () => {
      updateZoomPercent()
    }

    dataChangeListener = () => {
      if (jsonVisible.value) refreshJson()
      if (selectedNodeUid.value) {
        const latestNode = findNodeByUid(selectedNodeUid.value)
        if (latestNode) setSelection(latestNode)
      }
    }

    nodeActiveListener = (node: unknown, activeNodeList: unknown) => {
      const list = Array.isArray(activeNodeList) ? (activeNodeList as MindmapNodeInstance[]) : []
      const primary = list[0] ?? (isMindmapNode(node) ? node : null)
      setSelection(primary)
    }

    drawClickListener = () => {
      hideContextMenu()
      if (getActiveNodes().length <= 0) {
        setSelection(null)
      }
    }

    nodeContextmenuListener = (event: unknown, node: unknown) => {
      const resolved = isMindmapNode(node) ? node : getPrimaryTargetNode()
      if (!isMouseEventLike(event)) return
      openContextMenu(event, resolved)
    }

    contextmenuListener = () => {
      hideContextMenu()
    }

    globalPointerListener = (event: MouseEvent) => {
      if (!contextMenuVisible.value) return
      const menu = contextMenuRef.value
      const target = event.target
      if (menu && target instanceof Node && menu.contains(target)) return
      hideContextMenu()
    }

    mindMap.on('scale', scaleListener)
    mindMap.on('data_change', dataChangeListener)
    mindMap.on('node_active', nodeActiveListener)
    mindMap.on('draw_click', drawClickListener)
    mindMap.on('node_contextmenu', nodeContextmenuListener)
    mindMap.on('contextmenu', contextmenuListener)
    window.addEventListener('mousedown', globalPointerListener, true)

    const root = getRootNode()
    if (root) {
      setSelection(root)
    }

    updateZoomPercent()
    requestAnimationFrame(() => {
      fitToView()
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '思维导图初始化失败'
  }
})

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)

  if (mindMap && scaleListener) mindMap.off('scale', scaleListener)
  if (mindMap && dataChangeListener) mindMap.off('data_change', dataChangeListener)
  if (mindMap && nodeActiveListener) mindMap.off('node_active', nodeActiveListener)
  if (mindMap && drawClickListener) mindMap.off('draw_click', drawClickListener)
  if (mindMap && nodeContextmenuListener) mindMap.off('node_contextmenu', nodeContextmenuListener)
  if (mindMap && contextmenuListener) mindMap.off('contextmenu', contextmenuListener)
  if (globalPointerListener) window.removeEventListener('mousedown', globalPointerListener, true)

  mindMap?.destroy()
  mindMap = null
  selectedNode = null
})
</script>

<template>
  <div class="command-menu-mask mindmap-editor-mask" @click.self="onCancel">
    <div class="mindmap-editor-dialog" :class="{ 'is-fullscreen': isFullscreen }" @click.stop>
      <div class="mindmap-editor-head">
        <div class="mindmap-editor-head-top">
          <div class="mindmap-editor-title">{{ dialogTitle }}</div>
          <button
            type="button"
            class="btn ghost mindmap-fullscreen-btn"
            :disabled="saving"
            @click="toggleFullscreen"
          >
            {{ fullscreenButtonText }}
          </button>
        </div>
        <input
          v-model="titleInput"
          class="command-input mindmap-title-input"
          type="text"
          placeholder="思维导图标题"
          :disabled="saving"
        />
      </div>

      <div class="mindmap-editor-body">
        <aside class="mindmap-palette">
          <div class="mindmap-palette-title">节点库（点击或拖拽）</div>

          <div class="mindmap-template-grid">
            <button
              v-for="item in templateItems"
              :key="item.key"
              type="button"
              class="mindmap-template-item"
              :class="{ 'is-dragging': draggingTemplateKey === item.key }"
              :draggable="!saving"
              :disabled="saving"
              @click="insertTemplateNode(item, 'child')"
              @dragstart="onTemplateDragStart($event, item.key)"
              @dragend="onTemplateDragEnd"
            >
              <span class="mindmap-shape" :data-kind="item.hint"></span>
              <span class="mindmap-template-label">{{ item.label }}</span>
            </button>
          </div>
        </aside>

        <div
          ref="canvasWrapRef"
          class="mindmap-canvas-wrap"
          :class="{ 'is-drop-active': canvasDropActive }"
          @dragover="onCanvasDragOver"
          @dragleave="onCanvasDragLeave"
          @drop="onCanvasDrop"
        >
          <div ref="hostRef" class="mindmap-editor-host"></div>
          <div v-if="canvasDropActive" class="mindmap-drop-hint">释放鼠标即可添加节点</div>
          <div
            v-if="contextMenuVisible"
            ref="contextMenuRef"
            class="mindmap-node-context-menu"
            :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }"
            @mousedown.stop
            @click.stop
          >
            <div class="mindmap-context-title">节点操作</div>
            <div class="mindmap-context-grid">
              <button type="button" class="mindmap-context-btn" :disabled="saving" @click="runContextMenuAction('child')">+ 子节点</button>
              <button type="button" class="mindmap-context-btn" :disabled="saving" @click="runContextMenuAction('sibling')">+ 同级节点</button>
            </div>
            <button
              type="button"
              class="mindmap-context-btn danger"
              :disabled="saving || contextMenuTargetIsRoot"
              @click="runContextMenuAction('delete')"
            >
              删除节点
            </button>
            <div class="mindmap-context-tip">{{ contextMenuTip }}</div>
          </div>

          <div class="mindmap-canvas-toolbar" role="toolbar" aria-label="思维导图工具栏">
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="zoomIn">放大</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="zoomOut">缩小</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="fitToView">自适应</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="undo">上一步</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="redo">下一步</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving || exporting" @click="exportImage">{{ exportButtonText }}</button>
            <button type="button" class="mindmap-tool-btn" :disabled="saving" @click="openJsonPanel">{{ jsonButtonText }}</button>
            <span class="mindmap-zoom-badge">{{ zoomPercent }}%</span>
          </div>

          <div class="mindmap-canvas-footer">
            <button type="button" class="mindmap-helper-btn" :disabled="saving" @click="setDefaultScene">恢复示例</button>
            <button type="button" class="mindmap-helper-btn" :disabled="saving" @click="clearScene">清空画布</button>
            <span class="mindmap-tools-tip">节点可拖拽调整，双击编辑文字，右键打开节点菜单，Tab 新建子节点，Enter 新建同级节点</span>
          </div>
        </div>

        <aside class="mindmap-style-panel" :class="{ 'is-empty': !hasSelectedNode }">
          <div class="mindmap-style-title">节点属性</div>

          <template v-if="hasSelectedNode">
            <div class="mindmap-style-meta">
              <span class="mindmap-style-type">{{ nodeTypeLabel }}</span>
              <span class="mindmap-style-id">{{ selectedNodeUid }}</span>
            </div>

            <label class="mindmap-style-field">
              <span>文字内容</span>
              <input
                v-model="nodeStyleForm.text"
                type="text"
                class="command-input"
                :disabled="saving"
                @input="onNodeStyleInput"
              />
            </label>

            <div class="mindmap-style-row">
              <label class="mindmap-style-field">
                <span>文字颜色</span>
                <input
                  v-model="nodeStyleForm.textColor"
                  type="color"
                  class="mindmap-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>

              <label class="mindmap-style-field">
                <span>字号</span>
                <input
                  v-model.number="nodeStyleForm.fontSize"
                  type="number"
                  min="10"
                  max="72"
                  class="command-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
            </div>

            <div class="mindmap-style-row">
              <label class="mindmap-style-field">
                <span>节点色</span>
                <input
                  v-model="nodeStyleForm.fillColor"
                  type="color"
                  class="mindmap-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>

              <label class="mindmap-style-field">
                <span>线条色</span>
                <input
                  v-model="nodeStyleForm.lineColor"
                  type="color"
                  class="mindmap-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
            </div>

            <button type="button" class="mindmap-style-reset" :disabled="saving" @click="resetSelectedNodeStyle">
              重置样式
            </button>
          </template>

          <div v-else class="mindmap-style-empty-tip">点击画布中的任意节点后，可在这里设置文字色、字号、节点色和线条色。</div>
        </aside>
      </div>

      <p v-if="error" class="mindmap-editor-error">{{ error }}</p>

      <div class="mindmap-editor-actions">
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>

    <div v-if="jsonVisible" class="mindmap-json-mask" @click.self="closeJsonPanel">
      <div class="mindmap-json-dialog" @click.stop>
        <div class="mindmap-json-head">
          <strong>思维导图 JSON</strong>
          <div class="mindmap-json-actions">
            <button type="button" class="btn xs" @click="copyJson">{{ jsonCopied ? '已复制' : '复制' }}</button>
            <button type="button" class="btn xs ghost" @click="closeJsonPanel">关闭</button>
          </div>
        </div>
        <pre class="mindmap-json-content">{{ jsonContent }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mindmap-editor-mask {
  z-index: 38;
}

.mindmap-editor-dialog {
  width: min(1320px, calc(100vw - 20px));
  height: min(860px, calc(100vh - 20px));
  background: #fff;
  border: 1px solid #d8e2ee;
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(18, 33, 52, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.mindmap-editor-dialog.is-fullscreen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-radius: 0;
  border: 0;
}

.mindmap-editor-head {
  padding: 12px 14px;
  border-bottom: 1px solid #e2eaf5;
  display: grid;
  gap: 8px;
  background: linear-gradient(180deg, #f9fbff, #f4f8ff);
}

.mindmap-editor-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mindmap-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: #2a415e;
}

.mindmap-fullscreen-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
}

.mindmap-title-input {
  max-width: 460px;
}

.mindmap-editor-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 246px 1fr 268px;
  background: #f1f5fc;
}

.mindmap-palette {
  border-right: 1px solid #dce5f2;
  background: linear-gradient(180deg, #f9fbff 0%, #f3f7ff 100%);
  padding: 10px;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 10px;
}

.mindmap-palette-title {
  font-size: 12px;
  font-weight: 700;
  color: #27425e;
}

.mindmap-template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.mindmap-template-item {
  border: 1px solid #d8e3f3;
  border-radius: 10px;
  background: #fff;
  color: #23384f;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: left;
}

.mindmap-template-item:hover {
  border-color: #98b3d7;
  box-shadow: 0 6px 12px rgba(22, 52, 90, 0.12);
  transform: translateY(-1px);
}

.mindmap-template-item.is-dragging {
  border-color: #2e73ff;
  box-shadow: 0 0 0 2px rgba(46, 115, 255, 0.2);
}

.mindmap-template-label {
  min-width: 0;
  font-size: 12px;
  color: #1f3751;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mindmap-shape {
  width: 18px;
  height: 18px;
  display: inline-block;
  flex-shrink: 0;
  border-radius: 999px;
  border: 2px solid #5d7fa8;
  background: #ffffff;
}

.mindmap-shape[data-kind='topic'] {
  border-color: #4f79be;
  background: #f0f5ff;
}

.mindmap-shape[data-kind='todo'] {
  border-radius: 4px;
  border-color: #6a90c2;
}

.mindmap-shape[data-kind='idea'] {
  border-color: #6e8ec0;
  background: #f7f8ff;
}

.mindmap-shape[data-kind='question'] {
  border-color: #6e8ec0;
  position: relative;
}

.mindmap-shape[data-kind='question']::before {
  content: '?';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #4f71a8;
  font-weight: 700;
}

.mindmap-shape[data-kind='decision'] {
  transform: rotate(45deg);
  border-radius: 2px;
  border-color: #6f82bd;
}

.mindmap-shape[data-kind='summary'] {
  border-style: dashed;
  border-color: #6e8fb4;
}

.mindmap-shape[data-kind='branch'] {
  width: 20px;
  height: 12px;
  border-radius: 999px;
  border-color: #6a8cb7;
}

.mindmap-canvas-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.mindmap-canvas-wrap.is-drop-active::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(61, 120, 219, 0.42);
  border-radius: 10px;
  pointer-events: none;
  z-index: 24;
}

.mindmap-editor-host {
  width: 100%;
  height: 100%;
}

.mindmap-drop-hint {
  position: absolute;
  left: 50%;
  top: 18px;
  transform: translateX(-50%);
  z-index: 26;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #9fbce4;
  background: rgba(255, 255, 255, 0.96);
  color: #2f5d95;
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
}

.mindmap-node-context-menu {
  position: absolute;
  z-index: 36;
  width: 196px;
  border: 1px solid #cad9ee;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 30px rgba(15, 33, 54, 0.24);
  padding: 10px;
  display: grid;
  gap: 8px;
  backdrop-filter: blur(4px);
}

.mindmap-context-title {
  font-size: 12px;
  font-weight: 700;
  color: #2a4564;
}

.mindmap-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.mindmap-context-btn {
  border: 1px solid #c8d9ef;
  background: #f8fbff;
  color: #234364;
  border-radius: 9px;
  height: 30px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mindmap-context-btn:hover:not(:disabled) {
  border-color: #96b5da;
  background: #eef5ff;
}

.mindmap-context-btn.danger {
  color: #a33c40;
  border-color: #e4c7cb;
  background: #fff8f8;
}

.mindmap-context-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.mindmap-context-tip {
  border: 1px dashed #c7d8ee;
  border-radius: 9px;
  padding: 8px;
  font-size: 11px;
  line-height: 1.45;
  color: #57708f;
}

.mindmap-canvas-toolbar {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid #d4e1f1;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 28px rgba(16, 40, 72, 0.16);
  backdrop-filter: blur(4px);
  z-index: 18;
}

.mindmap-tool-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid #c9d7ea;
  background: #f8fbff;
  color: #2b4465;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.mindmap-tool-btn:hover {
  border-color: #94b2d8;
  background: #edf4ff;
}

.mindmap-zoom-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid #b9cee9;
  background: #f3f8ff;
  color: #264263;
  font-size: 13px;
  font-weight: 700;
}

.mindmap-canvas-footer {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(208, 221, 240, 0.92);
  background: rgba(255, 255, 255, 0.88);
  z-index: 18;
}

.mindmap-helper-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #c9d9ef;
  background: #f6faff;
  color: #2d476a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.mindmap-helper-btn:hover {
  border-color: #9dbce0;
  background: #edf5ff;
}

.mindmap-tools-tip {
  font-size: 12px;
  color: #5d748f;
  margin-left: auto;
}

.mindmap-style-panel {
  border-left: 1px solid #dce5f2;
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%);
  padding: 12px 10px;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 10px;
}

.mindmap-style-title {
  font-size: 12px;
  font-weight: 700;
  color: #24405f;
}

.mindmap-style-meta {
  display: grid;
  gap: 4px;
}

.mindmap-style-type {
  display: inline-flex;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #b8cae3;
  background: #f7fbff;
  color: #2d4d72;
  font-size: 12px;
  font-weight: 700;
}

.mindmap-style-id {
  font-size: 11px;
  color: #637d9a;
  word-break: break-all;
}

.mindmap-style-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: #335270;
}

.mindmap-style-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mindmap-color-input {
  width: 100%;
  height: 32px;
  border: 1px solid #c9d9ec;
  border-radius: 8px;
  background: #fff;
  padding: 2px;
  cursor: pointer;
}

.mindmap-style-reset {
  border: 1px solid #c6d8ef;
  background: #fff;
  color: #244361;
  border-radius: 8px;
  height: 32px;
  font-size: 12px;
  cursor: pointer;
}

.mindmap-style-reset:hover {
  border-color: #94b1d7;
  background: #f3f8ff;
}

.mindmap-style-empty-tip {
  font-size: 12px;
  color: #5e7896;
  border: 1px dashed #c5d5e9;
  border-radius: 10px;
  background: #f8fbff;
  padding: 12px;
  line-height: 1.5;
}

.mindmap-editor-error {
  margin: 0;
  padding: 10px 14px 0;
  color: #c1383c;
  font-size: 12px;
}

.mindmap-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid #e2eaf5;
  background: #fff;
}

.mindmap-json-mask {
  position: absolute;
  inset: 0;
  background: rgba(10, 18, 30, 0.35);
  display: grid;
  place-items: center;
  z-index: 45;
}

.mindmap-json-dialog {
  width: min(920px, calc(100vw - 44px));
  max-height: min(680px, calc(100vh - 80px));
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #d7e2f2;
  box-shadow: 0 24px 50px rgba(14, 31, 54, 0.34);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mindmap-json-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #dee8f6;
  background: #f8fbff;
  color: #2b4465;
}

.mindmap-json-actions {
  display: flex;
  gap: 8px;
}

.mindmap-json-content {
  margin: 0;
  padding: 14px;
  background: #0f1724;
  color: #e5ecff;
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.smm-richtext-node-wrap),
:deep(.smm-richtext-node-wrap p),
:deep(.smm-richtext-node-wrap span) {
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.2 !important;
}
</style>


