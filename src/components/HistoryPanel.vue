<script setup lang="ts">
import { computed } from 'vue'
import type { HistorySnapshot } from '../features/editor-enhance/history'
import '../styles/pixel-right.css'

const props = defineProps<{
  snapshots: HistorySnapshot[]
  activeSnapshotId: string | null
  historyCollapsed: boolean
  snapshotLabel: string
}>()

const emit = defineEmits<{
  'toggle-collapse': []
  'update:snapshotLabel': [value: string]
  'create-snapshot': []
  'select-snapshot': [snapshot: HistorySnapshot]
  'restore-snapshot': [snapshot: HistorySnapshot]
  'delete-snapshot': [id: string]
}>()

const snapshotLabelModel = computed({
  get: () => props.snapshotLabel,
  set: (value: string) => emit('update:snapshotLabel', value),
})

const hasActiveSnapshot = computed(() =>
  Boolean(props.activeSnapshotId && props.snapshots.some((item) => item.id === props.activeSnapshotId))
)

const snapshotCountLabel = computed(() => `${props.snapshots.length} 条历史记录`)

function formatTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseSnapshotMarkdown(content: string): string {
  try {
    const parsed = JSON.parse(content) as { markdown?: unknown }
    if (typeof parsed.markdown === 'string') return parsed.markdown
  } catch {
    // Keep backward compatibility with older plain-markdown snapshots.
  }

  return content
}

function getSnapshotPreview(snapshot: HistorySnapshot) {
  const snapshotMarkdown = parseSnapshotMarkdown(snapshot.content)
  const lines = snapshotMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return '空白快照'
  if (lines.length === 1) return lines[0]

  const firstLine = lines[0]
  const lastLine = lines[lines.length - 1]
  return firstLine === lastLine ? firstLine : `${firstLine} / ${lastLine}`
}
</script>

<template>
  <section class="panel history-panel drawer-panel modal-panel" :class="{ 'is-collapsed': historyCollapsed }">
    <div class="history-panel-head panel-shell-head">
      <div class="panel-title-block">
        <p class="panel-kicker">HISTORY</p>
        <h3>历史记录</h3>
        <p class="panel-tip">{{ snapshotCountLabel }} · 点击版本卡片可还原</p>
      </div>

      <div class="panel-head-actions">
        <span class="history-badge" :data-active="hasActiveSnapshot">
          {{ hasActiveSnapshot ? '当前版本' : '未选中' }}
        </span>
        <button type="button" class="panel-toggle history-close" aria-label="关闭历史弹框" @click="emit('toggle-collapse')">
          关闭
        </button>
      </div>
    </div>

    <div class="history-panel-body panel-section-body drawer-body">
      <input
        v-model="snapshotLabelModel"
        class="mini-input"
        type="text"
        placeholder="例如：补充结论前 / 发布前检查"
        @keydown.enter.prevent="emit('create-snapshot')"
      />

      <div class="row-actions history-actions">
        <button type="button" class="btn" @click="emit('create-snapshot')">创建快照</button>
        <span class="panel-tip">默认会保存当前文档和评论状态</span>
      </div>

      <ul v-if="snapshots.length" class="panel-list history-list">
        <li
          v-for="item in snapshots"
          :key="item.id"
          class="panel-item history-card"
          :class="{ active: item.id === activeSnapshotId }"
          role="button"
          tabindex="0"
          :aria-pressed="item.id === activeSnapshotId"
          @click="emit('select-snapshot', item)"
          @keydown.enter.prevent="emit('select-snapshot', item)"
          @keydown.space.prevent="emit('select-snapshot', item)"
        >
          <div class="panel-item-head">
            <strong>{{ item.label }}</strong>
            <span>{{ formatTime(item.createdAt) }}</span>
          </div>
          <p class="history-preview">{{ getSnapshotPreview(item) }}</p>
          <div class="row-actions">
            <button type="button" class="btn xs" @click.stop="emit('restore-snapshot', item)">
              还原
            </button>
            <button type="button" class="btn xs ghost" @click.stop="emit('delete-snapshot', item.id)">
              删除
            </button>
          </div>
        </li>
      </ul>

      <p v-else class="panel-tip comments-empty">
        还没有历史记录。手动创建一个快照后，就可以随时把文档还原到对应版本。
      </p>
    </div>
  </section>
</template>
