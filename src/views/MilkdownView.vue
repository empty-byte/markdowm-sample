<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { editorViewCtx } from '@milkdown/core'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import type { Selection } from '@milkdown/prose/state'
import { TextSelection } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { forceUpdate, replaceAll, $prose } from '@milkdown/utils'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import * as Y from 'yjs'
import '@milkdown/crepe/theme/common/style.css'
import createCommentAnchorHighlightPlugin, {
  type CommentHighlightRange,
} from '../features/editor-enhance/comment-anchor-highlight'
import { addComment, removeComment, type EditorComment } from '../features/editor-enhance/comments'
import {
  createSnapshot,
  findSnapshot,
  removeSnapshot,
  type HistorySnapshot,
} from '../features/editor-enhance/history'
import {
  isValidEmbedUrl,
  createEmbedToken,
  EMBED_EDIT_REQUEST_EVENT,
  type EmbedEditRequestDetail,
} from '../features/editor-enhance/embeds'
import createEmbedNodeViewPlugin from '../features/editor-enhance/embed-node-view'
import {
  createWhiteboardId,
  createWhiteboardSource,
  createWhiteboardToken,
  getWhiteboardById,
  upsertWhiteboard,
  WHITEBOARD_EDIT_REQUEST_EVENT,
  type WhiteboardEditRequestDetail,
} from '../features/editor-enhance/whiteboards'
import {
  createFlowchartId,
  createFlowchartSource,
  createFlowchartToken,
  getFlowchartById,
  upsertFlowchart,
  FLOWCHART_EDIT_REQUEST_EVENT,
  type FlowchartEditRequestDetail,
} from '../features/editor-enhance/flowcharts'
import createWhiteboardNodeViewPlugin from '../features/editor-enhance/whiteboard-node-view'
import createFlowchartNodeViewPlugin from '../features/editor-enhance/flowchart-node-view'
import WhiteboardExcalidrawDialog from '../components/WhiteboardExcalidrawDialog.vue'
import FlowchartLogicDialog from '../components/FlowchartLogicDialog.vue'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
type ThemeKind = 'nord' | 'frame' | 'classic'

interface CrepeFeatureItem {
  key: CrepeFeature
  label: string
  description: string
}

interface CapabilitySection {
  title: string
  items: string[]
}

interface PaletteAction {
  id: string
  group: string
  label: string
  description: string
  run: () => void
}

interface SelectedQuoteRange {
  from: number
  to: number
  quote: string
}

interface SnapshotPayload {
  markdown: string
  comments: EditorComment[]
}

interface WhiteboardSavePayload {
  title: string
  previewUrl: string
  scene: unknown
}

interface FlowchartSavePayload {
  title: string
  previewUrl: string
  scene: unknown
}

interface CollaboratorIdentity {
  id: string
  name: string
  color: string
}

interface CollaboratorPresence extends CollaboratorIdentity {
  clientId: number
  isLocal: boolean
}

const themeOptions: Array<{ value: ThemeKind; label: string }> = [
  { value: 'nord', label: 'Nord' },
  { value: 'frame', label: 'Frame' },
  { value: 'classic', label: 'Classic' },
]

const crepeFeatureItems: CrepeFeatureItem[] = [
  {
    key: CrepeFeature.Toolbar,
    label: 'Toolbar',
    description: '选中文本时显示格式工具栏',
  },
  {
    key: CrepeFeature.BlockEdit,
    label: 'Block Edit + Slash',
    description: '左侧块手柄、拖拽与 / 菜单',
  },
  {
    key: CrepeFeature.CodeMirror,
    label: 'Code Block',
    description: '代码块语言选择与高亮编辑',
  },
  {
    key: CrepeFeature.Table,
    label: 'Table Block',
    description: '表格插入、行列操作与对齐',
  },
  {
    key: CrepeFeature.ImageBlock,
    label: 'Image Block + Inline',
    description: '图片块、行内图片与上传能力',
  },
  {
    key: CrepeFeature.LinkTooltip,
    label: 'Link Tooltip',
    description: '链接提示、编辑与复制',
  },
  {
    key: CrepeFeature.ListItem,
    label: 'List Item Block',
    description: '无序/有序/任务列表可视化',
  },
  {
    key: CrepeFeature.Cursor,
    label: 'Cursor',
    description: 'gap cursor / drop cursor 增强',
  },
  {
    key: CrepeFeature.Latex,
    label: 'Latex',
    description: '行内与块级数学公式',
  },
  {
    key: CrepeFeature.Placeholder,
    label: 'Placeholder',
    description: '空文档占位提示',
  },
]

const capabilitySections: CapabilitySection[] = [
  {
    title: 'Component',
    items: ['Code Block', 'Image Block', 'Image Inline', 'Link Tooltip', 'List Item Block', 'Table Block'],
  },
  {
    title: 'Preset',
    items: ['Commonmark', 'GFM'],
  },
  {
    title: 'Plugin',
    items: ['Listener', 'History', 'Cursor', 'Tooltip', 'Slash', 'Block', 'Indent', 'Trailing', 'Upload', 'Clipboard', 'Collab'],
  },
  {
    title: 'Editor',
    items: ['Crepe'],
  },
  {
    title: 'Framework',
    items: ['Core', 'Ctx', 'Utils', 'Transformer'],
  },
]

const initialMarkdown = `# Milkdown Playground v7.19.2

👋 Welcome to Milkdown. We are so glad to see you here!

💬 Try editing on the **left side**, or directly edit markdown on the right.

> ⚠ Not the right side!
>
> Please try something on the left side.

![Polar Bear](https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=1200&q=80)

Hello by a polar bear

## Feature Overview

| Feature | Example | Description |
| --- | --- | --- |
| Theme | Nord / Frame / Classic | Switch editor visual theme |
| Plugin | Slash / History / Collab | Extend behaviors |
| Component | Toolbar / Table / Image | Rich block editing |
| Syntax | GFM / Latex | Markdown-first editing |

### Playground Shortcuts

- Type "/" in editor to open slash menu
- Use selected text to trigger floating toolbar
- Press Ctrl+K to open feature palette

\`\`\`ts
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'

const crepe = new Crepe({ root: '#app' })
await crepe.create()
\`\`\`
`

const host = ref<HTMLDivElement | null>(null)
const commentInputRef = ref<HTMLTextAreaElement | null>(null)
const paletteInputRef = ref<HTMLInputElement | null>(null)
const status = ref<ConnectionStatus>('disconnected')
const markdown = ref(initialMarkdown)
const readonlyMode = ref(false)
const autoSyncMarkdown = ref(true)
const theme = ref<ThemeKind>('nord')
const darkMode = ref(false)
const collabWanted = ref(false)
const isRebuilding = ref(false)
const copied = ref(false)

