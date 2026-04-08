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

/**
 * Handle onCancel logic.
 */
function onCancel() {
  // Avoid closing during save to prevent partial state.
  if (saving.value) return
  emit('cancel')
}

/**
 * Handle toggleFullscreen logic.
 */
function toggleFullscreen() {
  if (saving.value) return
  isFullscreen.value = !isFullscreen.value
}

/**
 * Handle disposeRoot logic.
 */
function disposeRoot() {
  // React root must be unmounted to avoid memory leaks when dialog closes.
  if (!reactRoot) return
  reactRoot.unmount()
  reactRoot = null
  excalidrawApi = null
}

/**
 * Handle toDataUrl logic.
 * @param blob - Parameter.
 * @returns Return value.
 */
function toDataUrl(blob: Blob): Promise<string> {
  // Convert exported PNG blob to DataURL for Markdown preview persistence.
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

/**
 * Handle toSnapshot logic.
 * @param api - Parameter.
 * @returns Return value.
 */
function toSnapshot(api: ExcalidrawImperativeAPI): WhiteboardSceneSnapshot {
  // Persist only the app state fields we actually reuse on next open.
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

/**
 * Handle onConfirm logic.
 */
async function onConfirm() {
  if (!excalidrawApi || saving.value) return

  // Export scene as PNG preview + raw scene snapshot, then emit to parent.
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
  <div class="command-menu-mask ed-modal-mask whiteboard-editor-mask" @click.self="onCancel">
    <div class="whiteboard-editor-dialog ed-modal-panel ed-modal-panel--wide" :class="{ 'is-fullscreen': isFullscreen }" @click.stop>
      <div class="whiteboard-editor-head ed-modal-header">
        <div class="whiteboard-editor-head-top ed-modal-header__top">
          <div class="ed-modal-header__stack">
            <div class="whiteboard-editor-title ed-modal-title">{{ dialogTitle }}</div>
            <div class="ed-modal-subtitle">统一的编辑外壳，保留 Excalidraw 画布能力与保存流程。</div>
          </div>
          <button
            type="button"
            class="btn ghost whiteboard-fullscreen-btn"
            :disabled="saving"
            @click="toggleFullscreen"
          >
            {{ fullscreenButtonText }}
          </button>
        </div>
      </div>

      <div class="whiteboard-editor-body ed-modal-body">
        <section class="ed-modal-section whiteboard-meta-panel">
          <div class="ed-modal-section__title">白板信息</div>
          <div class="ed-modal-section__body">
            <label class="ed-modal-field">
              <span class="ed-modal-field__label">白板标题</span>
              <input
                v-model="titleInput"
                class="command-input ed-modal-input whiteboard-title-input"
                type="text"
                placeholder="白板标题"
                :disabled="saving"
              />
            </label>
          </div>
        </section>

        <section class="ed-modal-section whiteboard-canvas-panel">
          <div class="ed-modal-section__title">画布</div>
          <div class="whiteboard-editor-host-wrap">
            <div ref="hostRef" class="whiteboard-editor-host"></div>
          </div>
        </section>
      </div>

      <p v-if="error" class="whiteboard-editor-error ed-modal-note">{{ error }}</p>

      <div class="whiteboard-editor-actions ed-modal-actions">
        <button type="button" class="btn ghost" :disabled="saving" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="saving" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.whiteboard-editor-mask {
  z-index: 1300;
}

.whiteboard-editor-dialog {
  width: min(1180px, calc(100vw - 32px));
  height: min(820px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.whiteboard-editor-dialog.is-fullscreen {
  width: 100vw;
  height: 100vh;
  max-width: none;
  border-radius: 0;
  border: 0;
}

.whiteboard-editor-head {
  padding: 0;
}

.whiteboard-editor-head-top {
  align-items: center;
}

.whiteboard-editor-title {
  line-height: 1.25;
  padding-left: 2px;
}

.whiteboard-fullscreen-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
}

.whiteboard-editor-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.whiteboard-meta-panel {
  padding: 12px;
}

.whiteboard-canvas-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.whiteboard-editor-host-wrap {
  min-height: 0;
  flex: 1;
  min-height: 460px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(241, 243, 252, 0.92), rgba(251, 252, 255, 0.96));
  border: 1px solid color-mix(in srgb, var(--ed-dialog-border, #c7d2e3) 78%, white);
}

.whiteboard-editor-host {
  width: 100%;
  height: 100%;
}

:deep(.whiteboard-editor-host .excalidraw) {
  width: 100%;
  height: 100%;
}

:deep(.whiteboard-editor-host .excalidraw .layer-ui__wrapper) {
  border-radius: 12px;
}

.whiteboard-editor-error {
  margin: 0;
}

.whiteboard-editor-actions {
  justify-content: flex-end;
}
</style>
