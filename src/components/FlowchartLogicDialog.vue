<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import LogicFlow from '@logicflow/core'
import { BpmnElement, MiniMap, Snapshot } from '@logicflow/extension'
import '@logicflow/core/es/index.css'
import '@logicflow/extension/es/index.css'

type FlowchartSceneSnapshot = Parameters<LogicFlow['render']>[0]
type FlowchartNodeConfig = Parameters<LogicFlow['addNode']>[0]

interface FlowchartSavePayload {
  title: string
  previewUrl: string
  scene: FlowchartSceneSnapshot
}

interface FlowchartNodeStyleForm {
  text: string
  textColor: string
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  width: number
  height: number
  radius: number
}

interface FlowchartEditableNodeModel {
  id: string
  type: string
  width?: number
  height?: number
  radius?: number
  properties?: Record<string, unknown>
  getNodeStyle?: () => Record<string, unknown>
  getTextStyle?: () => Record<string, unknown>
}

type PaletteGroupKey = 'basic' | 'flow' | 'bpmn' | 'assist'
type PaletteNodeType = string
type PaletteShapeHint = 'rect' | 'round' | 'circle' | 'diamond' | 'ellipse' | 'text' | 'task' | 'gateway' | 'event' | 'comment'

interface PaletteGroup {
  key: PaletteGroupKey
  label: string
}

interface PaletteNodeTemplate {
  type: string
  text: string
  width?: number
  height?: number
  radius?: number
}

interface PaletteItem {
  key: PaletteNodeType
  label: string
  hint: PaletteShapeHint
  group: PaletteGroupKey
  template: PaletteNodeTemplate
}

const paletteGroups: PaletteGroup[] = [
  { key: 'flow', label: '流程图' },
  { key: 'basic', label: '基础图形' },
  { key: 'bpmn', label: 'BPMN' },
  { key: 'assist', label: '辅助' },
]

const paletteItems: PaletteItem[] = [
  { key: 'start', label: '开始', hint: 'circle', group: 'flow', template: { type: 'circle', text: '开始' } },
  { key: 'process', label: '处理', hint: 'rect', group: 'flow', template: { type: 'rect', text: '处理', width: 118, height: 52 } },
  { key: 'decision', label: '判断', hint: 'diamond', group: 'flow', template: { type: 'diamond', text: '判断', width: 96, height: 62 } },
  { key: 'input', label: '输入输出', hint: 'round', group: 'flow', template: { type: 'rect', text: '输入输出', width: 128, height: 52, radius: 10 } },
  { key: 'sub-process', label: '子流程', hint: 'task', group: 'flow', template: { type: 'rect', text: '子流程', width: 136, height: 58, radius: 12 } },
  { key: 'parallel', label: '并行', hint: 'rect', group: 'flow', template: { type: 'rect', text: '并行', width: 118, height: 52 } },
  { key: 'rerun', label: '重复', hint: 'round', group: 'flow', template: { type: 'rect', text: '重复', width: 118, height: 52, radius: 8 } },
  { key: 'end', label: '结束', hint: 'circle', group: 'flow', template: { type: 'circle', text: '结束' } },
  { key: 'basic-rect', label: '矩形', hint: 'rect', group: 'basic', template: { type: 'rect', text: '矩形', width: 118, height: 52 } },
  { key: 'basic-round', label: '圆角矩形', hint: 'round', group: 'basic', template: { type: 'rect', text: '圆角', width: 118, height: 52, radius: 12 } },
  { key: 'basic-circle', label: '圆形', hint: 'circle', group: 'basic', template: { type: 'circle', text: '圆形' } },
  { key: 'basic-ellipse', label: '椭圆', hint: 'ellipse', group: 'basic', template: { type: 'ellipse', text: '椭圆', width: 128, height: 62 } },
  { key: 'basic-diamond', label: '菱形', hint: 'diamond', group: 'basic', template: { type: 'diamond', text: '菱形', width: 96, height: 64 } },
  { key: 'basic-text', label: '文本', hint: 'text', group: 'basic', template: { type: 'text', text: '文本说明' } },
  { key: 'bpmn-start', label: '开始事件', hint: 'event', group: 'bpmn', template: { type: 'bpmn:startEvent', text: '开始' } },
  { key: 'bpmn-task', label: '用户任务', hint: 'task', group: 'bpmn', template: { type: 'bpmn:userTask', text: '用户任务', width: 130, height: 60 } },
  { key: 'bpmn-service', label: '服务任务', hint: 'task', group: 'bpmn', template: { type: 'bpmn:serviceTask', text: '服务任务', width: 130, height: 60 } },
  { key: 'bpmn-gateway', label: '网关', hint: 'gateway', group: 'bpmn', template: { type: 'bpmn:exclusiveGateway', text: '网关' } },
  { key: 'bpmn-end', label: '结束事件', hint: 'event', group: 'bpmn', template: { type: 'bpmn:endEvent', text: '结束' } },
  { key: 'assist-note', label: '注释', hint: 'comment', group: 'assist', template: { type: 'text', text: '注释' } },
  { key: 'assist-tag', label: '标签', hint: 'round', group: 'assist', template: { type: 'rect', text: '标签', width: 90, height: 42, radius: 8 } },
  { key: 'assist-milestone', label: '里程碑', hint: 'ellipse', group: 'assist', template: { type: 'ellipse', text: '里程碑', width: 132, height: 62 } },
  { key: 'assist-group', label: '分组框', hint: 'rect', group: 'assist', template: { type: 'rect', text: '分组', width: 210, height: 120, radius: 8 } },
]