const paletteVisible = ref(false)
const paletteQuery = ref('')
const paletteIndex = ref(0)
const markdownPaneVisible = ref(false)
const commentsCollapsed = ref(false)
const historyCollapsed = ref(false)
const commentDraft = ref('')
const snapshotLabel = ref('')
const comments = ref<EditorComment[]>([])
const snapshots = ref<HistorySnapshot[]>([])
const selectedRange = ref<SelectedQuoteRange | null>(null)
const activeCommentId = ref<string | null>(null)
const activeCommentRange = ref<CommentHighlightRange | null>(null)
const activeSnapshotId = ref<string | null>(null)
const commentItemRefs = new Map<string, HTMLElement>()

const embedDialogVisible = ref(false)
const embedDialogMode = ref<'insert' | 'edit'>('insert')
const embedEditTarget = ref<EmbedEditRequestDetail | null>(null)
const embedUrlInput = ref('')
const embedTitleInput = ref('')
const whiteboardEditorVisible = ref(false)
const whiteboardEditorMode = ref<'insert' | 'edit'>('insert')
const whiteboardEditTarget = ref<WhiteboardEditRequestDetail | null>(null)
const whiteboardEditorTitle = ref('白板')
const whiteboardEditorScene = ref<unknown>(null)
const flowchartEditorVisible = ref(false)
const flowchartEditorMode = ref<'insert' | 'edit'>('insert')
const flowchartEditTarget = ref<FlowchartEditRequestDetail | null>(null)
const flowchartEditorTitle = ref('流程图')
const flowchartEditorScene = ref<unknown>(null)


const featureFlags = ref<Record<CrepeFeature, boolean>>(
  crepeFeatureItems.reduce((acc, item) => {
    acc[item.key] = true
    return acc
  }, {} as Record<CrepeFeature, boolean>)
)

const room = 'demo-milkdown-playground-room'
const wsUrl = import.meta.env.VITE_COLLAB_WS_URL || 'ws://127.0.0.1:1234'
const ydoc = new Y.Doc()
const yComments = ydoc.getArray<EditorComment>('comments')
const ySnapshots = ydoc.getArray<HistorySnapshot>('snapshots')
const websocketProvider = new HocuspocusProviderWebsocket({
  url: wsUrl,
  autoConnect: false,
})
const provider = new HocuspocusProvider({
  name: room,
  document: ydoc,
  websocketProvider,
})
provider.attach()

const collaboratorPalette = ['#2f6fed', '#d9480f', '#2b8a3e', '#8e44ad', '#0c8599', '#c2255c']
const localCollaborator: CollaboratorIdentity = {
  id: `user_${ydoc.clientID}`,
  name: `协作者 ${String(ydoc.clientID).slice(-4)}`,
  color: collaboratorPalette[ydoc.clientID % collaboratorPalette.length],
}
const collaborators = ref<CollaboratorPresence[]>([])

provider.on('status', (event: { status: ConnectionStatus }) => {
  status.value = event.status
})

let crepe: Crepe | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncingFromPane = false
let syncingFromEditor = false
let rebuildVersion = 0
let copyTimer: ReturnType<typeof setTimeout> | null = null
let suppressCommentAutoSelect = false

const commentToolbarIcon = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M7 18.5H6.8L3.75 20.75V6.75C3.75 5.7835 4.5335 5 5.5 5H15.5C16.4665 5 17.25 5.7835 17.25 6.75V11.5H15.75V6.75C15.75 6.612 15.638 6.5 15.5 6.5H5.5C5.362 6.5 5.25 6.612 5.25 6.75V17.75L6.32 17H15.5C15.638 17 15.75 16.888 15.75 16.75V15H17.25V16.75C17.25 17.7165 16.4665 18.5 15.5 18.5H7Z"
      fill="currentColor"
    />
    <path
      d="M18.5 10.25C18.914 10.25 19.25 10.586 19.25 11V12.75H21C21.414 12.75 21.75 13.086 21.75 13.5C21.75 13.914 21.414 14.25 21 14.25H19.25V16C19.25 16.414 18.914 16.75 18.5 16.75C18.086 16.75 17.75 16.414 17.75 16V14.25H16C15.586 14.25 15.25 13.914 15.25 13.5C15.25 13.086 15.586 12.75 16 12.75H17.75V11C17.75 10.586 18.086 10.25 18.5 10.25Z"
      fill="currentColor"
    />
  </svg>
