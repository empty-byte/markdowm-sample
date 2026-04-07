<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isValidEmbedUrl } from '../features/editor-enhance/embeds'

interface Props {
  mode: 'insert' | 'edit'
  initialUrl?: string
  initialTitle?: string
}

interface EmbedWebDialogConfirmPayload {
  url: string
  title: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'insert',
  initialUrl: '',
  initialTitle: '',
})

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'confirm', payload: EmbedWebDialogConfirmPayload): void
}>()

const urlInput = ref('')
const titleInput = ref('')

const urlValid = computed(() => {
  const url = urlInput.value.trim()
  return url.length > 0 && isValidEmbedUrl(url)
})

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑内嵌网页' : '插入内嵌网页'))
const confirmText = computed(() => (props.mode === 'edit' ? '保存' : '插入'))

watch(
  () => [props.mode, props.initialUrl, props.initialTitle],
  () => {
    // Reset form whenever dialog mode/target changes.
    urlInput.value = props.initialUrl || ''
    titleInput.value = props.initialTitle || ''
  },
  { immediate: true }
)

/**
 * Handle onCancel logic.
 */
function onCancel() {
  emit('cancel')
}

/**
 * Handle onConfirm logic.
 */
function onConfirm() {
  // Guard invalid URL and normalize payload before sending to parent editor logic.
  if (!urlValid.value) return

  emit('confirm', {
    url: urlInput.value.trim(),
    title: titleInput.value.trim() || '内嵌网页',
  })
}
</script>

<template>
  <div class="command-menu-mask ed-modal-mask" @click="onCancel">
    <div class="embed-dialog ed-modal-panel ed-modal-panel--compact" @click.stop>
      <div class="embed-dialog-title ed-modal-header">
        <div class="ed-modal-header__stack">
          <h2 class="ed-modal-title">{{ dialogTitle }}</h2>
          <div class="ed-modal-subtitle">粘贴一个可嵌入的 HTTPS 地址，统一使用同一套弹框外壳。</div>
        </div>
      </div>

      <div class="embed-dialog-body ed-modal-body">
        <div class="ed-modal-section">
          <div class="ed-modal-section__title">链接信息</div>
          <div class="ed-modal-section__body">
            <label class="embed-field ed-modal-field">
              <span class="ed-modal-field__label">网站地址（仅 HTTPS）</span>
              <input
                v-model="urlInput"
                class="command-input ed-modal-input"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                autofocus
                @keydown.enter.prevent="onConfirm"
                @keydown.escape.prevent="onCancel"
              />
            </label>
            <label class="embed-field ed-modal-field">
              <span class="ed-modal-field__label">标题（可选）</span>
              <input
                v-model="titleInput"
                class="command-input ed-modal-input"
                type="text"
                placeholder="内嵌网页"
                @keydown.enter.prevent="onConfirm"
                @keydown.escape.prevent="onCancel"
              />
            </label>
            <p v-if="urlInput.trim() && !urlValid" class="embed-url-error ed-modal-note">请输入合法的 HTTPS 链接</p>
          </div>
        </div>
      </div>

      <div class="embed-dialog-actions ed-modal-actions">
        <button type="button" class="btn ghost" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="!urlValid" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.embed-dialog {
  width: min(640px, calc(100vw - 32px));
}

.embed-url-error {
  color: var(--ed-color-danger);
}
</style>