const paletteItemMap = new Map<PaletteNodeType, PaletteItem>(paletteItems.map((item) => [item.key, item]))

function createDefaultNodeStyleForm(): FlowchartNodeStyleForm {
  return {
    text: '',
    textColor: '#102030',
    fontSize: 13,
    fill: '#ffffff',
    stroke: '#7e95b2',
    strokeWidth: 1.2,
    width: 120,
    height: 56,
    radius: 8,
  }
}

const props = defineProps<{
  mode: 'insert' | 'edit'
  title: string
  initialScene: unknown
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'save', payload: FlowchartSavePayload): void
}>()

let flowchartExtensionsInstalled = false

const hostRef = ref<HTMLDivElement | null>(null)
const titleInput = ref(props.title || '流程图')
const saving = ref(false)
const exporting = ref(false)
const error = ref('')
const isFullscreen = ref(false)
const zoomPercent = ref(100)
const jsonVisible = ref(false)
const jsonContent = ref('')
const jsonCopied = ref(false)
const draggingPaletteKey = ref<PaletteNodeType | null>(null)
const canvasDropActive = ref(false)
const selectedNodeId = ref<string | null>(null)
const selectedNodeType = ref('')
const nodeStyleForm = ref<FlowchartNodeStyleForm>(createDefaultNodeStyleForm())

let lf: LogicFlow | null = null
let nodeSeed = 0
let copyTimer: ReturnType<typeof setTimeout> | null = null
let nodeClickListener: ((payload: unknown) => void) | null = null
let blankClickListener: ((payload: unknown) => void) | null = null
let nodeDeleteListener: ((payload: unknown) => void) | null = null
let nodeResizeListener: ((payload: unknown) => void) | null = null

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑流程图（LogicFlow）' : '插入流程图（LogicFlow）'))
const confirmText = computed(() => {
  if (saving.value) return '保存中...'
  return props.mode === 'edit' ? '保存' : '插入'
})
const fullscreenButtonText = computed(() => (isFullscreen.value ? '退出全屏' : '全屏编辑'))
const exportButtonText = computed(() => (exporting.value ? '导出中...' : '导出图片'))
const jsonButtonText = computed(() => (jsonVisible.value ? '刷新 JSON' : '查看 JSON'))
const paletteItemsByGroup = computed(() =>
  paletteGroups.map((group) => ({
    ...group,
    items: paletteItems.filter((item) => item.group === group.key),
  }))
)
const hasSelectedNode = computed(() => Boolean(selectedNodeId.value))
const nodeTypeBadge = computed(() => selectedNodeType.value || '未选择')
const nodeSupportsSize = computed(() => selectedNodeType.value !== 'text')
const nodeSupportsRadius = computed(() => {
  const type = selectedNodeType.value.toLowerCase()
  return type.includes('rect') || type.includes('task')
})

watch(
  () => props.title,
  (value) => {
    titleInput.value = value || '流程图'
  }
)

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function extractNodeText(text: unknown): string {
  if (typeof text === 'string') return text
  if (text && typeof text === 'object') {
    const rawValue = (text as { value?: unknown }).value
    if (typeof rawValue === 'string') return rawValue
  }
  return ''
}

function toClampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function getNodeIdFromEventPayload(payload: unknown): string | null {
  const data = asRecord(asRecord(payload).data)
  const id = data.id
  return typeof id === 'string' && id ? id : null
}

function clearSelectedNode() {
  selectedNodeId.value = null
  selectedNodeType.value = ''
  nodeStyleForm.value = createDefaultNodeStyleForm()
}

function readSelectedNodeStyle(nodeId: string): FlowchartNodeStyleForm | null {
  if (!lf) return null
  const nodeData = lf.getNodeDataById(nodeId) as { text?: unknown } | undefined
  const nodeModel = lf.getNodeModelById(nodeId) as FlowchartEditableNodeModel | undefined
  if (!nodeModel) return null

  const defaultForm = createDefaultNodeStyleForm()
  const nodeStyle = asRecord(nodeModel.getNodeStyle?.())
  const textStyle = asRecord(nodeModel.getTextStyle?.())

  return {
    text: extractNodeText(nodeData?.text),
    textColor: typeof textStyle.color === 'string' ? textStyle.color : defaultForm.textColor,
    fontSize: toClampedNumber(textStyle.fontSize, defaultForm.fontSize, 10, 72),
    fill: typeof nodeStyle.fill === 'string' ? nodeStyle.fill : defaultForm.fill,
    stroke: typeof nodeStyle.stroke === 'string' ? nodeStyle.stroke : defaultForm.stroke,
    strokeWidth: toClampedNumber(nodeStyle.strokeWidth, defaultForm.strokeWidth, 0, 12),
    width: toClampedNumber(nodeModel.width, defaultForm.width, 36, 560),
    height: toClampedNumber(nodeModel.height, defaultForm.height, 28, 360),
    radius: toClampedNumber(nodeModel.radius, defaultForm.radius, 0, 80),
  }
}

