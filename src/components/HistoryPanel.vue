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
  Boolean(
    props.activeSnapshotId && props.snapshots.some((item) => item.id === props.activeSnapshotId)
  )
)

const snapshotCountLabel = computed(() => `${props.snapshots.length} 条历史记录`)

/**
 * Handle formatTime logic.
 * @param time - Parameter.
 */
function formatTime(time: number) {
  // Unified short timestamp format used in snapshot cards.
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Handle parseSnapshotMarkdown logic.
 * @param content - Parameter.
 * @returns Return value.
 */
function parseSnapshotMarkdown(content: string): string {
  // New snapshots store JSON payload; old snapshots might be plain markdown string.
  try {
    const parsed = JSON.parse(content) as { markdown?: unknown }
    if (typeof parsed.markdown === 'string') return parsed.markdown
  } catch {
    // Backward compatibility: treat old snapshot content as raw markdown only.
  }

  return content
}

/**
 * Handle getSnapshotPreview logic.
 * @param snapshot - Parameter.
 */
function getSnapshotPreview(snapshot: HistorySnapshot) {
  // Render compact preview as "first line / last line" for quick scanning.
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
  <section class="panel history-panel drawer-panel">
    <div class="history-panel-head panel-shell-head">
      <div class="panel-title-block">
        <p class="panel-kicker">HISTORY</p>
        <h3>历史</h3>
        <p class="panel-tip">{{ snapshotCountLabel }} · 点击卡片即可还原当前文档</p>
      </div>

      <div class="panel-head-actions">
        <span class="history-badge" :data-active="hasActiveSnapshot">
          {{ hasActiveSnapshot ? '当前版本' : '未定位' }}
        </span>
        <button
          type="button"
          class="panel-toggle"
          :aria-expanded="!historyCollapsed"
          @click="emit('toggle-collapse')"
        >
          {{ historyCollapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <div v-show="!historyCollapsed" class="panel-section-body drawer-body">
      <input
        v-model="snapshotLabelModel"
        class="mini-input"
        type="text"
        placeholder="例如：发布前 / 评审前 / 里程碑快照"
        @keydown.enter.prevent="emit('create-snapshot')"
      />

      <div class="row-actions history-actions">
        <button type="button" class="btn" @click="emit('create-snapshot')">创建快照</button>
        <span class="panel-tip">会保存当前正文和评论状态。</span>
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
        还没有历史记录。手动创建一个快照后，就能随时回到对应版本。
      </p>
    </div>
  </section>
</template>
