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
    urlInput.value = props.initialUrl || ''
    titleInput.value = props.initialTitle || ''
  },
  { immediate: true }
)

function onCancel() {
  emit('cancel')
}

function onConfirm() {
  if (!urlValid.value) return

  emit('confirm', {
    url: urlInput.value.trim(),
    title: titleInput.value.trim() || '内嵌网页',
  })
}
</script>

<template>
  <div class="command-menu-mask" @click="onCancel">
    <div class="embed-dialog" @click.stop>
      <div class="embed-dialog-title">{{ dialogTitle }}</div>
      <div class="embed-dialog-body">
        <label class="embed-field">
          <span>网页地址（仅 HTTPS）</span>
          <input
            v-model="urlInput"
            class="command-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            autofocus
            @keydown.enter.prevent="onConfirm"
            @keydown.escape.prevent="onCancel"
          />
        </label>
        <label class="embed-field">
          <span>标题（可选）</span>
          <input
            v-model="titleInput"
            class="command-input"
            type="text"
            placeholder="内嵌网页"
            @keydown.enter.prevent="onConfirm"
            @keydown.escape.prevent="onCancel"
          />
        </label>
        <p v-if="urlInput.trim() && !urlValid" class="embed-url-error">请输入合法的 HTTPS 链接</p>
      </div>
      <div class="embed-dialog-actions">
        <button type="button" class="btn ghost" @click="onCancel">取消</button>
        <button type="button" class="btn primary" :disabled="!urlValid" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>
