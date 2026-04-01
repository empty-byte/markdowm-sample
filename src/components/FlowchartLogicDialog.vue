<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import LogicFlow from '@logicflow/core'
import { MiniMap, Snapshot } from '@logicflow/extension'
import '@logicflow/core/es/index.css'
import '@logicflow/extension/es/index.css'

type FlowchartSceneSnapshot = Parameters<LogicFlow['render']>[0]

interface FlowchartSavePayload {
  title: string
  previewUrl: string
  scene: FlowchartSceneSnapshot
}

type PaletteNodeType = 'start' | 'process' | 'decision' | 'rerun' | 'parallel' | 'end'

interface PaletteItem {
  key: PaletteNodeType
  label: string
  hint: string
}

const paletteItems: PaletteItem[] = [
  { key: 'start', label: '开始', hint: 'circle' },
  { key: 'process', label: '处理', hint: 'rect' },
  { key: 'decision', label: '判断', hint: 'diamond' },
  { key: 'rerun', label: '重复', hint: 'rect' },
  { key: 'parallel', label: '并行', hint: 'rect' },
  { key: 'end', label: '结束', hint: 'circle' },
]

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

let lf: LogicFlow | null = null
let nodeSeed = 0
let copyTimer: ReturnType<typeof setTimeout> | null = null

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑流程图（LogicFlow）' : '插入流程图（LogicFlow）'))
const confirmText = computed(() => {
  if (saving.value) return '保存中...'
  return props.mode === 'edit' ? '保存' : '插入'
})
const fullscreenButtonText = computed(() => (isFullscreen.value ? '退出全屏' : '全屏编辑'))
const exportButtonText = computed(() => (exporting.value ? '导出中...' : '导出图片'))
const jsonButtonText = computed(() => (jsonVisible.value ? '刷新 JSON' : '查看 JSON'))

watch(
  () => props.title,
  (value) => {
    titleInput.value = value || '流程图'
  }
)

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

function getNodeConfigByPalette(type: PaletteNodeType) {
  if (type === 'start') return { nodeType: 'circle', text: '开始' }
  if (type === 'process') return { nodeType: 'rect', text: '处理' }
  if (type === 'decision') return { nodeType: 'diamond', text: '判断' }
  if (type === 'rerun') return { nodeType: 'rect', text: '重复' }
  if (type === 'parallel') return { nodeType: 'rect', text: '并行' }
  return { nodeType: 'circle', text: '结束' }
}

function addNodeByType(type: PaletteNodeType) {
  if (!lf || saving.value) return

  nodeSeed += 1
  const col = (nodeSeed - 1) % 5
  const row = Math.floor((nodeSeed - 1) / 5)
  const config = getNodeConfigByPalette(type)

  lf.addNode({
    type: config.nodeType,
    x: 240 + col * 190,
    y: 150 + row * 120,
    text: config.text,
  })
}

function resetDefaultScene() {
  if (!lf || saving.value) return
  lf.render(createDefaultScene())
  applyDefaultViewport()
  refreshNodeSeed()
}

function clearScene() {
  if (!lf || saving.value) return
  lf.clearData()
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

  const initialScene = normalizeScene(props.initialScene)
  lf.render(cloneScene(initialScene))
  applyDefaultViewport()
  refreshNodeSeed()

  requestAnimationFrame(() => {
    showMiniMap()
  })
})

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
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
          <button
            v-for="item in paletteItems"
            :key="item.key"
            type="button"
            class="flowchart-palette-item"
            :disabled="saving"
            @click="addNodeByType(item.key)"
          >
            <span class="flowchart-shape" :data-shape="item.hint"></span>
            <span>{{ item.label }}</span>
          </button>
        </aside>

        <div class="flowchart-canvas-wrap">
          <div ref="hostRef" class="flowchart-editor-host"></div>

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
            <span class="flowchart-tools-tip">拖动锚点可连线，双击节点可编辑文字</span>
          </div>
        </div>
      </div>

      <p v-if="error" class="flowchart-editor-error">{{ error }}</p>

      <div class="flowchart-editor-actions">
        <button type="button" class="btn" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
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
  grid-template-columns: 92px 1fr;
  background: #f1f5fc;
}

.flowchart-palette {
  border-right: 1px solid #dce5f2;
  background: linear-gradient(180deg, #f9fbff 0%, #f3f7ff 100%);
  padding: 10px 8px;
  display: grid;
  gap: 8px;
  align-content: start;
}

.flowchart-palette-item {
  border: 1px solid #d8e3f3;
  border-radius: 10px;
  background: #fff;
  color: #23384f;
  font-size: 12px;
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 8px 4px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.flowchart-palette-item:hover {
  border-color: #98b3d7;
  box-shadow: 0 8px 16px rgba(22, 52, 90, 0.12);
  transform: translateY(-1px);
}

.flowchart-shape {
  width: 24px;
  height: 16px;
  border: 2px solid #6f8fb6;
  display: inline-block;
  background: #ffffff;
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

.flowchart-canvas-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.flowchart-editor-host {
  width: 100%;
  height: 100%;
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
