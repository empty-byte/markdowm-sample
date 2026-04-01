<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LogicFlow from '@logicflow/core'
import { Snapshot } from '@logicflow/extension'
import '@logicflow/core/es/index.css'
import '@logicflow/extension/es/index.css'

type FlowchartSceneSnapshot = Parameters<LogicFlow['render']>[0]

interface FlowchartSavePayload {
  title: string
  previewUrl: string
  scene: FlowchartSceneSnapshot
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
const error = ref('')
const isFullscreen = ref(false)

let lf: LogicFlow | null = null
let nodeSeed = 0

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑流程图（LogicFlow）' : '插入流程图（LogicFlow）'))
const confirmText = computed(() => {
  if (saving.value) return '保存中...'
  return props.mode === 'edit' ? '保存' : '插入'
})
const fullscreenButtonText = computed(() => (isFullscreen.value ? '退出全屏' : '全屏编辑'))

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
}

function ensureExtensions() {
  if (flowchartExtensionsInstalled) return
  LogicFlow.use(Snapshot)
  flowchartExtensionsInstalled = true
}

function cloneScene(scene: FlowchartSceneSnapshot): FlowchartSceneSnapshot {
  if (typeof structuredClone === 'function') {
    return structuredClone(scene)
  }

  return JSON.parse(JSON.stringify(scene)) as FlowchartSceneSnapshot
}

function createDefaultScene(): FlowchartSceneSnapshot {
  return {
    nodes: [
      { id: 'start_1', type: 'circle', x: 150, y: 130, text: '开始' },
      { id: 'task_1', type: 'rect', x: 380, y: 130, text: '处理步骤' },
      { id: 'end_1', type: 'circle', x: 620, y: 130, text: '结束' },
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

  const input = value as { nodes?: unknown; edges?: unknown }
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

function refreshNodeSeed() {
  if (!lf) return

  const graph = lf.getGraphRawData() as { nodes?: unknown[] }
  nodeSeed = Array.isArray(graph.nodes) ? graph.nodes.length : 0
}

function addNode(type: 'rect' | 'diamond' | 'circle', text: string) {
  if (!lf || saving.value) return

  nodeSeed += 1
  const col = (nodeSeed - 1) % 4
  const row = Math.floor((nodeSeed - 1) / 4)

  lf.addNode({
    type,
    x: 180 + col * 180,
    y: 130 + row * 110,
    text,
  })
}

function resetDefaultScene() {
  if (!lf || saving.value) return
  lf.render(createDefaultScene())
  lf.fitView(24, 24)
  refreshNodeSeed()
}

function clearScene() {
  if (!lf || saving.value) return
  lf.clearData()
  refreshNodeSeed()
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

onMounted(() => {
  if (!hostRef.value) return

  ensureExtensions()

  lf = new LogicFlow({
    container: hostRef.value,
    grid: true,
    background: {
      color: '#f6f9ff',
    },
  })

  const initialScene = normalizeScene(props.initialScene)
  lf.render(cloneScene(initialScene))
  lf.fitView(24, 24)
  refreshNodeSeed()
})

onBeforeUnmount(() => {
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

      <div class="flowchart-editor-tools">
        <button type="button" class="btn xs" :disabled="saving" @click="addNode('circle', '开始')">开始节点</button>
        <button type="button" class="btn xs" :disabled="saving" @click="addNode('rect', '处理')">处理节点</button>
        <button type="button" class="btn xs" :disabled="saving" @click="addNode('diamond', '判断')">判断节点</button>
        <button type="button" class="btn xs ghost" :disabled="saving" @click="resetDefaultScene">恢复示例</button>
        <button type="button" class="btn xs ghost" :disabled="saving" @click="clearScene">清空</button>
        <span class="flowchart-tools-tip">连线方式：拖动节点锚点到目标节点</span>
      </div>

      <div class="flowchart-editor-body">
        <div ref="hostRef" class="flowchart-editor-host"></div>
      </div>

      <p v-if="error" class="flowchart-editor-error">{{ error }}</p>

      <div class="flowchart-editor-actions">
        <button type="button" class="btn" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flowchart-editor-mask {
  z-index: 38;
}

.flowchart-editor-dialog {
  width: min(1200px, calc(100vw - 24px));
  height: min(780px, calc(100vh - 28px));
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
  max-width: 360px;
}

.flowchart-editor-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #e2eaf5;
  background: #ffffff;
}

.flowchart-tools-tip {
  font-size: 12px;
  color: #6a7b90;
  margin-left: 8px;
}

.flowchart-editor-body {
  flex: 1;
  min-height: 0;
  background: #f2f6fd;
}

.flowchart-editor-host {
  width: 100%;
  height: 100%;
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
</style>