function selectNode(nodeId: string) {
  if (!lf) return
  const nodeModel = lf.getNodeModelById(nodeId) as FlowchartEditableNodeModel | undefined
  if (!nodeModel) {
    clearSelectedNode()
    return
  }

  selectedNodeId.value = nodeId
  selectedNodeType.value = nodeModel.type || ''
  const styleForm = readSelectedNodeStyle(nodeId)
  if (styleForm) nodeStyleForm.value = styleForm
}

function applySelectedNodeStyle() {
  if (!lf || !selectedNodeId.value) return

  const normalized: FlowchartNodeStyleForm = {
    text: String(nodeStyleForm.value.text ?? ''),
    textColor: String(nodeStyleForm.value.textColor || '#102030'),
    fontSize: toClampedNumber(nodeStyleForm.value.fontSize, 13, 10, 72),
    fill: String(nodeStyleForm.value.fill || '#ffffff'),
    stroke: String(nodeStyleForm.value.stroke || '#7e95b2'),
    strokeWidth: toClampedNumber(nodeStyleForm.value.strokeWidth, 1.2, 0, 12),
    width: toClampedNumber(nodeStyleForm.value.width, 120, 36, 560),
    height: toClampedNumber(nodeStyleForm.value.height, 56, 28, 360),
    radius: toClampedNumber(nodeStyleForm.value.radius, 8, 0, 80),
  }

  nodeStyleForm.value = normalized

  const properties: Record<string, unknown> = {
    style: {
      fill: normalized.fill,
      stroke: normalized.stroke,
      strokeWidth: normalized.strokeWidth,
    },
    textStyle: {
      color: normalized.textColor,
      fontSize: normalized.fontSize,
    },
  }

  if (nodeSupportsSize.value) {
    properties.width = normalized.width
    properties.height = normalized.height
  }

  if (nodeSupportsRadius.value) {
    properties.radius = normalized.radius
  }

  lf.setProperties(selectedNodeId.value, properties)
  lf.updateText(selectedNodeId.value, normalized.text)
}

function resetSelectedNodeStyle() {
  if (!selectedNodeId.value) return
  const defaults = createDefaultNodeStyleForm()
  nodeStyleForm.value = {
    ...nodeStyleForm.value,
    textColor: defaults.textColor,
    fontSize: defaults.fontSize,
    fill: defaults.fill,
    stroke: defaults.stroke,
    strokeWidth: defaults.strokeWidth,
    radius: nodeSupportsRadius.value ? defaults.radius : nodeStyleForm.value.radius,
  }
  applySelectedNodeStyle()
}

function onNodeStyleInput() {
  applySelectedNodeStyle()
}

function onCancel() {
  if (saving.value) return
  emit('cancel')
}

function toggleFullscreen() {
  if (saving.value) return
  isFullscreen.value = !isFullscreen.value
  requestAnimationFrame(() => {
    fitToView()
  })
}

function ensureExtensions() {
  if (flowchartExtensionsInstalled) return
  LogicFlow.use(Snapshot)
  LogicFlow.use(BpmnElement)
  LogicFlow.use(MiniMap, {
    width: 150,
    height: 108,
    isShowHeader: true,
    isShowCloseIcon: true,
    headerTitle: '导航',
    rightPosition: 12,
    bottomPosition: 12,
  })
  flowchartExtensionsInstalled = true
}

function cloneScene(scene: FlowchartSceneSnapshot): FlowchartSceneSnapshot {
  const snapshot: FlowchartSceneSnapshot = {
    nodes: Array.isArray(scene.nodes) ? scene.nodes : [],
    edges: Array.isArray(scene.edges) ? scene.edges : [],
  }

  try {
    // Keep only serializable fields to avoid DataCloneError from proxy-like objects.
    return JSON.parse(JSON.stringify(snapshot)) as FlowchartSceneSnapshot
  } catch {
    return createDefaultScene()
  }
}

function createDefaultScene(): FlowchartSceneSnapshot {
  return {
    nodes: [
      { id: 'start_1', type: 'circle', x: 160, y: 150, text: '开始' },
      { id: 'task_1', type: 'rect', x: 420, y: 150, text: '处理' },
      { id: 'end_1', type: 'circle', x: 680, y: 150, text: '结束' },
    ],
    edges: [
      { id: 'edge_1', type: 'polyline', sourceNodeId: 'start_1', targetNodeId: 'task_1' },
      { id: 'edge_2', type: 'polyline', sourceNodeId: 'task_1', targetNodeId: 'end_1' },
    ],
  }
}

