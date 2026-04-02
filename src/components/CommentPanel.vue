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
const commentCount = computed(() => props.comments.length)

const selectedQuotePreview = computed(() =>
  props.selectedQuote || '先在正文中选中一段文本，再输入评论内容。'
)

const canSubmitComment = computed(() => Boolean(props.hasSelectedRange && props.commentDraft.trim()))

const inputRef = ref<HTMLTextAreaElement | null>(null)
const commentItemRefs = new Map<string, HTMLElement>()

function setInputRef(element: unknown) {
  inputRef.value = element instanceof HTMLTextAreaElement ? element : null
}

function setCommentItemRef(id: string, element: unknown) {
  if (element instanceof HTMLElement) {
    commentItemRefs.set(id, element)
    return
  }

  commentItemRefs.delete(id)
}

function scrollCommentIntoView(id: string) {
  commentItemRefs.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function focusInput() {
  inputRef.value?.focus()
  inputRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function formatTime(time: number) {
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
  <section
    class="panel comments-panel drawer-panel"
    :class="{ 'is-collapsed': commentsCollapsed, 'is-open': !commentsCollapsed }"
  >
    <button
      v-if="commentsCollapsed"
      type="button"
      class="comments-rail"
      :aria-label="`展开评论面板，当前有 ${commentCountLabel}`"
      @click="emit('toggle-collapse')"
    >
      <span class="comments-rail-icon">
        <span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
      </span>
      <strong class="comments-rail-count">{{ commentCount }}</strong>
      <span class="comments-rail-hint">展开</span>
    </button>

    <template v-else>
      <div class="comments-panel-head panel-shell-head">
        <div class="panel-title-block">
          <p class="panel-kicker">COMMENT</p>
          <h3>评论</h3>
          <p class="panel-tip">{{ commentCountLabel }} · 选中文本后可直接补评</p>
        </div>

        <div class="panel-head-actions">
          <span class="comments-badge" :data-active="hasActiveComment">
            {{ hasActiveComment ? '当前锚点' : '未选中' }}
          </span>
          <button type="button" class="panel-toggle" :aria-expanded="true" @click="emit('toggle-collapse')">
            收起
          </button>
        </div>
      </div>

      <div class="comments-panel-body panel-section-body drawer-body">
        <blockquote class="selection-quote" :class="{ empty: !hasSelectedRange }">
          {{ selectedQuotePreview }}
        </blockquote>

        <textarea
          :ref="setInputRef"
          v-model="commentDraftModel"
          class="comment-input"
          rows="4"
          placeholder="例如：这里建议补充背景、数据来源，或者给出结论解释。"
        ></textarea>

        <div class="row-actions comment-actions">
          <button type="button" class="btn" :disabled="!canSubmitComment" @click="emit('submit-comment')">
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
          还没有评论。先在左侧选中一段文本，再输入评论内容。
        </p>
      </div>
    </template>
  </section>
</template>
