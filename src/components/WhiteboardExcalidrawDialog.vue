<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

interface WhiteboardSceneSnapshot {
  elements: readonly unknown[]
  appState: Partial<AppState>
  files: BinaryFiles
}

interface WhiteboardSavePayload {
  title: string
  previewUrl: string
  scene: WhiteboardSceneSnapshot
}

const props = defineProps<{
  mode: 'insert' | 'edit'
  title: string
  initialScene: unknown
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'save', payload: WhiteboardSavePayload): void
}>()

const hostRef = ref<HTMLDivElement | null>(null)
const titleInput = ref(props.title || '白板')
const saving = ref(false)
const error = ref('')
const isFullscreen = ref(false)

let reactRoot: Root | null = null
let excalidrawApi: ExcalidrawImperativeAPI | null = null

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑白板（Excalidraw）' : '插入白板（Excalidraw）'))
const confirmText = computed(() => {
  if (saving.value) return '保存中...'
  return props.mode === 'edit' ? '保存' : '插入'
})
const fullscreenButtonText = computed(() => (isFullscreen.value ? '退出全屏' : '全屏编辑'))

watch(
  () => props.title,
  (value) => {
    titleInput.value = value || '白板'
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

function disposeRoot() {
  if (!reactRoot) return
  reactRoot.unmount()
  reactRoot = null
  excalidrawApi = null
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = reader.result
      if (typeof value === 'string') {
        resolve(value)
        return
      }
      reject(new Error('白板预览导出失败'))
    }
    reader.onerror = () => {
      reject(new Error('白板预览导出失败'))
    }
    reader.readAsDataURL(blob)
  })
}

function toSnapshot(api: ExcalidrawImperativeAPI): WhiteboardSceneSnapshot {
  const appState = api.getAppState()

  return {
    elements: api.getSceneElementsIncludingDeleted(),
    files: api.getFiles(),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      currentItemStrokeColor: appState.currentItemStrokeColor,
      currentItemBackgroundColor: appState.currentItemBackgroundColor,
      currentItemFillStyle: appState.currentItemFillStyle,
      currentItemStrokeWidth: appState.currentItemStrokeWidth,
      currentItemStrokeStyle: appState.currentItemStrokeStyle,
      currentItemRoughness: appState.currentItemRoughness,
      currentItemOpacity: appState.currentItemOpacity,
      currentItemFontFamily: appState.currentItemFontFamily,
      currentItemFontSize: appState.currentItemFontSize,
      currentItemTextAlign: appState.currentItemTextAlign,
      currentItemRoundness: appState.currentItemRoundness,
      currentItemStartArrowhead: appState.currentItemStartArrowhead,
      currentItemEndArrowhead: appState.currentItemEndArrowhead,
      gridSize: appState.gridSize,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
      theme: appState.theme,
    },
  }
}

async function onConfirm() {
  if (!excalidrawApi || saving.value) return

  saving.value = true
  error.value = ''

  try {
    const snapshot = toSnapshot(excalidrawApi)
    const currentAppState = excalidrawApi.getAppState()
    const blob = await exportToBlob({
      elements: snapshot.elements,
      appState: {
        ...currentAppState,
        exportBackground: true,
      },
      files: snapshot.files,
      mimeType: 'image/png',
      quality: 1,
    })
    const previewUrl = await toDataUrl(blob)

    emit('save', {
      title: titleInput.value.trim() || '白板',
      previewUrl,
      scene: snapshot,
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '白板保存失败，请重试'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!hostRef.value) return

  reactRoot = createRoot(hostRef.value)
  reactRoot.render(
    React.createElement(Excalidraw, {
      initialData: (props.initialScene as ExcalidrawInitialDataState | null) ?? undefined,
      excalidrawAPI: (api: ExcalidrawImperativeAPI) => {
        excalidrawApi = api
      },
      autoFocus: true,
    })
  )
})

onBeforeUnmount(() => {
  disposeRoot()
})
</script>

<template>
  <div class="command-menu-mask whiteboard-editor-mask" @click.self="onCancel">
    <div class="whiteboard-editor-dialog" :class="{ 'is-fullscreen': isFullscreen }" @click.stop>
      <div class="whiteboard-editor-head">
        <div class="whiteboard-editor-head-top">
          <div class="whiteboard-editor-title">{{ dialogTitle }}</div>
          <button
            type="button"
            class="btn ghost whiteboard-fullscreen-btn"
            :disabled="saving"
            @click="toggleFullscreen"
          >
            {{ fullscreenButtonText }}
          </button>
        </div>
        <input
          v-model="titleInput"
          class="command-input whiteboard-title-input"
          type="text"
          placeholder="白板标题"
          :disabled="saving"
        />
      </div>

      <div class="whiteboard-editor-body">
        <div ref="hostRef" class="whiteboard-editor-host"></div>
      </div>

      <p v-if="error" class="whiteboard-editor-error">{{ error }}</p>

      <div class="whiteboard-editor-actions">
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.whiteboard-editor-mask {
  z-index: 38;
}

.whiteboard-editor-dialog {
  width: min(1100px, calc(100vw - 24px));
  height: min(780px, calc(100vh - 28px));
  background: #fff;
  border: 1px solid #d8e2ee;
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(18, 33, 52, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.whiteboard-editor-dialog.is-fullscreen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-radius: 0;
  border: 0;
}

.whiteboard-editor-head {
  padding: 12px 14px;
  border-bottom: 1px solid #e2eaf5;
  display: grid;
  gap: 8px;
  background: linear-gradient(180deg, #f9fbff, #f4f8ff);
}

.whiteboard-editor-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.whiteboard-editor-title {
  font-size: 14px;
  font-weight: 700;
  color: #2a415e;
}

.whiteboard-fullscreen-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
}

.whiteboard-title-input {
  max-width: 360px;
}

.whiteboard-editor-body {
  flex: 1;
  min-height: 0;
  background: #f4f7fc;
}

.whiteboard-editor-host {
  width: 100%;
  height: 100%;
}

.whiteboard-editor-error {
  margin: 0;
  padding: 10px 14px 0;
  color: #c1383c;
  font-size: 12px;
}

.whiteboard-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px 14px;
  border-top: 1px solid #e2eaf5;
  background: #fff;
}
</style>