function normalizeScene(value: unknown): FlowchartSceneSnapshot {
  if (!value || typeof value !== 'object') {
    return createDefaultScene()
  }

  const rawValue = toRaw(value as object)
  const input = rawValue as { nodes?: unknown; edges?: unknown }
  const nodes = Array.isArray(input.nodes) ? input.nodes : []
  const edges = Array.isArray(input.edges) ? input.edges : []

  if (!nodes.length) {
    return createDefaultScene()
  }

  return {
    nodes: [...nodes] as FlowchartSceneSnapshot['nodes'],
    edges: [...edges] as FlowchartSceneSnapshot['edges'],
  }
}

function updateZoomPercent() {
  if (!lf) return
  const transform = lf.getTransform()
  const scale = Number(transform.SCALE_X)
  zoomPercent.value = Number.isFinite(scale) ? Math.round(scale * 100) : 100
}

function refreshNodeSeed() {
  if (!lf) return

  const graph = lf.getGraphRawData() as { nodes?: unknown[] }
  nodeSeed = Array.isArray(graph.nodes) ? graph.nodes.length : 0
}

function getPaletteItem(type: PaletteNodeType): PaletteItem | null {
  return paletteItemMap.get(type) ?? null
}

function getNextAutoPosition() {
  nodeSeed += 1
  const col = (nodeSeed - 1) % 5
  const row = Math.floor((nodeSeed - 1) / 5)
  return {
    x: 260 + col * 190,
    y: 150 + row * 120,
  }
}

function addPaletteNode(item: PaletteItem, x?: number, y?: number) {
  if (!lf || saving.value) return

  const autoPosition = getNextAutoPosition()
  const targetX = Number.isFinite(x) ? Number(x) : autoPosition.x
  const targetY = Number.isFinite(y) ? Number(y) : autoPosition.y

  const nodeConfig: FlowchartNodeConfig = {
    type: item.template.type,
    x: Math.round(targetX),
    y: Math.round(targetY),
    text: item.template.text,
  }

  if (typeof item.template.width === 'number') nodeConfig.width = item.template.width
  if (typeof item.template.height === 'number') nodeConfig.height = item.template.height
  if (typeof item.template.radius === 'number') nodeConfig.radius = item.template.radius

  lf.addNode(nodeConfig)
}

function addNodeByType(type: PaletteNodeType) {
  const item = getPaletteItem(type)
  if (!item) return
  addPaletteNode(item)
}

function getPaletteKeyFromTransfer(dataTransfer: DataTransfer | null): PaletteNodeType | null {
  if (!dataTransfer) return null
  return dataTransfer.getData('application/x-flowchart-node') || dataTransfer.getData('text/plain') || null
}

function hasPaletteDragPayload(dataTransfer: DataTransfer | null): boolean {
  if (draggingPaletteKey.value) return true
  if (!dataTransfer) return false
  const types = Array.from(dataTransfer.types ?? [])
  return types.includes('application/x-flowchart-node') || types.includes('text/plain')
}

function onPaletteDragStart(event: DragEvent, type: PaletteNodeType) {
  if (saving.value) return

  const item = getPaletteItem(type)
  if (!item || !event.dataTransfer) return

  draggingPaletteKey.value = type
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-flowchart-node', type)
  event.dataTransfer.setData('text/plain', type)
}

function onPaletteDragEnd() {
  draggingPaletteKey.value = null
}

function onCanvasDragOver(event: DragEvent) {
  if (saving.value) return

  if (!hasPaletteDragPayload(event.dataTransfer)) return

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  canvasDropActive.value = true
}

function onCanvasDragLeave(event: DragEvent) {
  const wrapper = event.currentTarget as HTMLElement | null
  const relatedTarget = event.relatedTarget as Node | null
  if (wrapper && relatedTarget && wrapper.contains(relatedTarget)) return
  canvasDropActive.value = false
}

function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  canvasDropActive.value = false
  if (saving.value || !lf) return

  const paletteKey = getPaletteKeyFromTransfer(event.dataTransfer) || draggingPaletteKey.value
  draggingPaletteKey.value = null
  if (!paletteKey) return

  const item = getPaletteItem(paletteKey)
  if (!item) return

  const point = lf.getPointByClient(event.clientX, event.clientY) as {
    canvasOverlayPosition?: { x: number; y: number }
    domOverlayPosition?: { x: number; y: number }
  }
  const canvasPoint = point.canvasOverlayPosition ?? point.domOverlayPosition

  if (canvasPoint && Number.isFinite(canvasPoint.x) && Number.isFinite(canvasPoint.y)) {
    addPaletteNode(item, canvasPoint.x, canvasPoint.y)
    return
  }

  addPaletteNode(item)
}

function resetDefaultScene() {
  if (!lf || saving.value) return
  lf.render(createDefaultScene())
  clearSelectedNode()
  applyDefaultViewport()
  refreshNodeSeed()
}

function clearScene() {
  if (!lf || saving.value) return
  lf.clearData()
  clearSelectedNode()
  refreshNodeSeed()
  updateZoomPercent()
}

function zoomIn() {
  if (!lf) return
  lf.zoom(true)
  updateZoomPercent()
}

function zoomOut() {
  if (!lf) return
  lf.zoom(false)
  updateZoomPercent()
}

function fitToView() {
  if (!lf) return
  lf.fitView(24, 24)
  updateZoomPercent()
}

