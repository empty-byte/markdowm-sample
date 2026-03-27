<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import * as Y from 'yjs'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import {
  addComment,
  removeComment,
  type EditorComment,
} from '../features/editor-enhance/comments'
import {
  createSnapshot,
  removeSnapshot,
  type HistorySnapshot,
} from '../features/editor-enhance/history'
import {
  filterCommands,
  type CommandAction,
} from '../features/editor-enhance/commands'
import CommentAnchorHighlight, {
  type CommentHighlightRange,
} from '../features/editor-enhance/comment-anchor-highlight'
import { detectSlashTrigger } from '../features/editor-enhance/slash'

const status = ref<'connecting' | 'connected' | 'disconnected'>('disconnected')
const ydoc = new Y.Doc()
const room = 'demo-tiptap-room'
const wsUrl = import.meta.env.VITE_COLLAB_WS_URL || 'ws://127.0.0.1:1234'

const user = {
  name: `User-${Math.floor(Math.random() * 1000)}`,
  color: ['#ff6b6b', '#845ef7', '#3bc9db', '#51cf66', '#fcc419'][Math.floor(Math.random() * 5)],
}

const websocketProvider = new HocuspocusProviderWebsocket({
  url: wsUrl,
  autoConnect: false,
})
const provider = new HocuspocusProvider({
  name: room,
  document: ydoc,
  websocketProvider,
})
provider.on('status', (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
  status.value = event.status
})

const selectedRange = ref<{ from: number; to: number; quote: string } | null>(null)
const commentInput = ref('')
const comments = ref<EditorComment[]>([])
const activeCommentId = ref<string | null>(null)
const activeCommentRange = ref<CommentHighlightRange | null>(null)

const slashMenuVisible = ref(false)
const slashQuery = ref('')
const slashRange = ref<{ from: number; to: number } | null>(null)
const slashMenuPosition = ref({ top: 0, left: 0 })
const slashItems = computed(() => filterCommands(slashQuery.value))
const slashActiveIndex = ref(0)

