<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EditorComment } from '../features/editor-enhance/comments'
import '../styles/pixel-right.css'

const props = defineProps<{
  comments: EditorComment[]
  activeCommentId: string | null
  commentsCollapsed: boolean
  selectedQuote: string
  hasSelectedRange: boolean
  commentDraft: string
}>()

const emit = defineEmits<{
  'toggle-collapse': []
  'update:commentDraft': [value: string]
  'submit-comment': []
  'focus-comment': [item: EditorComment]
  'delete-comment': [id: string]
}>()

const commentDraftModel = computed({
  get: () => props.commentDraft,
  set: (value: string) => emit('update:commentDraft', value),
})

const hasActiveComment = computed(() =>
  Boolean(props.activeCommentId && props.comments.some((item) => item.id === props.activeCommentId))
)

const commentCountLabel = computed(() => `${props.comments.length} 条评论`)

const selectedQuotePreview = computed(() =>
  props.selectedQuote || '先在正文中选中一段文本，再填写评论。'
)

const canSubmitComment = computed(() => Boolean(props.hasSelectedRange && props.commentDraft.trim()))

const inputRef = ref<HTMLTextAreaElement | null>(null)
const commentItemRefs = new Map<string, HTMLElement>()

/**
 * Handle setInputRef logic.
 * @param element - Parameter.
 */
function setInputRef(element: unknown) {
  // Keep a stable textarea ref so parent can focus input after text selection.
  inputRef.value = element instanceof HTMLTextAreaElement ? element : null
}

/**
 * Handle setCommentItemRef logic.
 * @param id - Parameter.
 * @param element - Parameter.
 */
function setCommentItemRef(id: string, element: unknown) {
  // Track rendered comment cards for smooth scroll-to-item interactions.
  if (element instanceof HTMLElement) {
    commentItemRefs.set(id, element)
    return
  }

  commentItemRefs.delete(id)
}

/**
 * Handle scrollCommentIntoView logic.
 * @param id - Parameter.
 */
function scrollCommentIntoView(id: string) {
  // Called by parent when anchor click in editor needs sidebar synchronization.
  commentItemRefs.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

/**
 * Handle focusInput logic.
 */
function focusInput() {
  // Called by parent when user starts "add comment from selection".
  inputRef.value?.focus()
  inputRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

/**
 * Handle formatTime logic.
 * @param time - Parameter.
 */
function formatTime(time: number) {
  // Unified short timestamp format used in comment cards.
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

defineExpose({
  focusInput,
  scrollCommentIntoView,
})
</script>

<template>
  <section class="panel comments-panel drawer-panel">
    <div class="comments-panel-head panel-shell-head">
      <div class="panel-title-block">
        <p class="panel-kicker">COMMENT</p>
        <h3>评论</h3>
        <p class="panel-tip">{{ commentCountLabel }} · 选中正文后可直接补评</p>
      </div>

      <div class="panel-head-actions">
        <span class="comments-badge" :data-active="hasActiveComment">
          {{ hasActiveComment ? '当前锚点' : '未定位' }}
        </span>
        <button
          type="button"
          class="panel-toggle"
          :aria-expanded="!commentsCollapsed"
          @click="emit('toggle-collapse')"
        >
          {{ commentsCollapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <div v-show="!commentsCollapsed" class="panel-section-body drawer-body">
      <blockquote class="selection-quote" :class="{ empty: !hasSelectedRange }">
        {{ selectedQuotePreview }}
      </blockquote>

      <textarea
        :ref="setInputRef"
        v-model="commentDraftModel"
        class="comment-input"
        rows="4"
        placeholder="例如：这里需要补充数据来源、结论依据，或者给出更明确的解释。"
      ></textarea>

      <div class="row-actions comment-actions">
        <button
          type="button"
          class="btn"
          :disabled="!canSubmitComment"
          @click="emit('submit-comment')"
        >
          添加评论
        </button>
        <span class="panel-tip">点击列表项可回到正文锚点</span>
      </div>

      <ul v-if="comments.length" class="panel-list comments-list">
        <li
          v-for="item in comments"
          :key="item.id"
          :ref="(element) => setCommentItemRef(item.id, element)"
          class="panel-item comment-card"
          :class="{ active: item.id === activeCommentId }"
          @click="emit('focus-comment', item)"
        >
          <div class="panel-item-head comment-card-top">
            <div class="comment-author-block">
              <span class="comment-avatar">{{ item.author.slice(0, 1).toUpperCase() }}</span>
              <div class="comment-author-meta">
                <strong>{{ item.author }}</strong>
                <span>{{ formatTime(item.createdAt) }}</span>
              </div>
            </div>
          </div>

          <p class="comment-text">{{ item.text }}</p>
          <p class="panel-item-quote">引用：{{ item.quote }}</p>

          <div class="row-actions comment-link-actions">
            <button type="button" class="btn xs ghost link-btn" @click.stop="emit('focus-comment', item)">
              定位
            </button>
            <button
              type="button"
              class="btn xs ghost link-btn danger"
              @click.stop="emit('delete-comment', item.id)"
            >
              删除
            </button>
          </div>
        </li>
      </ul>

      <p v-else class="panel-tip comments-empty">
        还没有评论。先在正文里选中一段文本，再输入评论内容。
      </p>
    </div>
  </section>
</template>