`

const commentHighlight = $prose(() =>
  createCommentAnchorHighlightPlugin({
    getRanges: () => comments.value.map((item) => ({ from: item.from, to: item.to })),
    getActiveRange: () => activeCommentRange.value,
    getRangeKeyAt: (pos) => findCommentByPosition(pos)?.id ?? null,
    onClickRange: (key) => {
      activateCommentById(key)
    },
  })
)

const embedNodeView = $prose(() => createEmbedNodeViewPlugin())
const whiteboardNodeView = $prose(() => createWhiteboardNodeViewPlugin())
const flowchartNodeView = $prose(() => createFlowchartNodeViewPlugin())

const activeThemeClass = computed(() => `milk-theme-${theme.value}${darkMode.value ? '-dark' : ''}`)

const enabledFeatureCount = computed(() =>
  crepeFeatureItems.filter((item) => featureFlags.value[item.key]).length
)

const markdownLineNumbers = computed(() =>
  markdown.value
    .split('\n')
    .map((_, index) => index + 1)
    .join('\n')
)

const paletteActions = computed<PaletteAction[]>(() => {
  const actions: PaletteAction[] = crepeFeatureItems.map((item) => ({
    id: `feature-${item.key}`,
    group: 'Feature',
    label: `${featureFlags.value[item.key] ? '关闭' : '启用'} ${item.label}`,
    description: item.description,
    run: () => {
      featureFlags.value[item.key] = !featureFlags.value[item.key]
    },
  }))

  actions.push(
    {
      id: 'theme-nord',
      group: 'Theme',
      label: '切换主题：Nord',
      description: '更偏知识库风格的轻量主题',
      run: () => {
        theme.value = 'nord'
      },
    },
    {
      id: 'theme-frame',
      group: 'Theme',
      label: '切换主题：Frame',
      description: '更中性、文档感更强的主题',
      run: () => {
        theme.value = 'frame'
      },
    },
    {
      id: 'theme-classic',
      group: 'Theme',
      label: '切换主题：Classic',
      description: '官方经典视觉风格',
      run: () => {
        theme.value = 'classic'
      },
    },
    {
      id: 'toggle-dark',
      group: 'Theme',
      label: `${darkMode.value ? '关闭' : '开启'} Dark`,
      description: '深浅色模式切换',
      run: () => {
        darkMode.value = !darkMode.value
      },
    },
    {
      id: 'readonly',
      group: 'Editor',
      label: `${readonlyMode.value ? '关闭' : '开启'} 只读模式`,
      description: '锁定编辑区，仅查看内容',
      run: () => {
        readonlyMode.value = !readonlyMode.value
      },
    },
    {
      id: 'sync-pane',
      group: 'Editor',
      label: '将右侧 Markdown 应用到左侧',
      description: '手动触发 replaceAll 同步',
      run: () => {
        void applyMarkdownFromPane()
      },
    },
    {
      id: 'sample',
      group: 'Editor',
      label: '恢复 Playground 示例文档',
      description: '重置到默认演示内容',
      run: () => {
        void resetSampleMarkdown()
      },
    },
    {
      id: 'copy',
      group: 'Editor',
      label: '复制当前 Markdown',
      description: '把右侧文本复制到剪贴板',
      run: () => {
        void copyMarkdown()
      },
    },
    {
      id: 'collab-connect',
      group: 'Collab',
      label: '连接协同服务',
      description: '连接 Hocuspocus WebSocket',
      run: () => {
        connectCollab()
      },
    },
    {
      id: 'collab-disconnect',
      group: 'Collab',
      label: '断开协同服务',
      description: '断开当前房间连接',
      run: () => {
        disconnectCollab()
      },
    },
    {
      id: 'snapshot-create',
      group: 'History',
      label: '创建手动快照',
      description: '保存当前文档与评论状态，方便后续还原',
      run: () => {
        createHistorySnapshot()
      },
    },
    {
      id: 'insert-flowchart',
      group: 'Insert',
      label: '插入流程图',
      description: '打开流程图编辑弹框并插入到文档',
      run: () => {
        openFlowchartDialog()
      },
    }
  )

  return actions
})

const filteredPaletteActions = computed(() => {
  const query = paletteQuery.value.trim().toLowerCase()
  if (!query) return paletteActions.value

  return paletteActions.value.filter((item) => {
    const text = `${item.group} ${item.label} ${item.description}`.toLowerCase()
    return text.includes(query)
  })
})

const activeComment = computed(() =>
  comments.value.find((item) => item.id === activeCommentId.value) ?? null
)

const activeSnapshot = computed(() =>
  activeSnapshotId.value ? findSnapshot(snapshots.value, activeSnapshotId.value) ?? null : null
)

const commentCountLabel = computed(() => `${comments.value.length} 条评论`)
const snapshotCountLabel = computed(() => `${snapshots.value.length} 条历史记录`)
const collaboratorCountLabel = computed(() => {
  if (status.value !== 'connected') return '协同未连接'
  return `${collaborators.value.length} 位协作者在线`
})

const selectedQuotePreview = computed(() => selectedRange.value?.quote || '先在正文选中一段文本')

const embedUrlValid = computed(() => {
  const url = embedUrlInput.value.trim()
  return url.length > 0 && isValidEmbedUrl(url)
})
const embedDialogTitle = computed(() => (embedDialogMode.value === 'edit' ? '编辑内嵌网页' : '插入内嵌网页'))
const embedDialogConfirmText = computed(() => (embedDialogMode.value === 'edit' ? '保存' : '插入'))

function getFeatureFlags() {
  return crepeFeatureItems.reduce((acc, item) => {
    acc[item.key] = featureFlags.value[item.key]
    return acc
  }, {} as Partial<Record<CrepeFeature, boolean>>)
}

function getEditorView(): EditorView | null {
  if (!crepe) return null

  let view: EditorView | null = null
  crepe.editor.action((ctx) => {
    view = ctx.get(editorViewCtx)
  })

  return view
}

function setCommentItemRef(id: string, element: unknown) {
  if (element instanceof HTMLElement) {
    commentItemRefs.set(id, element)
    return
  }

  commentItemRefs.delete(id)
}

function scrollCommentIntoView(id: string) {
  const element = commentItemRefs.get(id)
  element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function isEditorCommentRecord(value: unknown): value is EditorComment {
  if (!value || typeof value !== 'object') return false

  const item = value as EditorComment
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.quote === 'string' &&
    typeof item.from === 'number' &&
    typeof item.to === 'number' &&
    typeof item.author === 'string' &&
    typeof item.createdAt === 'number'
  )
}

function isHistorySnapshotRecord(value: unknown): value is HistorySnapshot {
  if (!value || typeof value !== 'object') return false

  const item = value as HistorySnapshot
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    typeof item.content === 'string' &&
    typeof item.createdAt === 'number'
  )
}

function isCollaboratorIdentity(value: unknown): value is CollaboratorIdentity {
  if (!value || typeof value !== 'object') return false

  const item = value as CollaboratorIdentity
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.color === 'string'
  )
}

function syncCommentsFromSharedState() {
  comments.value = yComments.toArray().filter(isEditorCommentRecord)
}

function syncSnapshotsFromSharedState() {
  snapshots.value = ySnapshots.toArray().filter(isHistorySnapshotRecord)
}

function replaceSharedComments(next: EditorComment[]) {
  ydoc.transact(() => {
    yComments.delete(0, yComments.length)
    if (next.length) yComments.insert(0, next)
  })
}

function replaceSharedSnapshots(next: HistorySnapshot[]) {
  ydoc.transact(() => {
    ySnapshots.delete(0, ySnapshots.length)
    if (next.length) ySnapshots.insert(0, next)
  })
}

function refreshCollaborators() {
  const awarenessStates = provider.awareness?.getStates()
  if (!awarenessStates) {
    collaborators.value = []
    return
  }

  const next: CollaboratorPresence[] = []
  awarenessStates.forEach((state, clientId) => {
    const user = state && typeof state === 'object' ? (state as { user?: unknown }).user : null
    if (!isCollaboratorIdentity(user)) return

    next.push({
      ...user,
      clientId,
      isLocal: clientId === ydoc.clientID,
    })
  })

  collaborators.value = next.sort((left, right) => {
    if (left.isLocal !== right.isLocal) {
      return left.isLocal ? -1 : 1
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

function syncLocalAwareness() {
  provider.awareness?.setLocalStateField('user', localCollaborator)
  refreshCollaborators()
}

function getCurrentMarkdownSnapshot() {
  if (!crepe) return markdown.value

  try {
    return crepe.getMarkdown()
  } catch {
    return markdown.value
  }
}

function serializeSnapshotPayload() {
  const latestMarkdown = getCurrentMarkdownSnapshot()

  if (latestMarkdown !== markdown.value) {
    markdown.value = latestMarkdown
  }

  const payload: SnapshotPayload = {
    markdown: latestMarkdown,
    comments: comments.value,
  }

  return JSON.stringify(payload)
}

function parseSnapshotPayload(content: string): SnapshotPayload {
  try {
    const parsed = JSON.parse(content) as Partial<SnapshotPayload>
    if (typeof parsed.markdown === 'string') {
      return {
        markdown: parsed.markdown,
        comments: Array.isArray(parsed.comments)
          ? parsed.comments.filter(isEditorCommentRecord)
          : [],
      }
    }
  } catch {
    // Backward compatibility: treat old snapshot content as raw markdown only.
  }

  return {
    markdown: content,
    comments: [],
  }
}

function getSnapshotPreview(snapshot: HistorySnapshot) {
  const { markdown: snapshotMarkdown } = parseSnapshotPayload(snapshot.content)
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

function getDefaultSnapshotLabel() {
  return `手动快照 ${snapshots.value.length + 1}`
}

function findCommentByPosition(pos: number) {
  return (
    comments.value.find((item) => {
      const from = Math.min(item.from, item.to)
      const to = Math.max(item.from, item.to)
      return pos >= from && pos <= to
    }) ?? null
  )
}

function activateCommentById(id: string) {
  const comment = comments.value.find((item) => item.id === id)
  if (!comment) return

  activeCommentId.value = comment.id
  updateActiveCommentRange()

  void nextTick(() => {
    scrollCommentIntoView(comment.id)
  })
}

function focusCommentInput() {
  commentInputRef.value?.focus()
  commentInputRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function refreshCommentHighlight() {
  crepe?.editor.action(forceUpdate())
}

function syncSelectionState(selection?: Selection) {
  const view = getEditorView()
  const currentSelection = selection ?? view?.state.selection

  if (!view || !currentSelection || currentSelection.empty) {
    selectedRange.value = null
    return
  }

  const from = Math.min(currentSelection.from, currentSelection.to)
  const to = Math.max(currentSelection.from, currentSelection.to)
  const quote = view.state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim()

  if (!quote) {
    selectedRange.value = null
    return
  }

  selectedRange.value = {
    from,
    to,
    quote,
  }
}

function formatTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateActiveCommentRange() {
  const current = comments.value.find((item) => item.id === activeCommentId.value)
  activeCommentRange.value = current ? { from: current.from, to: current.to } : null
  refreshCommentHighlight()
}

function focusComment(comment: EditorComment) {
  activateCommentById(comment.id)

  crepe?.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const docSize = view.state.doc.content.size
    const from = Math.max(0, Math.min(comment.from, docSize))
    const to = Math.max(from, Math.min(comment.to, docSize))
    const selection = TextSelection.create(view.state.doc, from, to)
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
    view.focus()
  })

  void nextTick(() => {
    scrollCommentIntoView(comment.id)
  })
}

function submitComment() {
  if (!selectedRange.value) return

  const text = commentDraft.value.trim()
  if (!text) return

  const next = addComment(comments.value, {
    text,
    quote: selectedRange.value.quote,
    from: selectedRange.value.from,
    to: selectedRange.value.to,
    author: localCollaborator.name,
  })

  replaceSharedComments(next)
  commentDraft.value = ''
  focusComment(next[0])
}

function beginCommentFromSelection() {
  syncSelectionState()
  if (!selectedRange.value) return

  activeCommentId.value = null
  activeCommentRange.value = {
    from: selectedRange.value.from,
    to: selectedRange.value.to,
  }
  refreshCommentHighlight()

  void nextTick(() => {
    focusCommentInput()
  })
}

function createHistorySnapshot() {
  const label = snapshotLabel.value.trim() || getDefaultSnapshotLabel()
  const next = createSnapshot(snapshots.value, {
    label,
    content: serializeSnapshotPayload(),
  })

  replaceSharedSnapshots(next)
  activeSnapshotId.value = next[0]?.id ?? null
  snapshotLabel.value = ''
}

async function restoreHistorySnapshot(snapshot: HistorySnapshot) {
  const payload = parseSnapshotPayload(snapshot.content)
  activeSnapshotId.value = snapshot.id
  snapshotLabel.value = snapshot.label
  commentDraft.value = ''
  selectedRange.value = null
  suppressCommentAutoSelect = true
  activeCommentId.value = null
  activeCommentRange.value = null
  replaceSharedComments(payload.comments)
  await syncEditorMarkdown(payload.markdown)

  suppressCommentAutoSelect = false
  refreshCommentHighlight()
}

async function selectHistorySnapshot(snapshot: HistorySnapshot) {
  await restoreHistorySnapshot(snapshot)
}

function deleteHistorySnapshot(id: string) {
  replaceSharedSnapshots(removeSnapshot(snapshots.value, id))

  if (activeSnapshotId.value === id) {
    activeSnapshotId.value = snapshots.value[0]?.id ?? null
  }
}

function deleteComment(id: string) {
  replaceSharedComments(removeComment(comments.value, id))

  if (activeCommentId.value === id) {
    activeCommentId.value = comments.value[0]?.id ?? null
    updateActiveCommentRange()
  }
}

async function destroyEditor() {
  if (!crepe) return
  const current = crepe
  crepe = null
  await current.destroy()
}

async function rebuildEditor(seed?: string) {
  if (!host.value) return

  const version = ++rebuildVersion
  const nextMarkdown = seed ?? markdown.value
  isRebuilding.value = true

  await destroyEditor()
  if (!host.value || version !== rebuildVersion) return

  const instance = new Crepe({
    root: host.value,
    defaultValue: nextMarkdown,
    features: getFeatureFlags(),
    featureConfigs: {
      [CrepeFeature.ImageBlock]: {
        onUpload: async (file: File) => URL.createObjectURL(file),
      },
      [CrepeFeature.Placeholder]: {
        text: 'Type / to open slash menu...',
      },
      [CrepeFeature.BlockEdit]: {
        buildMenu: (builder) => {
          const advancedGroup = builder.getGroup('advanced')
          advancedGroup.addItem('embedWeb', {
            label: '内嵌网页',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
            onRun: () => {
              openEmbedDialog()
            },
          })

          advancedGroup.addItem('whiteboard', {
            label: '白板',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 8h10"/><path d="M7 12h7"/><path d="M10 18v2"/><path d="M14 18v2"/></svg>',
            onRun: () => {
              openWhiteboardDialog()
            },
          })

          advancedGroup.addItem('flowchart', {
            label: '流程图',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6" height="4" rx="1"/><rect x="14" y="4" width="6" height="4" rx="1"/><rect x="9" y="14" width="6" height="4" rx="1"/><path d="M10 6h4"/><path d="M17 8v2"/><path d="M7 8v2"/><path d="M7 10h10"/><path d="M12 10v4"/></svg>',
            onRun: () => {
              openFlowchartDialog()
            },
          })
        },
      },
      [CrepeFeature.Toolbar]: {
        buildToolbar: (builder) => {
          builder.getGroup('function').addItem('comment', {
            icon: commentToolbarIcon,
            active: () => Boolean(selectedRange.value),
            onRun: () => {
              beginCommentFromSelection()
            },
          })
        },
      },
    },
  })

  instance.editor.use(collab)
  instance.editor.use(commentHighlight)
  instance.editor.use(embedNodeView)
  instance.editor.use(whiteboardNodeView)
  instance.editor.use(flowchartNodeView)

  instance.on((listener) => {
    listener.markdownUpdated((_ctx, next) => {
      if (syncingFromPane) return
      syncingFromEditor = true
      markdown.value = next
      syncingFromEditor = false
    })

    listener.selectionUpdated((_ctx, selection) => {
      syncSelectionState(selection)
    })
  })

  await instance.create()

  if (version !== rebuildVersion) {
    await instance.destroy()
    return
  }

  instance.setReadonly(readonlyMode.value)

  instance.editor.action((ctx) => {
    const service = ctx.get(collabServiceCtx).bindDoc(ydoc)
    if (provider.awareness) {
      service.setAwareness(provider.awareness)
    }
    service.connect()
  })

  crepe = instance
  markdown.value = instance.getMarkdown()
  syncSelectionState()
  updateActiveCommentRange()

  if (collabWanted.value) void websocketProvider.connect()
  else websocketProvider.disconnect()

  isRebuilding.value = false
}

async function applyMarkdownFromPane() {
  if (!crepe || syncingFromEditor) return

  await syncEditorMarkdown(markdown.value)
}

async function syncEditorMarkdown(nextMarkdown: string) {
  if (!crepe || syncingFromEditor) return

  syncingFromPane = true
  markdown.value = nextMarkdown

  try {
    crepe.editor.action((ctx) => {
      ctx.get(collabServiceCtx).bindDoc(ydoc).applyTemplate(nextMarkdown, () => true)
    })
  } catch {
    crepe.editor.action(replaceAll(nextMarkdown, true))
  }

  syncingFromPane = false
  syncSelectionState()
  updateActiveCommentRange()
}

function scheduleApplyMarkdownFromPane() {
  if (!autoSyncMarkdown.value) return
  if (syncTimer) clearTimeout(syncTimer)

  syncTimer = setTimeout(() => {
    void applyMarkdownFromPane()
  }, 120)
}

async function resetSampleMarkdown() {
  markdown.value = initialMarkdown
  await applyMarkdownFromPane()
  replaceSharedComments([])
  activeCommentId.value = null
  selectedRange.value = null
  updateActiveCommentRange()
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(markdown.value)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 1200)
  } catch {
    copied.value = false
  }
}

function connectCollab() {
  collabWanted.value = true
  syncLocalAwareness()
}

function disconnectCollab() {
  provider.awareness?.setLocalState(null)
  collabWanted.value = false
  refreshCollaborators()
}

function openPalette() {
  paletteVisible.value = true
  paletteQuery.value = ''
  paletteIndex.value = 0
  void nextTick(() => {
    paletteInputRef.value?.focus()
  })
}

function closePalette() {
  paletteVisible.value = false
  paletteQuery.value = ''
  paletteIndex.value = 0
}

function movePalette(step: 1 | -1) {
  const size = filteredPaletteActions.value.length
  if (!size) return
  paletteIndex.value = (paletteIndex.value + step + size) % size
}

function runPaletteAction(item: PaletteAction) {
  item.run()
  closePalette()
}

function onPaletteKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    movePalette(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    movePalette(-1)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closePalette()
    return
  }

  if (event.key !== 'Enter') return

  event.preventDefault()
  const current = filteredPaletteActions.value[paletteIndex.value]
  if (current) runPaletteAction(current)
}

// ── Embed dialog ──

function openEmbedDialog() {
  embedDialogMode.value = 'insert'
  embedEditTarget.value = null
  embedDialogVisible.value = true
  embedUrlInput.value = ''
  embedTitleInput.value = ''
}

function openEmbedEditDialog(detail: EmbedEditRequestDetail) {
  embedDialogMode.value = 'edit'
  embedEditTarget.value = detail
  embedDialogVisible.value = true
  embedUrlInput.value = detail.sourceUrl
  embedTitleInput.value = detail.title
}

function closeEmbedDialog() {
  embedDialogVisible.value = false
  embedDialogMode.value = 'insert'
  embedEditTarget.value = null
  embedUrlInput.value = ''
  embedTitleInput.value = ''
}

function applyEmbedEdit(detail: EmbedEditRequestDetail, title: string, url: string) {
  if (!crepe) return
  const token = createEmbedToken(title, url)

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    let tr = state.tr

    if (detail.kind === 'token') {
      tr = tr.insertText(token, detail.from, detail.to)
    } else {
      const imageNode = state.doc.nodeAt(detail.from)
      if (imageNode?.type.name === 'image') {
        tr = tr.setNodeMarkup(detail.from, undefined, {
          ...imageNode.attrs,
          src: url,
          alt: `embed:${title}`,
          title,
        })
      } else {
        tr = tr.insertText(token, detail.from, detail.to)
      }
    }

    view.dispatch(tr)
    view.focus()
  })
}

function confirmEmbed() {
  const url = embedUrlInput.value.trim()
  if (!isValidEmbedUrl(url)) return

  const title = embedTitleInput.value.trim() || '内嵌网页'
  const target = embedEditTarget.value

  if (embedDialogMode.value === 'edit' && target) {
    applyEmbedEdit(target, title, url)
    closeEmbedDialog()
    return
  }

  const token = createEmbedToken(title, url)

  if (crepe) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const tr = state.tr.insertText(`\n${token}\n`, state.selection.from)
      view.dispatch(tr)
      view.focus()
    })
  }

  closeEmbedDialog()
}

function onEmbedEditRequest(event: Event) {
  const customEvent = event as CustomEvent<EmbedEditRequestDetail>
  if (!customEvent.detail) return
  openEmbedEditDialog(customEvent.detail)
}


// ── Whiteboard dialog ──

function openWhiteboardDialog() {
  whiteboardEditorMode.value = 'insert'
  whiteboardEditTarget.value = null
  whiteboardEditorTitle.value = '白板'
  whiteboardEditorScene.value = null
  whiteboardEditorVisible.value = true
}

function openWhiteboardEditDialog(detail: WhiteboardEditRequestDetail) {
  whiteboardEditorMode.value = 'edit'
  whiteboardEditTarget.value = detail

  const stored = getWhiteboardById(detail.id)
  whiteboardEditorTitle.value = detail.title || stored?.title || '白板'
  whiteboardEditorScene.value = stored?.scene ?? null
  whiteboardEditorVisible.value = true
}

function closeWhiteboardEditor() {
  whiteboardEditorVisible.value = false
  whiteboardEditorMode.value = 'insert'
  whiteboardEditTarget.value = null
  whiteboardEditorTitle.value = '白板'
  whiteboardEditorScene.value = null
}

function applyWhiteboardEdit(detail: WhiteboardEditRequestDetail, payload: WhiteboardSavePayload) {
  if (!crepe) return

  const normalizedTitle = payload.title.trim() || '白板'
  const record = upsertWhiteboard({
    id: detail.id,
    title: normalizedTitle,
    previewUrl: payload.previewUrl,
    scene: payload.scene,
  })
  const source = createWhiteboardSource(record.id)
  const token = createWhiteboardToken(normalizedTitle, record.id)

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    let tr = state.tr

    if (detail.kind === 'token') {
      tr = tr.insertText(token, detail.from, detail.to)
    } else {
      const imageNode = state.doc.nodeAt(detail.from)
      if (imageNode?.type.name === 'image') {
        tr = tr.setNodeMarkup(detail.from, undefined, {
          ...imageNode.attrs,
          src: source,
          alt: `whiteboard:${normalizedTitle}`,
          title: normalizedTitle,
        })
      } else {
        tr = tr.insertText(token, detail.from, detail.to)
      }
    }

    view.dispatch(tr)
    view.focus()
  })

  crepe.editor.action(forceUpdate())
}

function saveWhiteboard(payload: WhiteboardSavePayload) {
  const target = whiteboardEditTarget.value

  if (whiteboardEditorMode.value === 'edit' && target) {
    applyWhiteboardEdit(target, payload)
    closeWhiteboardEditor()
    return
  }

  const id = createWhiteboardId()
  const normalizedTitle = payload.title.trim() || '白板'
  upsertWhiteboard({
    id,
    title: normalizedTitle,
    previewUrl: payload.previewUrl,
    scene: payload.scene,
  })
  const token = createWhiteboardToken(normalizedTitle, id)

  if (crepe) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const tr = state.tr.insertText(`\n${token}\n`, state.selection.from)
      view.dispatch(tr)
      view.focus()
    })

    crepe.editor.action(forceUpdate())
  }

  closeWhiteboardEditor()
}

function onWhiteboardEditRequest(event: Event) {
  const customEvent = event as CustomEvent<WhiteboardEditRequestDetail>
  if (!customEvent.detail) return
  openWhiteboardEditDialog(customEvent.detail)
}

// ── Flowchart dialog ──

function openFlowchartDialog() {
  flowchartEditorMode.value = 'insert'
  flowchartEditTarget.value = null
  flowchartEditorTitle.value = '流程图'
  flowchartEditorScene.value = null
  flowchartEditorVisible.value = true
}

function openFlowchartEditDialog(detail: FlowchartEditRequestDetail) {
  flowchartEditorMode.value = 'edit'
  flowchartEditTarget.value = detail

  const stored = getFlowchartById(detail.id)
  flowchartEditorTitle.value = detail.title || stored?.title || '流程图'
  flowchartEditorScene.value = stored?.scene ?? null
  flowchartEditorVisible.value = true
}

function closeFlowchartEditor() {
  flowchartEditorVisible.value = false
  flowchartEditorMode.value = 'insert'
  flowchartEditTarget.value = null
  flowchartEditorTitle.value = '流程图'
  flowchartEditorScene.value = null
}

function applyFlowchartEdit(detail: FlowchartEditRequestDetail, payload: FlowchartSavePayload) {
  if (!crepe) return

  const normalizedTitle = payload.title.trim() || '流程图'
  const existing = getFlowchartById(detail.id)
  const nextPreview = payload.previewUrl.trim() || existing?.previewUrl || ''
  const record = upsertFlowchart({
    id: detail.id,
    title: normalizedTitle,
    previewUrl: nextPreview,
    scene: payload.scene,
  })
  const source = createFlowchartSource(record.id)
  const token = createFlowchartToken(normalizedTitle, record.id)

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    let tr = state.tr

    if (detail.kind === 'token') {
      tr = tr.insertText(token, detail.from, detail.to)
    } else {
      const imageNode = state.doc.nodeAt(detail.from)
      if (imageNode?.type.name === 'image') {
        tr = tr.setNodeMarkup(detail.from, undefined, {
          ...imageNode.attrs,
          src: source,
          alt: `flowchart:${normalizedTitle}`,
          title: normalizedTitle,
        })
      } else {
        tr = tr.insertText(token, detail.from, detail.to)
      }
    }

    view.dispatch(tr)
    view.focus()
  })

  crepe.editor.action(forceUpdate())
}

function saveFlowchart(payload: FlowchartSavePayload) {
  const target = flowchartEditTarget.value

  if (flowchartEditorMode.value === 'edit' && target) {
    applyFlowchartEdit(target, payload)
    closeFlowchartEditor()
    return
  }

  const id = createFlowchartId()
  const normalizedTitle = payload.title.trim() || '流程图'
  upsertFlowchart({
    id,
    title: normalizedTitle,
    previewUrl: payload.previewUrl.trim(),
    scene: payload.scene,
  })
  const token = createFlowchartToken(normalizedTitle, id)

  if (crepe) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const tr = state.tr.insertText(`\n${token}\n`, state.selection.from)
      view.dispatch(tr)
      view.focus()
    })

    crepe.editor.action(forceUpdate())
  }

  closeFlowchartEditor()
}

function onFlowchartEditRequest(event: Event) {
  const customEvent = event as CustomEvent<FlowchartEditRequestDetail>
  if (!customEvent.detail) return
  openFlowchartEditDialog(customEvent.detail)
}

function onGlobalKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault()
    if (paletteVisible.value) closePalette()
    else openPalette()
    return
  }

  if (event.key === 'Escape' && paletteVisible.value) {
    closePalette()
  }
}

watch(activeCommentId, () => {
  updateActiveCommentRange()
})

watch(comments, (items) => {
  if (!items.length) {
    activeCommentId.value = null
    activeCommentRange.value = null
    refreshCommentHighlight()
    return
  }

  if (suppressCommentAutoSelect) {
    refreshCommentHighlight()
    return
  }

  if (!items.some((item) => item.id === activeCommentId.value)) {
    activeCommentId.value = items[0].id
  }
})

watch(
  featureFlags,
  () => {
    void rebuildEditor()
  },
  { deep: true }
)

watch(readonlyMode, (value) => {
  crepe?.setReadonly(value)
})

watch(collabWanted, (value) => {
  if (value) {
    syncLocalAwareness()
    void websocketProvider.connect()
  } else {
    websocketProvider.disconnect()
    refreshCollaborators()
  }
})

watch(filteredPaletteActions, (items) => {
  if (!items.length) {
    paletteIndex.value = 0
    return
  }

  if (paletteIndex.value > items.length - 1) {
    paletteIndex.value = 0
  }
})

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener(EMBED_EDIT_REQUEST_EVENT, onEmbedEditRequest as EventListener)
  window.addEventListener(WHITEBOARD_EDIT_REQUEST_EVENT, onWhiteboardEditRequest as EventListener)
  window.addEventListener(FLOWCHART_EDIT_REQUEST_EVENT, onFlowchartEditRequest as EventListener)
  yComments.observe(syncCommentsFromSharedState)
  ySnapshots.observe(syncSnapshotsFromSharedState)
  provider.awareness?.on('change', refreshCollaborators)
  syncCommentsFromSharedState()
  syncSnapshotsFromSharedState()
  refreshCollaborators()
  await rebuildEditor(initialMarkdown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener(EMBED_EDIT_REQUEST_EVENT, onEmbedEditRequest as EventListener)
  window.removeEventListener(WHITEBOARD_EDIT_REQUEST_EVENT, onWhiteboardEditRequest as EventListener)
  window.removeEventListener(FLOWCHART_EDIT_REQUEST_EVENT, onFlowchartEditRequest as EventListener)

  if (syncTimer) clearTimeout(syncTimer)
  if (copyTimer) clearTimeout(copyTimer)

  yComments.unobserve(syncCommentsFromSharedState)
  ySnapshots.unobserve(syncSnapshotsFromSharedState)
  provider.awareness?.off('change', refreshCollaborators)
  provider.destroy()
  websocketProvider.destroy()
  ydoc.destroy()

  void destroyEditor()
})
</script>

<template>
  <section class="page milk-playground-page">
    <h1>Milkdown Playground（评论 + 历史记录版）</h1>
    <p class="subtitle">
      保留 Milkdown 单方案，并补齐飞书式评论与手动历史记录：选中文本评论、锚点定位、创建快照、按版本还原。
    </p>

    <div class="toolbar">
      <label class="check-inline">
        主题
        <select v-model="theme" class="mini-select">
          <option v-for="item in themeOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>

      <label class="check-inline">
        <input v-model="darkMode" type="checkbox" /> Dark
      </label>

      <label class="check-inline">
        <input v-model="readonlyMode" type="checkbox" /> 只读
      </label>

      <label class="check-inline">
        <input v-model="autoSyncMarkdown" type="checkbox" /> 右侧自动同步
      </label>

      <button type="button" class="btn" @click="openPalette">功能面板 (Ctrl+K)</button>
      <button
        type="button"
        class="btn"
        :aria-expanded="markdownPaneVisible"
        @click="markdownPaneVisible = !markdownPaneVisible"
      >
        {{ markdownPaneVisible ? '隐藏 Markdown' : '显示 Markdown' }}
      </button>
      <button type="button" class="btn" :disabled="isRebuilding" @click="applyMarkdownFromPane">应用右侧 Markdown</button>
      <button type="button" class="btn" @click="resetSampleMarkdown">恢复示例</button>
      <button type="button" class="btn" @click="copyMarkdown">{{ copied ? '已复制' : '复制 Markdown' }}</button>
      <button type="button" class="btn" @click="connectCollab">连接协同</button>
      <button type="button" class="btn ghost" @click="disconnectCollab">断开协同</button>
      <span class="status" :data-online="status === 'connected'">{{ status }}</span>
      <span class="status collab-count" :data-online="status === 'connected'">
        {{ collaboratorCountLabel }}
      </span>
      <div v-if="collaborators.length" class="collab-presence">
        <span
          v-for="item in collaborators"
          :key="item.id"
          class="collab-user"
          :class="{ local: item.isLocal }"
          :style="{ '--user-color': item.color }"
        >
          <i class="collab-user-dot"></i>
          {{ item.isLocal ? `${item.name}（我）` : item.name }}
        </span>
      </div>
    </div>

    <section class="milk-playground-config card">
      <div class="config-head">
        <h3>Crepe Feature 开关</h3>
        <span>{{ enabledFeatureCount }} / {{ crepeFeatureItems.length }} 已启用</span>
      </div>
      <div class="feature-grid">
        <label v-for="item in crepeFeatureItems" :key="item.key" class="feature-switch">
          <input v-model="featureFlags[item.key]" type="checkbox" />
          <div>
            <strong>{{ item.label }}</strong>
            <p>{{ item.description }}</p>
          </div>
        </label>
      </div>
    </section>

    <div class="milk-workbench">
      <section class="play-pane play-pane-editor">
        <header class="play-pane-head">
          <h3>Visual Editor</h3>
          <span>{{ activeThemeClass }}</span>
        </header>
        <div class="play-editor-shell" :class="activeThemeClass">
          <div ref="host" class="playground-host"></div>
        </div>

      </section>

      <aside class="play-side-panels">
        <section class="panel comments-panel">
          <div class="comments-panel-head">
            <div>
              <h3>评论</h3>
              <p class="panel-tip">{{ commentCountLabel }} · 选中正文后可直接补评</p>
            </div>
            <div class="panel-head-actions">
              <span class="comments-badge" :data-active="Boolean(activeComment)">
                {{ activeComment ? '已定位' : '未选中' }}
              </span>
              <button
                type="button"
                class="panel-toggle"
                :aria-expanded="!commentsCollapsed"
                @click="commentsCollapsed = !commentsCollapsed"
              >
                {{ commentsCollapsed ? '展开' : '收起' }}
              </button>
            </div>
          </div>

          <div v-show="!commentsCollapsed" class="panel-section-body">
            <blockquote class="selection-quote" :class="{ empty: !selectedRange }">
              {{ selectedQuotePreview }}
            </blockquote>

            <textarea
              ref="commentInputRef"
              v-model="commentDraft"
              class="comment-input"
              rows="4"
              placeholder="例如：这里需要补充背景、补数据来源，或者给出结论解释。"
            ></textarea>

            <div class="row-actions comment-actions">
              <button
                type="button"
                class="btn"
                :disabled="!selectedRange || !commentDraft.trim()"
                @click="submitComment"
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
                @click="focusComment(item)"
              >
                <div class="panel-item-head">
                  <strong>{{ item.author }}</strong>
                  <span>{{ formatTime(item.createdAt) }}</span>
                </div>
                <p class="comment-text">{{ item.text }}</p>
                <p class="panel-item-quote">“{{ item.quote }}”</p>
                <div class="row-actions">
                  <button type="button" class="btn xs" @click.stop="focusComment(item)">定位</button>
                  <button type="button" class="btn xs ghost" @click.stop="deleteComment(item.id)">
                    删除
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="panel-tip comments-empty">
              还没有评论。先在左侧选中一段文本，再输入评论内容。
            </p>
          </div>
        </section>

        <section class="panel history-panel">
          <div class="history-panel-head">
            <div>
              <h3>历史记录</h3>
              <p class="panel-tip">{{ snapshotCountLabel }} · 点击版本卡片即可还原左侧文档</p>
            </div>
            <div class="panel-head-actions">
              <span class="history-badge" :data-active="Boolean(activeSnapshot)">
                {{ activeSnapshot ? '当前版本' : '未选中' }}
              </span>
              <button
                type="button"
                class="panel-toggle"
                :aria-expanded="!historyCollapsed"
                @click="historyCollapsed = !historyCollapsed"
              >
                {{ historyCollapsed ? '展开' : '收起' }}
              </button>
            </div>
          </div>

          <div v-show="!historyCollapsed" class="panel-section-body">
            <input
              v-model="snapshotLabel"
              class="mini-input"
              type="text"
              placeholder="例如：补充结论前 / 发布前检查"
              @keydown.enter.prevent="createHistorySnapshot"
            />

            <div class="row-actions history-actions">
              <button type="button" class="btn" @click="createHistorySnapshot">创建快照</button>
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
                @click="void selectHistorySnapshot(item)"
                @keydown.enter.prevent="void selectHistorySnapshot(item)"
                @keydown.space.prevent="void selectHistorySnapshot(item)"
              >
                <div class="panel-item-head">
                  <strong>{{ item.label }}</strong>
                  <span>{{ formatTime(item.createdAt) }}</span>
                </div>
                <p class="history-preview">{{ getSnapshotPreview(item) }}</p>
                <div class="row-actions">
                  <button type="button" class="btn xs" @click.stop="restoreHistorySnapshot(item)">
                    还原
                  </button>
                  <button type="button" class="btn xs ghost" @click.stop="deleteHistorySnapshot(item.id)">
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
      </aside>

      <section v-if="markdownPaneVisible" class="play-pane play-pane-markdown">
        <header class="play-pane-head">
          <h3>Markdown</h3>
          <div class="play-pane-head-actions">
            <span>{{ markdown.split('\n').length }} 行</span>
            <button type="button" class="btn xs ghost" @click="markdownPaneVisible = false">收起</button>
          </div>
        </header>

        <div class="markdown-pane">
          <pre class="markdown-lines">{{ markdownLineNumbers }}</pre>
          <textarea
            v-model="markdown"
            class="markdown-textarea"
            spellcheck="false"
            @input="scheduleApplyMarkdownFromPane"
          ></textarea>
        </div>
      </section>
    </div>

    <section class="playground-capability card">
      <h3>Playground 能力清单</h3>
      <div class="cap-grid">
        <article v-for="section in capabilitySections" :key="section.title" class="cap-card">
          <h4>{{ section.title }}</h4>
          <div class="cap-chips">
            <span v-for="item in section.items" :key="item" class="cap-chip">{{ item }}</span>
          </div>
        </article>
      </div>
    </section>

    <p class="tip">
      编辑提示：在左侧输入 <code>/</code> 打开块菜单；选中正文后，可在浮动工具栏点击评论按钮，再到右侧输入评论并定位回锚点。历史记录为手动快照，可在右侧直接还原。协同房间：<code>{{ room }}</code>，服务地址：<code>{{ wsUrl }}</code>
    </p>
  </section>

  <div v-if="paletteVisible" class="command-menu-mask" @click="closePalette">
    <div class="command-menu" @click.stop>
      <div class="command-menu-title">Milkdown 功能面板</div>
      <input
        ref="paletteInputRef"
        v-model="paletteQuery"
        class="command-input"
        type="text"
        placeholder="搜索功能：theme / collab / table / slash ..."
        @keydown="onPaletteKeydown"
      />

      <ul class="command-list">
        <li
          v-for="(item, index) in filteredPaletteActions"
          :key="item.id"
          class="command-item"
          :class="{ active: index === paletteIndex }"
          @mouseenter="paletteIndex = index"
          @click="runPaletteAction(item)"
        >
          <div class="menu-row">
            <strong>{{ item.label }}</strong>
            <span class="command-menu-group">{{ item.group }}</span>
          </div>
          <p>{{ item.description }}</p>
        </li>
      </ul>
      <p v-if="filteredPaletteActions.length === 0" class="panel-tip">没有匹配功能</p>
    </div>
  </div>

  <!-- Embed URL dialog -->
  <div v-if="embedDialogVisible" class="command-menu-mask" @click="closeEmbedDialog">
    <div class="embed-dialog" @click.stop>
      <div class="embed-dialog-title">{{ embedDialogTitle }}</div>
      <div class="embed-dialog-body">
        <label class="embed-field">
          <span>网页地址（仅 HTTPS）</span>
          <input
            v-model="embedUrlInput"
            class="command-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            autofocus
            @keydown.enter.prevent="confirmEmbed"
            @keydown.escape.prevent="closeEmbedDialog"
          />
        </label>
        <label class="embed-field">
          <span>标题（可选）</span>
          <input
            v-model="embedTitleInput"
            class="command-input"
            type="text"
            placeholder="内嵌网页"
            @keydown.enter.prevent="confirmEmbed"
            @keydown.escape.prevent="closeEmbedDialog"
          />
        </label>
        <p v-if="embedUrlInput.trim() && !embedUrlValid" class="embed-url-error">
          请输入合法的 HTTPS 链接
        </p>
      </div>
      <div class="embed-dialog-actions">
        <button type="button" class="btn" :disabled="!embedUrlValid" @click="confirmEmbed">{{ embedDialogConfirmText }}</button>
        <button type="button" class="btn ghost" @click="closeEmbedDialog">取消</button>
      </div>
    </div>
  </div>

  <WhiteboardExcalidrawDialog
    v-if="whiteboardEditorVisible"
    :mode="whiteboardEditorMode"
    :title="whiteboardEditorTitle"
    :initial-scene="whiteboardEditorScene"
    @cancel="closeWhiteboardEditor"
    @save="saveWhiteboard"
  />

  <FlowchartLogicDialog
    v-if="flowchartEditorVisible"
    :mode="flowchartEditorMode"
    :title="flowchartEditorTitle"
    :initial-scene="flowchartEditorScene"
    @cancel="closeFlowchartEditor"
    @save="saveFlowchart"
  />
</template>