const editor = useEditor({
  content: '<h2>飞书风格增强演示</h2><p>试试输入 / 调出菜单、选中文本后发表评论，或按 Ctrl+/ 呼出功能菜单。</p>',
  extensions: [
    StarterKit.configure({ undoRedo: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CommentAnchorHighlight.configure({
      getRange: () => activeCommentRange.value,
    }),
    Collaboration.configure({ document: ydoc }),
    CollaborationCaret.configure({
      provider,
      user,
    }),
  ],
})

const snapshots = ref<HistorySnapshot[]>([])
const snapshotLabel = ref('')
const snapshotStorageKey = 'tiptap-demo-history-v1'

const commandMenuVisible = ref(false)
const commandQuery = ref('')
const commandInputRef = ref<HTMLInputElement | null>(null)
const commandItems = computed(() => filterCommands(commandQuery.value))
const commandActiveIndex = ref(0)

function connectCollab() {
  provider.connect()
}

function disconnectCollab() {
  provider.disconnect()
}

function refreshSelection() {
  const instance = editor.value
  if (!instance) {
    selectedRange.value = null
    return
  }

  const { from, to } = instance.state.selection
  if (from === to) {
    selectedRange.value = null
    return
  }

  const quote = instance.state.doc.textBetween(from, to, ' ').trim()
  selectedRange.value = {
    from,
    to,
    quote,
  }
}

function closeSlashMenu() {
  slashMenuVisible.value = false
  slashQuery.value = ''
  slashRange.value = null
  slashActiveIndex.value = 0
}

function syncSlashMenuState() {
  const instance = editor.value
  if (!instance) {
    closeSlashMenu()
    return
  }

  const { from, to } = instance.state.selection
  if (from !== to) {
    closeSlashMenu()
    return
  }

  if (instance.isActive('codeBlock')) {
    closeSlashMenu()
    return
  }

  const textBefore = instance.state.doc.textBetween(Math.max(0, from - 80), from, '\n', '\0')
  const trigger = detectSlashTrigger(textBefore, from)

  if (!trigger) {
    closeSlashMenu()
    return
  }

  const queryChanged = trigger.query !== slashQuery.value
  const coords = instance.view.coordsAtPos(from)
  slashMenuVisible.value = true
  slashQuery.value = trigger.query
  slashRange.value = { from: trigger.from, to: trigger.to }
  slashMenuPosition.value = {
    top: coords.bottom + 6,
    left: coords.left,
  }

  if (queryChanged) {
    slashActiveIndex.value = 0
  }
}

function submitComment() {
  if (!selectedRange.value) return
  const text = commentInput.value.trim()
  if (!text) return

  const next = addComment(comments.value, {
    text,
    quote: selectedRange.value.quote,
    from: selectedRange.value.from,
    to: selectedRange.value.to,
    author: user.name,
  })

  comments.value = next
  commentInput.value = ''

  focusComment(next[0])
}

function focusComment(comment: EditorComment) {
  activeCommentId.value = comment.id
  activeCommentRange.value = { from: comment.from, to: comment.to }

  editor.value?.chain().focus().setTextSelection(comment.from).scrollIntoView().run()
  editor.value?.commands.refreshCommentAnchorHighlight()
}

function deleteComment(id: string) {
  comments.value = removeComment(comments.value, id)

  if (activeCommentId.value === id) {
    activeCommentId.value = null
    activeCommentRange.value = null
    editor.value?.commands.refreshCommentAnchorHighlight()
  }
}

function saveSnapshot() {
  const instance = editor.value
  if (!instance) return

  const content = JSON.stringify(instance.getJSON())
  const label = snapshotLabel.value.trim() || `快照 ${new Date().toLocaleTimeString()}`
  snapshots.value = createSnapshot(snapshots.value, { label, content }, 30)
  snapshotLabel.value = ''
}

function restoreSnapshot(snapshot: HistorySnapshot) {
  const instance = editor.value
  if (!instance) return

  try {
    const content = JSON.parse(snapshot.content)
    instance.commands.setContent(content)
  } catch {
    // Ignore invalid snapshot content.
  }
}

function deleteSnapshot(id: string) {
  snapshots.value = removeSnapshot(snapshots.value, id)
}

function openCommandMenu() {
  commandMenuVisible.value = true
  commandQuery.value = ''
  commandActiveIndex.value = 0
  void nextTick(() => {
    commandInputRef.value?.focus()
  })
}

function closeCommandMenu() {
  commandMenuVisible.value = false
  commandQuery.value = ''
  commandActiveIndex.value = 0
}

function executeCommand(action: CommandAction, range?: { from: number; to: number } | null) {
  const chain = editor.value?.chain().focus()
  if (!chain) return

  if (range) chain.deleteRange(range)

  if (action === 'paragraph') chain.setParagraph().run()
  if (action === 'h1') chain.toggleHeading({ level: 1 }).run()
  if (action === 'h2') chain.toggleHeading({ level: 2 }).run()
  if (action === 'h3') chain.toggleHeading({ level: 3 }).run()
  if (action === 'bullet') chain.toggleBulletList().run()
  if (action === 'ordered') chain.toggleOrderedList().run()
  if (action === 'task') chain.toggleTaskList().run()
  if (action === 'blockquote') chain.toggleBlockquote().run()
  if (action === 'codeBlock') chain.toggleCodeBlock().run()
  if (action === 'divider') chain.setHorizontalRule().run()
  if (action === 'bold') chain.toggleBold().run()
  if (action === 'italic') chain.toggleItalic().run()
  if (action === 'strike') chain.toggleStrike().run()
  if (action === 'clearMarks') chain.unsetAllMarks().run()
  if (action === 'undo') chain.undo().run()
  if (action === 'redo') chain.redo().run()
}

function runCommand(action: CommandAction) {
  executeCommand(action)
  closeCommandMenu()
  closeSlashMenu()
}

function runSlashCommand(action: CommandAction) {
  executeCommand(action, slashRange.value)
  closeSlashMenu()
}

function moveSlashSelection(step: 1 | -1) {
  const size = slashItems.value.length
  if (!size) return

  slashActiveIndex.value = (slashActiveIndex.value + step + size) % size
}

function moveCommandSelection(step: 1 | -1) {
  const size = commandItems.value.length
  if (!size) return

  commandActiveIndex.value = (commandActiveIndex.value + step + size) % size
}

function onCommandInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveCommandSelection(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveCommandSelection(-1)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCommandMenu()
    return
  }

  if (event.key !== 'Enter') return

  event.preventDefault()
  const item = commandItems.value[commandActiveIndex.value]
  if (item) runCommand(item.action)
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (slashMenuVisible.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSlashSelection(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSlashSelection(-1)
      return
    }

    if (event.key === 'Enter') {
      const item = slashItems.value[slashActiveIndex.value]
      if (item) {
        event.preventDefault()
        runSlashCommand(item.action)
        return
      }
    }

    if (event.key === 'Escape') {
      closeSlashMenu()
      return
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key === '/') {
    event.preventDefault()
    if (commandMenuVisible.value) closeCommandMenu()
    else openCommandMenu()
    return
  }

  if (event.key === 'Escape' && commandMenuVisible.value) {
    closeCommandMenu()
  }
}

function formatTime(time: number) {
  return new Date(time).toLocaleString()
}

watch(slashItems, (items) => {
  if (!items.length) {
    slashActiveIndex.value = 0
    return
  }

  if (slashActiveIndex.value > items.length - 1) {
    slashActiveIndex.value = 0
  }
})

watch(commandItems, (items) => {
  if (!items.length) {
    commandActiveIndex.value = 0
    return
  }

  if (commandActiveIndex.value > items.length - 1) {
    commandActiveIndex.value = 0
  }
})

watch(
  editor,
  (instance, oldInstance) => {
    oldInstance?.off('selectionUpdate', refreshSelection)
    oldInstance?.off('selectionUpdate', syncSlashMenuState)
    oldInstance?.off('update', syncSlashMenuState)

    instance?.on('selectionUpdate', refreshSelection)
    instance?.on('selectionUpdate', syncSlashMenuState)
    instance?.on('update', syncSlashMenuState)

    refreshSelection()
    syncSlashMenuState()
  },
  { immediate: true }
)

watch(
  snapshots,
  (value) => {
    localStorage.setItem(snapshotStorageKey, JSON.stringify(value))
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)

  const cached = localStorage.getItem(snapshotStorageKey)
  if (!cached) return

  try {
    const parsed = JSON.parse(cached) as HistorySnapshot[]
    if (Array.isArray(parsed)) snapshots.value = parsed
  } catch {
    snapshots.value = []
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  provider.destroy()
  websocketProvider.destroy()
  ydoc.destroy()
  editor.value?.destroy()
})
</script>

<template>
  <section class="page">
    <h1>方案1：Tiptap + Yjs + WebSocket（增强版）</h1>
    <p class="subtitle">包含评论面板、历史快照、命令菜单（Ctrl+/）和“输入 / 调出菜单”的飞书式体验。</p>

    <div class="toolbar">
      <button type="button" class="btn" @click="editor?.chain().focus().toggleBold().run()">粗体</button>
      <button type="button" class="btn" @click="editor?.chain().focus().toggleItalic().run()">斜体</button>
      <button type="button" class="btn" @click="editor?.chain().focus().toggleBulletList().run()">列表</button>
      <button type="button" class="btn" @click="editor?.chain().focus().undo().run()">撤销</button>
      <button type="button" class="btn" @click="editor?.chain().focus().redo().run()">重做</button>
      <button type="button" class="btn" @click="openCommandMenu">功能菜单 (Ctrl+/)</button>
      <button type="button" class="btn" @click="connectCollab">连接协同</button>
      <button type="button" class="btn ghost" @click="disconnectCollab">断开协同</button>
      <span class="status" :data-online="status === 'connected'">{{ status }}</span>
    </div>

    <div class="editor-workbench">
      <div class="editor-main">
        <EditorContent class="editor-shell" :editor="editor" />
      </div>

      <aside class="side-panels">
        <section class="panel">
          <h3>评论</h3>
          <p v-if="!selectedRange" class="panel-tip">先在正文选中一段文本，再添加评论。</p>
          <blockquote v-else class="selection-quote">{{ selectedRange.quote }}</blockquote>

          <textarea
            v-model="commentInput"
            class="comment-input"
            rows="3"
            placeholder="输入评论内容..."
          ></textarea>
          <button
            type="button"
            class="btn"
            :disabled="!selectedRange || !commentInput.trim()"
            @click="submitComment"
          >
            添加评论
          </button>

          <ul class="panel-list">
            <li
              v-for="item in comments"
              :key="item.id"
              class="panel-item"
              :class="{ active: item.id === activeCommentId }"
              @click="focusComment(item)"
            >
              <div class="panel-item-head">
                <strong>{{ item.author }}</strong>
                <span>{{ formatTime(item.createdAt) }}</span>
              </div>
              <p>{{ item.text }}</p>
              <p class="panel-item-quote">“{{ item.quote }}”</p>
              <div class="row-actions">
                <button type="button" class="btn xs" @click.stop="focusComment(item)">定位</button>
                <button type="button" class="btn xs ghost" @click.stop="deleteComment(item.id)">删除</button>
              </div>
            </li>
          </ul>
        </section>

        <section class="panel">
          <h3>文档历史</h3>
          <div class="row-actions">
            <input
              v-model="snapshotLabel"
              class="mini-input"
              type="text"
              placeholder="快照名称（可选）"
            />
            <button type="button" class="btn" @click="saveSnapshot">保存快照</button>
          </div>

          <ul class="panel-list">
            <li v-for="item in snapshots" :key="item.id" class="panel-item">
              <div class="panel-item-head">
                <strong>{{ item.label }}</strong>
                <span>{{ formatTime(item.createdAt) }}</span>
              </div>
              <div class="row-actions">
                <button type="button" class="btn xs" @click="restoreSnapshot(item)">回滚</button>
                <button type="button" class="btn xs ghost" @click="deleteSnapshot(item.id)">删除</button>
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <p class="tip">在编辑区输入 <code>/</code> 可直接弹出快捷块菜单（支持 ↑/↓ 选择，Enter 执行）。当前房间：<code>{{ room }}</code>，服务地址：<code>{{ wsUrl }}</code></p>
  </section>

  <div
    v-if="slashMenuVisible"
    class="slash-menu"
    :style="{ top: `${slashMenuPosition.top}px`, left: `${slashMenuPosition.left}px` }"
  >
    <div class="slash-menu-title">输入关键字筛选</div>
    <ul class="slash-list">
      <li
        v-for="(item, index) in slashItems"
        :key="item.id"
        class="slash-item"
        :class="{ active: index === slashActiveIndex }"
        @mouseenter="slashActiveIndex = index"
        @mousedown.prevent
        @click="runSlashCommand(item.action)"
      >
        <div class="menu-row">
          <strong>{{ item.label }}</strong>
          <span class="menu-group">{{ item.group }}</span>
        </div>
        <p>{{ item.description }}</p>
      </li>
    </ul>
    <p v-if="slashItems.length === 0" class="panel-tip">没有匹配命令</p>
  </div>

  <div v-if="commandMenuVisible" class="command-menu-mask" @click="closeCommandMenu">
    <div class="command-menu" @click.stop>
      <div class="command-menu-title">功能菜单</div>
      <input
        ref="commandInputRef"
        v-model="commandQuery"
        class="command-input"
        type="text"
        placeholder="输入命令关键字，如 标题 / 列表 / 引用"
        @keydown="onCommandInputKeydown"
      />

      <ul class="command-list">
        <li
          v-for="(item, index) in commandItems"
          :key="item.id"
          class="command-item"
          :class="{ active: index === commandActiveIndex }"
          @mouseenter="commandActiveIndex = index"
          @click="runCommand(item.action)"
        >
          <div class="menu-row">
            <strong>{{ item.label }}</strong>
            <span class="menu-group">{{ item.group }}</span>
          </div>
          <p>{{ item.description }}</p>
        </li>
      </ul>
      <p v-if="commandItems.length === 0" class="panel-tip">没有匹配命令</p>
    </div>
  </div>
</template>