function applyDefaultViewport() {
  if (!lf) return
  lf.resetZoom()
  lf.translateCenter()
  updateZoomPercent()
}

function undo() {
  if (!lf) return
  lf.undo()
  updateZoomPercent()
}

function redo() {
  if (!lf) return
  lf.redo()
  updateZoomPercent()
}

function openJsonPanel() {
  if (!lf) return
  const raw = lf.getGraphRawData()
  jsonContent.value = JSON.stringify(raw, null, 2)
  jsonVisible.value = true
  jsonCopied.value = false
}

async function copyJson() {
  if (!jsonContent.value) return

  try {
    await navigator.clipboard.writeText(jsonContent.value)
    jsonCopied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      jsonCopied.value = false
    }, 1200)
  } catch {
    jsonCopied.value = false
  }
}

function closeJsonPanel() {
  jsonVisible.value = false
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim() || 'flowchart'
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 64)
}

async function exportImage() {
  if (!lf || exporting.value) return

  exporting.value = true
  error.value = ''

  try {
    const exportAsBase64 = (lf as unknown as { getSnapshotBase64?: (...args: unknown[]) => Promise<{ data?: unknown }> })
      .getSnapshotBase64

    if (typeof exportAsBase64 !== 'function') {
      throw new Error('当前环境不支持导出图片')
    }

    const result = await exportAsBase64.call(lf, '#ffffff', 'png', {
      padding: 24,
      partial: false,
    })

    if (!result || typeof result.data !== 'string') {
      throw new Error('导出图片失败，请重试')
    }

    const link = document.createElement('a')
    link.href = result.data
    link.download = `${sanitizeFileName(titleInput.value)}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '导出图片失败，请重试'
  } finally {
    exporting.value = false
  }
}

async function onConfirm() {
  if (!lf || saving.value) return

  saving.value = true
  error.value = ''

  try {
    const graphRawData = lf.getGraphRawData() as { nodes?: unknown[]; edges?: unknown[] }
    const scene: FlowchartSceneSnapshot = {
      nodes: (Array.isArray(graphRawData.nodes) ? graphRawData.nodes : []) as FlowchartSceneSnapshot['nodes'],
      edges: (Array.isArray(graphRawData.edges) ? graphRawData.edges : []) as FlowchartSceneSnapshot['edges'],
    }

    let previewUrl = ''
    const exportAsBase64 = (lf as unknown as { getSnapshotBase64?: (...args: unknown[]) => Promise<{ data?: unknown }> })
      .getSnapshotBase64

    if (typeof exportAsBase64 === 'function') {
      const result = await exportAsBase64.call(lf, '#ffffff', 'png', {
        padding: 24,
        partial: false,
      })

      if (result && typeof result.data === 'string') {
        previewUrl = result.data
      }
    }

    emit('save', {
      title: titleInput.value.trim() || '流程图',
      previewUrl,
      scene,
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '流程图保存失败，请重试'
  } finally {
    saving.value = false
  }
}

function showMiniMap() {
  if (!lf) return
  const miniMap = (lf as unknown as { extension?: { miniMap?: { show?: () => void; updatePosition?: (pos: unknown) => void } } })
    .extension?.miniMap

  miniMap?.show?.()
  miniMap?.updatePosition?.('right-bottom')
}

onMounted(() => {
  if (!hostRef.value) return

  ensureExtensions()

  lf = new LogicFlow({
    container: hostRef.value,
    grid: {
      size: 12,
      visible: true,
      type: 'dot',
      config: {
        color: '#dbe3ef',
        thickness: 1,
      },
    },
    background: {
      color: '#f7f9fd',
    },
  })

  lf.setTheme({
    baseNode: {
      strokeWidth: 1.2,
      stroke: '#7e95b2',
      fill: '#ffffff',
    },
    baseEdge: {
      stroke: '#1e2735',
      strokeWidth: 1.2,
    },
    nodeText: {
      color: '#102030',
      fontSize: 13,
    },
    edgeText: {
      color: '#0f2238',
      fontSize: 12,
      textWidth: 120,
      background: {
        fill: '#ffffff',
        stroke: '#d0d9e8',
      },
    },
  })
  lf.setDefaultEdgeType('polyline')

  const initialScene = normalizeScene(props.initialScene)
  lf.render(cloneScene(initialScene))
  applyDefaultViewport()
  refreshNodeSeed()

  nodeClickListener = (payload: unknown) => {
    const nodeId = getNodeIdFromEventPayload(payload)
    if (!nodeId) return
    selectNode(nodeId)
  }
  blankClickListener = () => {
    clearSelectedNode()
  }
  nodeDeleteListener = (payload: unknown) => {
    const nodeId = getNodeIdFromEventPayload(payload)
    if (!nodeId) return
    if (selectedNodeId.value === nodeId) clearSelectedNode()
  }
  nodeResizeListener = (payload: unknown) => {
    const nodeId = getNodeIdFromEventPayload(payload)
    if (!nodeId) return
    if (selectedNodeId.value === nodeId) selectNode(nodeId)
  }

  lf.on('node:click', nodeClickListener)
  lf.on('blank:click', blankClickListener)
  lf.on('node:delete', nodeDeleteListener)
  lf.on('node:resize', nodeResizeListener)

  requestAnimationFrame(() => {
    showMiniMap()
  })
})

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
  if (lf && nodeClickListener) lf.off('node:click', nodeClickListener)
  if (lf && blankClickListener) lf.off('blank:click', blankClickListener)
  if (lf && nodeDeleteListener) lf.off('node:delete', nodeDeleteListener)
  if (lf && nodeResizeListener) lf.off('node:resize', nodeResizeListener)
  nodeClickListener = null
  blankClickListener = null
  nodeDeleteListener = null
  nodeResizeListener = null
  lf?.destroy()
  lf = null
})
</script>

<template>
  <div class="command-menu-mask flowchart-editor-mask" @click.self="onCancel">
    <div class="flowchart-editor-dialog" :class="{ 'is-fullscreen': isFullscreen }" @click.stop>
      <div class="flowchart-editor-head">
        <div class="flowchart-editor-head-top">
          <div class="flowchart-editor-title">{{ dialogTitle }}</div>
          <button
            type="button"
            class="btn ghost flowchart-fullscreen-btn"
            :disabled="saving"
            @click="toggleFullscreen"
          >
            {{ fullscreenButtonText }}
          </button>
        </div>
        <input
          v-model="titleInput"
          class="command-input flowchart-title-input"
          type="text"
          placeholder="流程图标题"
          :disabled="saving"
        />
      </div>

      <div class="flowchart-editor-body">
        <aside class="flowchart-palette">
          <div class="flowchart-palette-title">节点库（点击或拖拽）</div>
          <div class="flowchart-palette-sections">
            <section v-for="group in paletteItemsByGroup" :key="group.key" class="flowchart-palette-group">
              <h4 class="flowchart-palette-group-title">{{ group.label }}</h4>
              <div class="flowchart-palette-grid">
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  class="flowchart-palette-item"
                  :class="{ 'is-dragging': draggingPaletteKey === item.key }"
                  :draggable="!saving"
                  :disabled="saving"
                  @click="addNodeByType(item.key)"
                  @dragstart="onPaletteDragStart($event, item.key)"
                  @dragend="onPaletteDragEnd"
                >
                  <span class="flowchart-shape" :data-shape="item.hint"></span>
                  <span class="flowchart-palette-item-label">{{ item.label }}</span>
                </button>
              </div>
            </section>
          </div>
        </aside>

        <div
          class="flowchart-canvas-wrap"
          :class="{ 'is-drop-active': canvasDropActive }"
          @dragover="onCanvasDragOver"
          @dragleave="onCanvasDragLeave"
          @drop="onCanvasDrop"
        >
          <div ref="hostRef" class="flowchart-editor-host"></div>
          <div v-if="canvasDropActive" class="flowchart-drop-hint">释放鼠标即可插入节点</div>

          <div class="flowchart-canvas-toolbar" role="toolbar" aria-label="流程图工具栏">
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="zoomIn">放大</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="zoomOut">缩小</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="fitToView">自适应</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="undo">上一步</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="redo">下一步</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving || exporting" @click="exportImage">{{ exportButtonText }}</button>
            <button type="button" class="flowchart-tool-btn" :disabled="saving" @click="openJsonPanel">{{ jsonButtonText }}</button>
            <span class="flowchart-zoom-badge">{{ zoomPercent }}%</span>
          </div>

          <div class="flowchart-canvas-footer">
            <button type="button" class="flowchart-helper-btn" :disabled="saving" @click="resetDefaultScene">恢复示例</button>
            <button type="button" class="flowchart-helper-btn" :disabled="saving" @click="clearScene">清空画布</button>
            <span class="flowchart-tools-tip">支持拖拽节点入画布，拖动锚点可连线，双击节点可编辑文字</span>
          </div>
        </div>

        <aside class="flowchart-style-panel" :class="{ 'is-empty': !hasSelectedNode }">
          <div class="flowchart-style-title">节点属性</div>
          <template v-if="hasSelectedNode">
            <div class="flowchart-style-meta">
              <span class="flowchart-style-type">{{ nodeTypeBadge }}</span>
              <span class="flowchart-style-id">{{ selectedNodeId }}</span>
            </div>

            <label class="flowchart-style-field">
              <span>文字内容</span>
              <input
                v-model="nodeStyleForm.text"
                type="text"
                class="command-input"
                :disabled="saving"
                @input="onNodeStyleInput"
              />
            </label>

            <div class="flowchart-style-row">
              <label class="flowchart-style-field">
                <span>文字颜色</span>
                <input
                  v-model="nodeStyleForm.textColor"
                  type="color"
                  class="flowchart-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
              <label class="flowchart-style-field">
                <span>字号</span>
                <input
                  v-model.number="nodeStyleForm.fontSize"
                  type="number"
                  class="command-input flowchart-number-input"
                  min="10"
                  max="72"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
            </div>

            <div class="flowchart-style-row">
              <label class="flowchart-style-field">
                <span>背景色</span>
                <input
                  v-model="nodeStyleForm.fill"
                  type="color"
                  class="flowchart-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
              <label class="flowchart-style-field">
                <span>边框色</span>
                <input
                  v-model="nodeStyleForm.stroke"
                  type="color"
                  class="flowchart-color-input"
                  :disabled="saving"
                  @input="onNodeStyleInput"
                />
              </label>
            </div>

            <label class="flowchart-style-field">
              <span>边框粗细</span>
              <input
                v-model.number="nodeStyleForm.strokeWidth"
                type="number"
                class="command-input flowchart-number-input"
                min="0"
                max="12"
                step="0.2"
                :disabled="saving"
                @input="onNodeStyleInput"
              />
            </label>

            <div class="flowchart-style-row">
              <label class="flowchart-style-field">
                <span>宽度</span>
                <input
                  v-model.number="nodeStyleForm.width"
                  type="number"
                  class="command-input flowchart-number-input"
                  min="36"
                  max="560"
                  :disabled="saving || !nodeSupportsSize"
                  @input="onNodeStyleInput"
                />
              </label>
              <label class="flowchart-style-field">
                <span>高度</span>
                <input
                  v-model.number="nodeStyleForm.height"
                  type="number"
                  class="command-input flowchart-number-input"
                  min="28"
                  max="360"
                  :disabled="saving || !nodeSupportsSize"
                  @input="onNodeStyleInput"
                />
              </label>
            </div>

            <label class="flowchart-style-field">
              <span>圆角</span>
              <input
                v-model.number="nodeStyleForm.radius"
                type="number"
                class="command-input flowchart-number-input"
                min="0"
                max="80"
                :disabled="saving || !nodeSupportsRadius"
                @input="onNodeStyleInput"
              />
            </label>

            <button type="button" class="flowchart-style-reset" :disabled="saving" @click="resetSelectedNodeStyle">
              重置样式
            </button>
          </template>
          <div v-else class="flowchart-style-empty-tip">点击画布中的节点后，可在这里编辑样式与尺寸。</div>
        </aside>
      </div>

      <p v-if="error" class="flowchart-editor-error">{{ error }}</p>

      <div class="flowchart-editor-actions">
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>

    <div v-if="jsonVisible" class="flowchart-json-mask" @click.self="closeJsonPanel">
      <div class="flowchart-json-dialog" @click.stop>
        <div class="flowchart-json-head">
          <strong>流程图 JSON</strong>
          <div class="flowchart-json-actions">
            <button type="button" class="btn xs" @click="copyJson">{{ jsonCopied ? '已复制' : '复制' }}</button>
            <button type="button" class="btn xs ghost" @click="closeJsonPanel">关闭</button>
          </div>
        </div>
        <pre class="flowchart-json-content">{{ jsonContent }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flowchart-editor-mask {
  z-index: 38;
}

.flowchart-editor-dialog {
  width: min(1320px, calc(100vw - 20px));
  height: min(820px, calc(100vh - 22px));
  background: #fff;
  border: 1px solid #d8e2ee;
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(18, 33, 52, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.flowchart-editor-dialog.is-fullscreen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-radius: 0;
  border: 0;
}

.flowchart-editor-head {
  padding: 12px 14px;
  border-bottom: 1px solid #e2eaf5;
  display: grid;
  gap: 8px;
  background: linear-gradient(180deg, #f9fbff, #f4f8ff);
}

.flowchart-editor-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.flowchart-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: #2a415e;
}

.flowchart-fullscreen-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
}

.flowchart-title-input {
  max-width: 420px;
}

.flowchart-editor-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px 1fr 268px;
  background: #f1f5fc;
}

.flowchart-palette {
  border-right: 1px solid #dce5f2;
  background: linear-gradient(180deg, #f9fbff 0%, #f3f7ff 100%);
  padding: 10px;
  overflow: auto;
}

.flowchart-style-panel {
  border-left: 1px solid #dce5f2;
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%);
  padding: 12px 10px;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 10px;
}

.flowchart-style-panel.is-empty {
  justify-items: stretch;
}

.flowchart-style-title {
  font-size: 12px;
  font-weight: 700;
  color: #24405f;
}

.flowchart-style-meta {
  display: grid;
  gap: 4px;
}

.flowchart-style-type {
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

.flowchart-style-id {
  font-size: 11px;
  color: #637d9a;
  word-break: break-all;
}

.flowchart-style-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: #335270;
}

.flowchart-style-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.flowchart-color-input {
  width: 100%;
  height: 32px;
  border: 1px solid #c9d9ec;
  border-radius: 8px;
  background: #fff;
  padding: 2px;
  cursor: pointer;
}

.flowchart-number-input {
  width: 100%;
}

.flowchart-style-reset {
  border: 1px solid #c6d8ef;
  background: #fff;
  color: #244361;
  border-radius: 8px;
  height: 32px;
  font-size: 12px;
  cursor: pointer;
}

.flowchart-style-reset:hover {
  border-color: #94b1d7;
  background: #f3f8ff;
}

.flowchart-style-empty-tip {
  font-size: 12px;
  color: #5e7896;
  border: 1px dashed #c5d5e9;
  border-radius: 10px;
  background: #f8fbff;
  padding: 12px;
  line-height: 1.5;
}

.flowchart-palette-title {
  font-size: 12px;
  font-weight: 700;
  color: #27425e;
  margin-bottom: 10px;
}

.flowchart-palette-sections {
  display: grid;
  gap: 12px;
}

.flowchart-palette-group {
  display: grid;
  gap: 8px;
}

.flowchart-palette-group-title {
  margin: 0;
  font-size: 12px;
  color: #4f6783;
  font-weight: 700;
}

.flowchart-palette-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.flowchart-palette-item {
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

.flowchart-palette-item:hover {
  border-color: #98b3d7;
  box-shadow: 0 6px 12px rgba(22, 52, 90, 0.12);
  transform: translateY(-1px);
}

.flowchart-palette-item.is-dragging {
  border-color: #2e73ff;
  box-shadow: 0 0 0 2px rgba(46, 115, 255, 0.2);
}

.flowchart-palette-item-label {
  min-width: 0;
  font-size: 12px;
  color: #1f3751;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flowchart-shape {
  width: 24px;
  height: 16px;
  border: 2px solid #6f8fb6;
  display: inline-block;
  background: #ffffff;
  flex-shrink: 0;
}

.flowchart-shape[data-shape='round'] {
  border-radius: 8px;
}

.flowchart-shape[data-shape='circle'] {
  border-radius: 999px;
  width: 22px;
  height: 22px;
  border-color: #f08b66;
}

.flowchart-shape[data-shape='diamond'] {
  width: 18px;
  height: 18px;
  transform: rotate(45deg);
  border-color: #7d96dd;
}

.flowchart-shape[data-shape='ellipse'] {
  width: 26px;
  height: 18px;
  border-radius: 50% / 45%;
  border-color: #6f9bc4;
}

.flowchart-shape[data-shape='text'] {
  border: 0;
  width: 24px;
  height: 20px;
  position: relative;
}

.flowchart-shape[data-shape='text']::before {
  content: 'T';
  position: absolute;
  inset: 0;
  font-size: 14px;
  font-weight: 700;
  color: #577296;
  display: grid;
  place-items: center;
}

.flowchart-shape[data-shape='task'] {
  border-radius: 7px;
  width: 24px;
  height: 16px;
  box-shadow: inset 0 0 0 1px rgba(85, 109, 136, 0.5);
}

.flowchart-shape[data-shape='gateway'] {
  width: 18px;
  height: 18px;
  transform: rotate(45deg);
  border-color: #4f74c6;
  box-shadow: inset 0 0 0 1px rgba(79, 116, 198, 0.25);
}

.flowchart-shape[data-shape='event'] {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border-color: #6e8ec0;
  box-shadow: inset 0 0 0 2px rgba(110, 142, 192, 0.2);
}

.flowchart-shape[data-shape='comment'] {
  width: 22px;
  height: 16px;
  border-radius: 4px;
  border-color: #6f8fb6;
  border-left-width: 4px;
}

.flowchart-canvas-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.flowchart-canvas-wrap.is-drop-active::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed rgba(61, 120, 219, 0.42);
  border-radius: 10px;
  pointer-events: none;
  z-index: 24;
}

.flowchart-editor-host {
  width: 100%;
  height: 100%;
}

.flowchart-drop-hint {
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

.flowchart-canvas-toolbar {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 25;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d6e0ef;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 22px rgba(24, 46, 74, 0.16);
  backdrop-filter: blur(6px);
}

.flowchart-tool-btn {
  border: 1px solid #d6e0ef;
  background: #ffffff;
  color: #20384f;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.flowchart-tool-btn:hover {
  border-color: #9fb4d0;
  background: #f3f7fd;
}

.flowchart-zoom-badge {
  height: 28px;
  min-width: 54px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid #cad8eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2f4f71;
  font-size: 12px;
  font-weight: 700;
  background: #f9fbff;
}

.flowchart-canvas-footer {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 22;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(208, 221, 240, 0.92);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(4px);
}

.flowchart-helper-btn {
  border: 1px solid #d4dff0;
  background: #fff;
  color: #1f3850;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.flowchart-helper-btn:hover {
  border-color: #9eb5d9;
  background: #f5f9ff;
}

.flowchart-tools-tip {
  font-size: 12px;
  color: #5d748f;
  margin-left: auto;
}

.flowchart-editor-error {
  margin: 0;
  padding: 10px 14px 0;
  color: #c1383c;
  font-size: 12px;
}

.flowchart-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid #e2eaf5;
  background: #fff;
}

.flowchart-json-mask {
  position: absolute;
  inset: 0;
  background: rgba(10, 18, 30, 0.35);
  display: grid;
  place-items: center;
  z-index: 45;
}

.flowchart-json-dialog {
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

.flowchart-json-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e3ebf7;
  background: #f8fbff;
}

.flowchart-json-actions {
  display: flex;
  gap: 6px;
}

.flowchart-json-content {
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  background: #0f1727;
  color: #d3e6ff;
}
</style>

