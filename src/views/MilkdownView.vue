<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import {
  createMindmapId,
  createMindmapSource,
  createMindmapToken,
  getMindmapById,
  upsertMindmap,
  MINDMAP_EDIT_REQUEST_EVENT,
  type MindmapEditRequestDetail,
} from '../features/editor-enhance/mindmaps'
import createWhiteboardNodeViewPlugin from '../features/editor-enhance/whiteboard-node-view'
import createFlowchartNodeViewPlugin from '../features/editor-enhance/flowchart-node-view'
import createMindmapNodeViewPlugin from '../features/editor-enhance/mindmap-node-view'
import WhiteboardExcalidrawDialog from '../components/WhiteboardExcalidrawDialog.vue'
import FlowchartLogicDialog from '../components/FlowchartLogicDialog.vue'
import EmbedWebDialog from '../components/EmbedWebDialog.vue'
import CommentPanel from '../components/CommentPanel.vue'
import HistoryPanel from '../components/HistoryPanel.vue'

const MindmapSimpleDialog = defineAsyncComponent(
  () => import('../components/MindmapSimpleDialog.vue')
)

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
type ThemeKind = 'nord' | 'frame' | 'classic'

interface CrepeFeatureItem {
  key: CrepeFeature
  label: string
  description: string
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

interface MindmapSavePayload {
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

const crepeFeatureItems: CrepeFeatureItem[] = [
  {
    key: CrepeFeature.Toolbar,
    label: 'Toolbar',
    description: '閫変腑鏂囨湰鏃舵樉绀烘牸寮忓伐鍏锋爮',
  },
  {
    key: CrepeFeature.BlockEdit,
    label: 'Block Edit + Slash',
    description: '宸︿晶鍧楁墜鏌勩€佹嫋鎷戒笌 / 鑿滃崟',
  },
  {
    key: CrepeFeature.CodeMirror,
    label: 'Code Block',
    description: '代码块语言选择与高亮编辑',
  },
  {
    key: CrepeFeature.Table,
    label: 'Table Block',
    description: '琛ㄦ牸鎻掑叆銆佽鍒楁搷浣滀笌瀵归綈',
  },
  {
    key: CrepeFeature.ImageBlock,
    label: 'Image Block + Inline',
    description: '鍥剧墖鍧椼€佽鍐呭浘鐗囦笌涓婁紶鑳藉姏',
  },
  {
    key: CrepeFeature.LinkTooltip,
    label: 'Link Tooltip',
    description: '閾炬帴鎻愮ず銆佺紪杈戜笌澶嶅埗',
  },
  {
    key: CrepeFeature.ListItem,
    label: 'List Item Block',
    description: '无序/有序/任务列表可视化',
  },
  {
    key: CrepeFeature.Cursor,
    label: 'Cursor',
    description: 'gap cursor / drop cursor 澧炲己',
  },
  {
    key: CrepeFeature.Latex,
    label: 'Latex',
    description: '行内与块级数学公式支持',
  },
  {
    key: CrepeFeature.Placeholder,
    label: 'Placeholder',
    description: '空文档占位提示',
  },
]

const initialMarkdown = `# Q4 Content Strategy & Global Distribution

## 1. Executive Overview

In the evolving digital landscape, our editorial mission remains clear: to synthesize complex information into authoritative narratives. This quarter, we focus on **omni-channel synchronicity**, ensuring our core messaging remains consistent across whitepapers, social snippets, and interactive case studies.

## 2. Core Methodology

Our approach is divided into three distinct phases to ensure quality and scalability:

1. Deep Research Phase
2. Iterative Drafting
3. Refinement & Polishing
`

const host = ref<HTMLDivElement | null>(null)
const commentPanelRef = ref<{
  focusInput: () => void
  scrollCommentIntoView: (id: string) => void
} | null>(null)
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
const commentDrawerOpen = ref(true)
const historyModalOpen = ref(false)
const commentDraft = ref('')
const snapshotLabel = ref('')
const comments = ref<EditorComment[]>([])
const snapshots = ref<HistorySnapshot[]>([])
const selectedRange = ref<SelectedQuoteRange | null>(null)
const activeCommentId = ref<string | null>(null)
const activeCommentRange = ref<CommentHighlightRange | null>(null)
const activeSnapshotId = ref<string | null>(null)

const embedDialogVisible = ref(false)
const embedDialogMode = ref<'insert' | 'edit'>('insert')
const embedEditTarget = ref<EmbedEditRequestDetail | null>(null)
const whiteboardEditorVisible = ref(false)
const whiteboardEditorMode = ref<'insert' | 'edit'>('insert')
const whiteboardEditTarget = ref<WhiteboardEditRequestDetail | null>(null)
const whiteboardEditorTitle = ref('鐧芥澘')
const whiteboardEditorScene = ref<unknown>(null)
const flowchartEditorVisible = ref(false)
const flowchartEditorMode = ref<'insert' | 'edit'>('insert')
const flowchartEditTarget = ref<FlowchartEditRequestDetail | null>(null)
const flowchartEditorTitle = ref('流程图')
const flowchartEditorScene = ref<unknown>(null)

const mindmapEditorVisible = ref(false)
const mindmapEditorMode = ref<'insert' | 'edit'>('insert')
const mindmapEditTarget = ref<MindmapEditRequestDetail | null>(null)
const mindmapEditorTitle = ref('鎬濈淮瀵煎浘')
const mindmapEditorScene = ref<unknown>(null)


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
  name: `鍗忎綔鑰?${String(ydoc.clientID).slice(-4)}`,
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

const HISTORY_MODAL_OPEN_EVENT = 'open-history-modal'

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
const mindmapNodeView = $prose(() => createMindmapNodeViewPlugin())

const activeThemeClass = computed(() => `milk-theme-${theme.value}${darkMode.value ? '-dark' : ''}`)

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
    label: `${featureFlags.value[item.key] ? '鍏抽棴' : '鍚敤'} ${item.label}`,
    description: item.description,
    run: () => {
      featureFlags.value[item.key] = !featureFlags.value[item.key]
    },
  }))

  actions.push(
    {
      id: 'theme-nord',
      group: 'Theme',
      label: '鍒囨崲涓婚锛歂ord',
      description: '鏇村亸鐭ヨ瘑搴撻鏍肩殑杞婚噺涓婚',
      run: () => {
        theme.value = 'nord'
      },
    },
    {
      id: 'theme-frame',
      group: 'Theme',
      label: '鍒囨崲涓婚锛欶rame',
      description: '更中性、文档感更强的主题',
      run: () => {
        theme.value = 'frame'
      },
    },
    {
      id: 'theme-classic',
      group: 'Theme',
      label: '鍒囨崲涓婚锛欳lassic',
      description: '瀹樻柟缁忓吀瑙嗚椋庢牸',
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
      id: 'toggle-markdown-pane',
      group: 'Editor',
      label: `${markdownPaneVisible.value ? '闅愯棌' : '鏄剧ず'} Markdown 闈㈡澘`,
      description: '鍒囨崲鍙充晶 Markdown 闈㈡澘鏄剧ず',
      run: () => {
        markdownPaneVisible.value = !markdownPaneVisible.value
      },
    },
    {
      id: 'toggle-auto-sync',
      group: 'Editor',
      label: `${autoSyncMarkdown.value ? '关闭' : '开启'} Markdown 自动同步`,
      description: '鎺у埗鍙充晶 Markdown 杈撳叆鏃舵槸鍚﹁嚜鍔ㄥ簲鐢ㄥ埌宸︿晶',
      run: () => {
        autoSyncMarkdown.value = !autoSyncMarkdown.value
      },
    },
    {
      id: 'sync-pane',
      group: 'Editor',
      label: '将右侧 Markdown 应用到左侧',
      description: '鎵嬪姩瑙﹀彂 replaceAll 鍚屾',
      run: () => {
        void applyMarkdownFromPane()
      },
    },
    {
      id: 'sample',
      group: 'Editor',
      label: '鎭㈠ Playground 绀轰緥鏂囨。',
      description: '重置到默认演示内容',
      run: () => {
        void resetSampleMarkdown()
      },
    },
    {
      id: 'copy',
      group: 'Editor',
      label: '澶嶅埗褰撳墠 Markdown',
      description: '把右侧文本复制到剪贴板',
      run: () => {
        void copyMarkdown()
      },
    },
    {
      id: 'collab-connect',
      group: 'Collab',
      label: '杩炴帴鍗忓悓鏈嶅姟',
      description: '杩炴帴 Hocuspocus WebSocket',
      run: () => {
        connectCollab()
      },
    },
    {
      id: 'collab-disconnect',
      group: 'Collab',
      label: '鏂紑鍗忓悓鏈嶅姟',
      description: '鏂紑褰撳墠鎴块棿杩炴帴',
      run: () => {
        disconnectCollab()
      },
    },
    {
      id: 'snapshot-create',
      group: 'History',
      label: '鍒涘缓鎵嬪姩蹇収',
      description: '淇濆瓨褰撳墠鏂囨。涓庤瘎璁虹姸鎬侊紝鏂逛究鍚庣画杩樺師',
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
    },
    {
      id: 'insert-mindmap',
      group: 'Insert',
      label: '鎻掑叆鎬濈淮瀵煎浘',
      description: '鎵撳紑鎬濈淮瀵煎浘缂栬緫寮规骞舵彃鍏ュ埌鏂囨。',
      run: () => {
        openMindmapDialog()
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

const collaboratorCountLabel = computed(() => {
  if (status.value !== 'connected') return '协同未连接'
  return `${collaborators.value.length} 位协作者在线`
})

/**
 * Handle openCommentDrawer logic.
 */
function openCommentDrawer() {
  // Make the comment rail expand into the full drawer.
  commentDrawerOpen.value = true
}

/**
 * Handle closeCommentDrawer logic.
 */
function closeCommentDrawer() {
  // Collapse the drawer back to the Feishu-style rail.
  commentDrawerOpen.value = false
}

/**
 * Handle toggleCommentDrawer logic.
 */
function toggleCommentDrawer() {
  // One control toggles between the collapsed rail and the expanded drawer.
  if (commentDrawerOpen.value) closeCommentDrawer()
  else openCommentDrawer()
}

/**
 * Handle openHistoryModal logic.
 */
function openHistoryModal() {
  // History is now surfaced from the top bar into a modal shell.
  historyModalOpen.value = true
}

/**
 * Handle closeHistoryModal logic.
 */
function closeHistoryModal() {
  // Keep the snapshot state intact; only the modal visibility changes.
  historyModalOpen.value = false
}

/**
 * Handle getFeatureFlags logic.
 */
function getFeatureFlags() {
  // Translate UI toggle map into Crepe feature config shape.
  return crepeFeatureItems.reduce((acc, item) => {
    acc[item.key] = featureFlags.value[item.key]
    return acc
  }, {} as Partial<Record<CrepeFeature, boolean>>)
}

/**
 * Handle getEditorView logic.
 * @returns Return value.
 */
function getEditorView(): EditorView | null {
  // Access current ProseMirror view through Milkdown context.
  if (!crepe) return null

  let view: EditorView | null = null
  crepe.editor.action((ctx) => {
    view = ctx.get(editorViewCtx)
  })

  return view
}

/**
 * Handle isEditorCommentRecord logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function isEditorCommentRecord(value: unknown): value is EditorComment {
  // Runtime guard for data coming from shared Yjs state.
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

/**
 * Handle isHistorySnapshotRecord logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function isHistorySnapshotRecord(value: unknown): value is HistorySnapshot {
  // Runtime guard for snapshot list synced from Yjs/local state.
  if (!value || typeof value !== 'object') return false

  const item = value as HistorySnapshot
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    typeof item.content === 'string' &&
    typeof item.createdAt === 'number'
  )
}

/**
 * Handle isCollaboratorIdentity logic.
 * @param value - Parameter.
 * @returns Return value.
 */
function isCollaboratorIdentity(value: unknown): value is CollaboratorIdentity {
  // Awareness payload may be arbitrary; validate before rendering presence UI.
  if (!value || typeof value !== 'object') return false

  const item = value as CollaboratorIdentity
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.color === 'string'
  )
}

/**
 * Handle syncCommentsFromSharedState logic.
 */
function syncCommentsFromSharedState() {
  // Pull latest comments from Y.Array and drop invalid records.
  comments.value = yComments.toArray().filter(isEditorCommentRecord)
}

/**
 * Handle syncSnapshotsFromSharedState logic.
 */
function syncSnapshotsFromSharedState() {
  // Pull latest snapshots from Y.Array and drop invalid records.
  snapshots.value = ySnapshots.toArray().filter(isHistorySnapshotRecord)
}

/**
 * Handle replaceSharedComments logic.
 * @param next - Parameter.
 */
function replaceSharedComments(next: EditorComment[]) {
  // Replace whole list in one transaction to keep peer updates atomic.
  ydoc.transact(() => {
    yComments.delete(0, yComments.length)
    if (next.length) yComments.insert(0, next)
  })
}

/**
 * Handle replaceSharedSnapshots logic.
 * @param next - Parameter.
 */
function replaceSharedSnapshots(next: HistorySnapshot[]) {
  // Replace whole list in one transaction to keep peer updates atomic.
  ydoc.transact(() => {
    ySnapshots.delete(0, ySnapshots.length)
    if (next.length) ySnapshots.insert(0, next)
  })
}

/**
 * Handle refreshCollaborators logic.
 */
function refreshCollaborators() {
  // Rebuild collaborator list from awareness states and keep local user on top.
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

/**
 * Handle syncLocalAwareness logic.
 */
function syncLocalAwareness() {
  // Publish current user identity to awareness channel.
  provider.awareness?.setLocalStateField('user', localCollaborator)
  refreshCollaborators()
}

/**
 * Handle getCurrentMarkdownSnapshot logic.
 */
function getCurrentMarkdownSnapshot() {
  // Read markdown from editor when available; fallback to reactive pane value.
  if (!crepe) return markdown.value

  try {
    return crepe.getMarkdown()
  } catch {
    return markdown.value
  }
}

/**
 * Handle serializeSnapshotPayload logic.
 */
function serializeSnapshotPayload() {
  // Snapshot stores both markdown and comments to support full rollback.
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

/**
 * Handle parseSnapshotPayload logic.
 * @param content - Parameter.
 * @returns Return value.
 */
function parseSnapshotPayload(content: string): SnapshotPayload {
  // Backward compatible parser: JSON payload first, plain markdown fallback.
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

/**
 * Handle getDefaultSnapshotLabel logic.
 */
function getDefaultSnapshotLabel() {
  // Human-friendly incremental default label for manual snapshots.
  return `鎵嬪姩蹇収 ${snapshots.value.length + 1}`
}

/**
 * Handle findCommentByPosition logic.
 * @param pos - Parameter.
 */
function findCommentByPosition(pos: number) {
  // Resolve editor click position to its owning comment anchor range.
  return (
    comments.value.find((item) => {
      const from = Math.min(item.from, item.to)
      const to = Math.max(item.from, item.to)
      return pos >= from && pos <= to
    }) ?? null
  )
}

/**
 * Handle activateCommentById logic.
 * @param id - Parameter.
 */
function activateCommentById(id: string) {
  // Activate comment card and sync highlight state in editor.
  const comment = comments.value.find((item) => item.id === id)
  if (!comment) return

  openCommentDrawer()

  activeCommentId.value = comment.id
  updateActiveCommentRange()

  void nextTick(() => {
    commentPanelRef.value?.scrollCommentIntoView(comment.id)
  })
}

/**
 * Handle refreshCommentHighlight logic.
 */
function refreshCommentHighlight() {
  // Trigger ProseMirror decoration refresh for comment anchor marks.
  crepe?.editor.action(forceUpdate())
}

/**
 * Handle syncSelectionState logic.
 */
function syncSelectionState(selection?: Selection) {
  // Convert current editor selection into a quote payload for comment creation.
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

/**
 * Handle updateActiveCommentRange logic.
 */
function updateActiveCommentRange() {
  // Keep active highlight range aligned with currently selected comment.
  const current = comments.value.find((item) => item.id === activeCommentId.value)
  activeCommentRange.value = current ? { from: current.from, to: current.to } : null
  refreshCommentHighlight()
}

/**
 * Handle focusComment logic.
 * @param comment - Parameter.
 */
function focusComment(comment: EditorComment) {
  // Jump editor selection to comment anchor and bring sidebar card into view.
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
    commentPanelRef.value?.scrollCommentIntoView(comment.id)
  })
}

/**
 * Handle submitComment logic.
 */
function submitComment() {
  // Validate draft + selection, append comment, then focus newly created item.
  if (!selectedRange.value) return

  openCommentDrawer()

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

/**
 * Handle beginCommentFromSelection logic.
 */
function beginCommentFromSelection() {
  // Prepare highlight for current selection and move focus to comment input.
  syncSelectionState()
  if (!selectedRange.value) return


  openCommentDrawer()
  activeCommentId.value = null
  activeCommentRange.value = {
    from: selectedRange.value.from,
    to: selectedRange.value.to,
  }
  refreshCommentHighlight()

  void nextTick(() => {
    commentPanelRef.value?.focusInput()
  })
}

/**
 * Handle createHistorySnapshot logic.
 */
function createHistorySnapshot() {
  // Persist current markdown + comments as a new manual snapshot.
  const label = snapshotLabel.value.trim() || getDefaultSnapshotLabel()
  const next = createSnapshot(snapshots.value, {
    label,
    content: serializeSnapshotPayload(),
  })

  replaceSharedSnapshots(next)
  activeSnapshotId.value = next[0]?.id ?? null
  snapshotLabel.value = ''
}

/**
 * Handle restoreHistorySnapshot logic.
 * @param snapshot - Parameter.
 */
async function restoreHistorySnapshot(snapshot: HistorySnapshot) {
  // Restore both editor content and comment state from selected snapshot payload.
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

/**
 * Handle selectHistorySnapshot logic.
 * @param snapshot - Parameter.
 */
async function selectHistorySnapshot(snapshot: HistorySnapshot) {
  await restoreHistorySnapshot(snapshot)
}

/**
 * Handle deleteHistorySnapshot logic.
 * @param id - Parameter.
 */
function deleteHistorySnapshot(id: string) {
  // Remove snapshot and keep active pointer valid.
  replaceSharedSnapshots(removeSnapshot(snapshots.value, id))

  if (activeSnapshotId.value === id) {
    activeSnapshotId.value = snapshots.value[0]?.id ?? null
  }
}

/**
 * Handle deleteComment logic.
 * @param id - Parameter.
 */
function deleteComment(id: string) {
  // Remove comment and update active highlight fallback.
  replaceSharedComments(removeComment(comments.value, id))

  if (activeCommentId.value === id) {
    activeCommentId.value = comments.value[0]?.id ?? null
    updateActiveCommentRange()
  }
}

/**
 * Handle destroyEditor logic.
 */
async function destroyEditor() {
  // Destroy current Crepe instance before full rebuild/theme reconfiguration.
  if (!crepe) return
  const current = crepe
  crepe = null
  await current.destroy()
}

/**
 * Handle rebuildEditor logic.
 */
async function rebuildEditor(seed?: string) {
  // Recreate editor with latest feature toggles and custom block/toolbar hooks.
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
            label: '鍐呭祵缃戦〉',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
            onRun: () => {
              openEmbedDialog()
            },
          })

          advancedGroup.addItem('whiteboard', {
            label: '鐧芥澘',
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

          advancedGroup.addItem('mindmap', {
            label: '鎬濈淮瀵煎浘',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="12" cy="19" r="2"/><path d="M10.4 6.2L7.6 10.8"/><path d="M13.6 6.2L16.4 10.8"/><path d="M7.8 13.2L10.8 17"/><path d="M16.2 13.2L13.2 17"/></svg>',
            onRun: () => {
              openMindmapDialog()
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
  instance.editor.use(mindmapNodeView)

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
  const createdMarkdown = instance.getMarkdown()
  markdown.value = createdMarkdown

  if (!createdMarkdown.trim() && nextMarkdown.trim()) {
    await syncEditorMarkdown(nextMarkdown)
    markdown.value = instance.getMarkdown()
  }

  syncSelectionState()
  updateActiveCommentRange()

  if (collabWanted.value) void websocketProvider.connect()
  else websocketProvider.disconnect()

  isRebuilding.value = false
}

/**
 * Handle applyMarkdownFromPane logic.
 */
async function applyMarkdownFromPane() {
  // Manually apply right markdown pane content into visual editor.
  if (!crepe || syncingFromEditor) return

  await syncEditorMarkdown(markdown.value)
}

/**
 * Handle syncEditorMarkdown logic.
 * @param nextMarkdown - Parameter.
 */
async function syncEditorMarkdown(nextMarkdown: string) {
  // Prefer collab template update path; fallback to local replaceAll.
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

/**
 * Handle scheduleApplyMarkdownFromPane logic.
 */
function scheduleApplyMarkdownFromPane() {
  // Debounce markdown pane typing to avoid expensive per-keystroke updates.
  if (!autoSyncMarkdown.value) return
  if (syncTimer) clearTimeout(syncTimer)

  syncTimer = setTimeout(() => {
    void applyMarkdownFromPane()
  }, 120)
}

/**
 * Handle resetSampleMarkdown logic.
 */
async function resetSampleMarkdown() {
  markdown.value = initialMarkdown
  await applyMarkdownFromPane()
  replaceSharedComments([])
  activeCommentId.value = null
  selectedRange.value = null
  updateActiveCommentRange()
}

/**
 * Handle copyMarkdown logic.
 */
async function copyMarkdown() {
  // Clipboard helper for quick export/debug usage.
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

/**
 * Handle connectCollab logic.
 */
function connectCollab() {
  // Enable desired collab state; watch() handles actual socket connect.
  collabWanted.value = true
  syncLocalAwareness()
}

/**
 * Handle disconnectCollab logic.
 */
function disconnectCollab() {
  // Clear awareness + mark collab as off for deterministic disconnect flow.
  provider.awareness?.setLocalState(null)
  collabWanted.value = false
  refreshCollaborators()
}

/**
 * Handle openPalette logic.
 */
function openPalette() {
  // Open command palette and focus search input.
  paletteVisible.value = true
  paletteQuery.value = ''
  paletteIndex.value = 0
  void nextTick(() => {
    paletteInputRef.value?.focus()
  })
}

/**
 * Handle closePalette logic.
 */
function closePalette() {
  paletteVisible.value = false
  paletteQuery.value = ''
  paletteIndex.value = 0
}

/**
 * Handle movePalette logic.
 * @param step - Parameter.
 */
function movePalette(step: 1 | -1) {
  const size = filteredPaletteActions.value.length
  if (!size) return
  paletteIndex.value = (paletteIndex.value + step + size) % size
}

/**
 * Handle runPaletteAction logic.
 * @param item - Parameter.
 */
function runPaletteAction(item: PaletteAction) {
  // Execute action and close menu to mirror command palette UX conventions.
  item.run()
  closePalette()
}

/**
 * Handle onPaletteKeydown logic.
 * @param event - Parameter.
 */
function onPaletteKeydown(event: KeyboardEvent) {
  // Keyboard navigation for command menu list.
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


/**
 * Handle openEmbedDialog logic.
 */
function openEmbedDialog() {
  // Open insert mode with clean state.
  embedDialogMode.value = 'insert'
  embedEditTarget.value = null
  embedDialogVisible.value = true
}

/**
 * Handle openEmbedEditDialog logic.
 * @param detail - Parameter.
 */
function openEmbedEditDialog(detail: EmbedEditRequestDetail) {
  // Open edit mode with node range metadata from NodeView event.
  embedDialogMode.value = 'edit'
  embedEditTarget.value = detail
  embedDialogVisible.value = true
}

/**
 * Handle closeEmbedDialog logic.
 */
function closeEmbedDialog() {
  // Reset dialog state to default insert mode.
  embedDialogVisible.value = false
  embedDialogMode.value = 'insert'
  embedEditTarget.value = null
}

/**
 * Handle applyEmbedEdit logic.
 * @param detail - Parameter.
 * @param title - Parameter.
 * @param url - Parameter.
 */
function applyEmbedEdit(detail: EmbedEditRequestDetail, title: string, url: string) {
  // Replace token text or image node in-place depending on source kind.
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

/**
 * Handle confirmEmbed logic.
 * @param payload - Parameter.
 */
function confirmEmbed(payload: { url: string; title: string }) {
  // Shared submit handler for both insert and edit paths.
  const url = payload.url.trim()
  if (!isValidEmbedUrl(url)) return

  const title = payload.title.trim() || '鍐呭祵缃戦〉'
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

/**
 * Handle onEmbedEditRequest logic.
 * @param event - Parameter.
 */
function onEmbedEditRequest(event: Event) {
  // Bridge custom DOM event from NodeView to Vue dialog flow.
  const customEvent = event as CustomEvent<EmbedEditRequestDetail>
  if (!customEvent.detail) return
  openEmbedEditDialog(customEvent.detail)
}



/**
 * Handle openWhiteboardDialog logic.
 */
function openWhiteboardDialog() {
  // Open insert mode with fresh title/scene.
  whiteboardEditorMode.value = 'insert'
  whiteboardEditTarget.value = null
  whiteboardEditorTitle.value = '鐧芥澘'
  whiteboardEditorScene.value = null
  whiteboardEditorVisible.value = true
}

/**
 * Handle openWhiteboardEditDialog logic.
 * @param detail - Parameter.
 */
function openWhiteboardEditDialog(detail: WhiteboardEditRequestDetail) {
  // Load persisted whiteboard scene before opening editor.
  whiteboardEditorMode.value = 'edit'
  whiteboardEditTarget.value = detail

  const stored = getWhiteboardById(detail.id)
  whiteboardEditorTitle.value = detail.title || stored?.title || '鐧芥澘'
  whiteboardEditorScene.value = stored?.scene ?? null
  whiteboardEditorVisible.value = true
}

/**
 * Handle closeWhiteboardEditor logic.
 */
function closeWhiteboardEditor() {
  // Fully clear editor state so stale payload is not reused next time.
  whiteboardEditorVisible.value = false
  whiteboardEditorMode.value = 'insert'
  whiteboardEditTarget.value = null
  whiteboardEditorTitle.value = '鐧芥澘'
  whiteboardEditorScene.value = null
}

/**
 * Handle applyWhiteboardEdit logic.
 * @param detail - Parameter.
 * @param payload - Parameter.
 */
function applyWhiteboardEdit(detail: WhiteboardEditRequestDetail, payload: WhiteboardSavePayload) {
  // Persist whiteboard record then replace corresponding markdown range.
  if (!crepe) return

  const normalizedTitle = payload.title.trim() || '鐧芥澘'
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

/**
 * Handle saveWhiteboard logic.
 * @param payload - Parameter.
 */
function saveWhiteboard(payload: WhiteboardSavePayload) {
  // Route save operation to edit/insert branch.
  const target = whiteboardEditTarget.value

  if (whiteboardEditorMode.value === 'edit' && target) {
    applyWhiteboardEdit(target, payload)
    closeWhiteboardEditor()
    return
  }

  const id = createWhiteboardId()
  const normalizedTitle = payload.title.trim() || '鐧芥澘'
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

/**
 * Handle onWhiteboardEditRequest logic.
 * @param event - Parameter.
 */
function onWhiteboardEditRequest(event: Event) {
  // Bridge custom DOM event from NodeView to Vue dialog flow.
  const customEvent = event as CustomEvent<WhiteboardEditRequestDetail>
  if (!customEvent.detail) return
  openWhiteboardEditDialog(customEvent.detail)
}


/**
 * Handle openFlowchartDialog logic.
 */
function openFlowchartDialog() {
  // Open insert mode with fresh title/scene.
  flowchartEditorMode.value = 'insert'
  flowchartEditTarget.value = null
  flowchartEditorTitle.value = '流程图'
  flowchartEditorScene.value = null
  flowchartEditorVisible.value = true
}

/**
 * Handle openFlowchartEditDialog logic.
 * @param detail - Parameter.
 */
function openFlowchartEditDialog(detail: FlowchartEditRequestDetail) {
  // Load persisted flowchart scene before opening editor.
  flowchartEditorMode.value = 'edit'
  flowchartEditTarget.value = detail

  const stored = getFlowchartById(detail.id)
  flowchartEditorTitle.value = detail.title || stored?.title || '流程图'
  flowchartEditorScene.value = stored?.scene ?? null
  flowchartEditorVisible.value = true
}

/**
 * Handle closeFlowchartEditor logic.
 */
function closeFlowchartEditor() {
  // Fully clear editor state so stale payload is not reused next time.
  flowchartEditorVisible.value = false
  flowchartEditorMode.value = 'insert'
  flowchartEditTarget.value = null
  flowchartEditorTitle.value = '流程图'
  flowchartEditorScene.value = null
}

/**
 * Handle applyFlowchartEdit logic.
 * @param detail - Parameter.
 * @param payload - Parameter.
 */
function applyFlowchartEdit(detail: FlowchartEditRequestDetail, payload: FlowchartSavePayload) {
  // Persist flowchart record then replace corresponding markdown range.
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

/**
 * Handle saveFlowchart logic.
 * @param payload - Parameter.
 */
function saveFlowchart(payload: FlowchartSavePayload) {
  // Route save operation to edit/insert branch.
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

/**
 * Handle onFlowchartEditRequest logic.
 * @param event - Parameter.
 */
function onFlowchartEditRequest(event: Event) {
  // Bridge custom DOM event from NodeView to Vue dialog flow.
  const customEvent = event as CustomEvent<FlowchartEditRequestDetail>
  if (!customEvent.detail) return
  openFlowchartEditDialog(customEvent.detail)
}



/**
 * Handle openMindmapDialog logic.
 */
function openMindmapDialog() {
  // Open insert mode with fresh title/scene.
  mindmapEditorMode.value = 'insert'
  mindmapEditTarget.value = null
  mindmapEditorTitle.value = '鎬濈淮瀵煎浘'
  mindmapEditorScene.value = null
  mindmapEditorVisible.value = true
}

/**
 * Handle openMindmapEditDialog logic.
 * @param detail - Parameter.
 */
function openMindmapEditDialog(detail: MindmapEditRequestDetail) {
  // Load persisted mindmap scene before opening editor.
  mindmapEditorMode.value = 'edit'
  mindmapEditTarget.value = detail

  const stored = getMindmapById(detail.id)
  mindmapEditorTitle.value = detail.title || stored?.title || '鎬濈淮瀵煎浘'
  mindmapEditorScene.value = stored?.scene ?? null
  mindmapEditorVisible.value = true
}

/**
 * Handle closeMindmapEditor logic.
 */
function closeMindmapEditor() {
  // Fully clear editor state so stale payload is not reused next time.
  mindmapEditorVisible.value = false
  mindmapEditorMode.value = 'insert'
  mindmapEditTarget.value = null
  mindmapEditorTitle.value = '鎬濈淮瀵煎浘'
  mindmapEditorScene.value = null
}

const mindmapTokenPattern = /!\[mindmap:([^\]]*)\]\((mindmap:\/\/[a-zA-Z0-9_-]+)(?:\s+"[^"]*")?\)/g

/**
 * Handle clampMindmapPosition logic.
 * @param value - Parameter.
 * @param maxPos - Parameter.
 * @returns Return value.
 */
function clampMindmapPosition(value: number, maxPos: number): number {
  // Guard against invalid/overflow ranges before applying text replacement.
  if (!Number.isFinite(value)) return 0
  const normalized = Math.floor(value)
  if (normalized < 0) return 0
  if (normalized > maxPos) return maxPos
  return normalized
}

/**
 * Handle resolveMindmapReplaceRange logic.
 * @param state - Parameter.
 * @param target - Parameter.
 */
function resolveMindmapReplaceRange(
  state: EditorView['state'],
  target: { from: number; to: number } | null
): { from: number; to: number } {
  // Build a safe replacement range using target range or current selection fallback.
  const maxPos = state.doc.content.size
  const fallbackFrom = state.selection.from
  const fallbackTo = state.selection.to

  const from = clampMindmapPosition(target?.from ?? fallbackFrom, maxPos)
  const to = clampMindmapPosition(target?.to ?? fallbackTo, maxPos)
  return from <= to ? { from, to } : { from: to, to: from }
}

/**
 * Handle findMindmapDocTarget logic.
 * @param doc - Parameter.
 * @param id - Parameter.
 */
function findMindmapDocTarget(
  doc: import('@milkdown/prose/model').Node,
  id: string
): { kind: 'token' | 'image'; from: number; to: number } | null {
  // Find latest token/image range by id to avoid stale edit ranges.
  let found: { kind: 'token' | 'image'; from: number; to: number } | null = null
  const source = createMindmapSource(id)

  doc.descendants((node, pos, parent) => {
    if (found) return false

    if (node.type.name === 'image' && String(node.attrs.src ?? '') === source) {
      found = {
        kind: 'image',
        from: pos,
        to: pos + node.nodeSize,
      }
      return false
    }

    if (!node.isText || !node.text) return
    if (parent?.type?.spec?.code) return

    mindmapTokenPattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = mindmapTokenPattern.exec(node.text)) !== null) {
      const matchSource = match[2] ?? ''
      if (matchSource !== source) continue

      const from = pos + match.index
      const to = from + match[0].length
      found = { kind: 'token', from, to }
      break
    }
  })

  return found
}

/**
 * Handle applyMindmapEdit logic.
 * @param detail - Parameter.
 * @param payload - Parameter.
 */
function applyMindmapEdit(detail: MindmapEditRequestDetail, payload: MindmapSavePayload) {
  // Persist mindmap record and replace current token range with fresh content.
  if (!crepe) return

  const normalizedTitle = payload.title.trim() || '鎬濈淮瀵煎浘'
  const existing = getMindmapById(detail.id)
  const nextPreview = payload.previewUrl.trim() || existing?.previewUrl || ''
  const record = upsertMindmap({
    id: detail.id,
    title: normalizedTitle,
    previewUrl: nextPreview,
    scene: payload.scene,
  })
  const token = createMindmapToken(normalizedTitle, record.id)

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const currentTarget = findMindmapDocTarget(state.doc, record.id) ?? detail
    const range = resolveMindmapReplaceRange(state, currentTarget)
    let tr = state.tr.insertText(token, range.from, range.to)

    if (!tr.docChanged) {
      tr = tr.setMeta('mindmap-refresh', Date.now())
    }

    view.dispatch(tr)
    view.focus()
  })

  crepe.editor.action(forceUpdate())
}

/**
 * Handle saveMindmap logic.
 * @param payload - Parameter.
 */
function saveMindmap(payload: MindmapSavePayload) {
  // Route save operation to edit/insert branch.
  const target = mindmapEditTarget.value

  if (mindmapEditorMode.value === 'edit' && target) {
    applyMindmapEdit(target, payload)
    closeMindmapEditor()
    return
  }

  const id = createMindmapId()
  const normalizedTitle = payload.title.trim() || '鎬濈淮瀵煎浘'
  upsertMindmap({
    id,
    title: normalizedTitle,
    previewUrl: payload.previewUrl.trim(),
    scene: payload.scene,
  })
  const token = createMindmapToken(normalizedTitle, id)

  if (crepe) {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const tr = state.tr.insertText(`\n${token}\n`, state.selection.from, state.selection.to)
      view.dispatch(tr)
      view.focus()
    })

    crepe.editor.action(forceUpdate())
  }

  closeMindmapEditor()
}

/**
 * Handle onMindmapEditRequest logic.
 * @param event - Parameter.
 */
function onMindmapEditRequest(event: Event) {
  // Bridge custom DOM event from NodeView to Vue dialog flow.
  const customEvent = event as CustomEvent<MindmapEditRequestDetail>
  if (!customEvent.detail) return
  openMindmapEditDialog(customEvent.detail)
}
/**
 * Handle onGlobalKeydown logic.
 * @param event - Parameter.
 */
function onGlobalKeydown(event: KeyboardEvent) {
  // Global keyboard shortcuts: command palette toggle/close.
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault()
    if (paletteVisible.value) closePalette()
    else openPalette()
    return
  }

  if (event.key === 'Escape') {
    if (paletteVisible.value) {
      closePalette()
      return
    }

    if (historyModalOpen.value) {
      closeHistoryModal()
      return
    }

    if (commentDrawerOpen.value) {
      closeCommentDrawer()
    }
  }
}

watch(activeCommentId, () => {
  // Active comment changes should immediately refresh editor highlight.
  updateActiveCommentRange()
})

watch(comments, (items) => {
  // Keep active comment pointer valid when list updates from local/remote edits.
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
    // Feature toggles require full editor rebuild because Crepe features are init-time options.
    void rebuildEditor()
  },
  { deep: true }
)

watch(readonlyMode, (value) => {
  crepe?.setReadonly(value)
})

watch(collabWanted, (value) => {
  // Desired collab state switch; connection state UI updates via provider status event.
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
  // Wire global events + Yjs observers, then create initial editor instance.
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener(EMBED_EDIT_REQUEST_EVENT, onEmbedEditRequest as EventListener)
  window.addEventListener(WHITEBOARD_EDIT_REQUEST_EVENT, onWhiteboardEditRequest as EventListener)
  window.addEventListener(FLOWCHART_EDIT_REQUEST_EVENT, onFlowchartEditRequest as EventListener)
  window.addEventListener(MINDMAP_EDIT_REQUEST_EVENT, onMindmapEditRequest as EventListener)
  window.addEventListener(HISTORY_MODAL_OPEN_EVENT, openHistoryModal as EventListener)
  yComments.observe(syncCommentsFromSharedState)
  ySnapshots.observe(syncSnapshotsFromSharedState)
  provider.awareness?.on('change', refreshCollaborators)
  syncCommentsFromSharedState()
  syncSnapshotsFromSharedState()
  refreshCollaborators()
  await rebuildEditor(initialMarkdown)
})

onBeforeUnmount(() => {
  // Release all listeners/providers/timers to avoid leaks across route changes.
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener(EMBED_EDIT_REQUEST_EVENT, onEmbedEditRequest as EventListener)
  window.removeEventListener(WHITEBOARD_EDIT_REQUEST_EVENT, onWhiteboardEditRequest as EventListener)
  window.removeEventListener(FLOWCHART_EDIT_REQUEST_EVENT, onFlowchartEditRequest as EventListener)
  window.removeEventListener(MINDMAP_EDIT_REQUEST_EVENT, onMindmapEditRequest as EventListener)
  window.removeEventListener(HISTORY_MODAL_OPEN_EVENT, openHistoryModal as EventListener)

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
  <section class="page milk-playground-page" :class="{ 'side-drawer-open': commentDrawerOpen, 'side-drawer-closed': !commentDrawerOpen, 'history-modal-open': historyModalOpen }">
    <header class="editor-hero">
      <div class="editor-last-modified">
        <span class="material-symbols-outlined" aria-hidden="true">calendar_today</span>
        <span>LAST MODIFIED: OCT 24, 2024</span>
      </div>

      <h1 class="editor-title">
        Q4 Content Strategy &
        <span>Global Distribution</span>
      </h1>

      <div class="editor-collab-row">
        <div class="editor-collab-avatars">
          <span
            v-for="item in collaborators.slice(0, 2)"
            :key="item.id"
            class="editor-collab-avatar"
            :style="{ '--avatar-color': item.color }"
            :title="item.name"
          >
            {{ item.name.slice(0, 1).toUpperCase() }}
          </span>
          <span class="editor-collab-avatar count">+{{ Math.max(collaborators.length, 3) }}</span>
        </div>
        <span class="editor-collab-text">Editing now with Sarah and James</span>
      </div>
    </header>

    <div class="toolbar action-bar">
      <button type="button" class="btn" @click="connectCollab">杩炴帴鍗忓悓</button>
      <button type="button" class="btn ghost" @click="disconnectCollab">鏂紑鍗忓悓</button>
      <span class="status" :data-online="status === 'connected'">{{ status }}</span>
      <span class="status collab-count" :data-online="status === 'connected'">{{ collaboratorCountLabel }}</span>
      <button type="button" class="btn ghost" :aria-expanded="markdownPaneVisible" @click="markdownPaneVisible = !markdownPaneVisible">
        {{ markdownPaneVisible ? '闅愯棌 Markdown' : '鏄剧ず Markdown' }}
      </button>
      <button type="button" class="btn ghost" @click="void applyMarkdownFromPane">搴旂敤鍙充晶 Markdown</button>
      <button type="button" class="btn ghost" @click="resetSampleMarkdown">鎭㈠绀轰緥</button>
      <button type="button" class="btn ghost" @click="copyMarkdown">{{ copied ? '已复制' : '复制 Markdown' }}</button>
      <button type="button" class="btn ghost" @click="openPalette">鍔熻兘闈㈡澘 (Ctrl+K)</button>
    </div>

    <div class="floating-markdown-toolbar" aria-label="Formatting toolbar">
      <button type="button" class="floating-tool-btn" title="Bold">
        <span class="material-symbols-outlined">format_bold</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Italic">
        <span class="material-symbols-outlined">format_italic</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Strike">
        <span class="material-symbols-outlined">strikethrough_s</span>
      </button>
      <span class="floating-divider"></span>
      <button type="button" class="floating-tool-btn" title="H1">
        <span class="material-symbols-outlined">format_h1</span>
      </button>
      <button type="button" class="floating-tool-btn" title="H2">
        <span class="material-symbols-outlined">format_h2</span>
      </button>
      <button type="button" class="floating-tool-btn" title="List">
        <span class="material-symbols-outlined">format_list_bulleted</span>
      </button>
      <span class="floating-divider"></span>
      <button type="button" class="floating-tool-btn" title="Checkbox">
        <span class="material-symbols-outlined">check_box</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Code">
        <span class="material-symbols-outlined">code</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Link">
        <span class="material-symbols-outlined">link</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Image">
        <span class="material-symbols-outlined">image</span>
      </button>
      <button type="button" class="floating-tool-btn" title="Quote">
        <span class="material-symbols-outlined">format_quote</span>
      </button>
    </div>

    <div class="milk-workbench editorial-workbench">
      <section class="play-pane play-pane-editor editorial-pane">
        <header class="play-pane-head">
          <h3>Visual Editor</h3>
          <span>{{ activeThemeClass }}</span>
        </header>
        <div class="play-editor-shell" :class="activeThemeClass">
          <div ref="host" class="playground-host"></div>
        </div>
      </section>

      <aside
        class="play-side-panels editorial-comment-drawer"
        :class="{ 'is-open': commentDrawerOpen, 'is-collapsed': !commentDrawerOpen }"
      >
        <CommentPanel
          ref="commentPanelRef"
          :comments="comments"
          :active-comment-id="activeCommentId"
          :comments-collapsed="!commentDrawerOpen"
          :selected-quote="selectedRange?.quote ?? ''"
          :has-selected-range="Boolean(selectedRange)"
          v-model:comment-draft="commentDraft"
          @toggle-collapse="toggleCommentDrawer"
          @submit-comment="submitComment"
          @focus-comment="focusComment"
          @delete-comment="deleteComment"
        />
      </aside>

      <div
        v-if="historyModalOpen"
        class="history-modal-mask"
        role="presentation"
        @click="closeHistoryModal"
      >
        <div
          class="history-modal-shell"
          role="dialog"
          aria-modal="true"
          aria-label="History snapshots"
          @click.stop
        >
          <HistoryPanel
            :snapshots="snapshots"
            :active-snapshot-id="activeSnapshotId"
            :history-collapsed="false"
            v-model:snapshot-label="snapshotLabel"
            @toggle-collapse="closeHistoryModal"
            @create-snapshot="createHistorySnapshot"
            @select-snapshot="void selectHistorySnapshot($event)"
            @restore-snapshot="void restoreHistorySnapshot($event)"
            @delete-snapshot="deleteHistorySnapshot"
          />
        </div>
      </div>

      <section v-if="markdownPaneVisible" class="play-pane play-pane-markdown editorial-pane">
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

    <p class="tip">
      编辑提示：在左侧输入 <code>/</code> 打开块菜单；按 <code>Ctrl+K</code> 打开功能面板；选中正文后可添加评论，历史通过顶部按钮打开弹框。协同房间：<code>{{ room }}</code>，服务地址：<code>{{ wsUrl }}</code>
    </p>
  </section>

  <div v-if="paletteVisible" class="command-menu-mask" @click="closePalette">
    <div class="command-menu" @click.stop>
      <div class="command-menu-title">Milkdown 鍔熻兘闈㈡澘</div>
      <input
        ref="paletteInputRef"
        v-model="paletteQuery"
        class="command-input"
        type="text"
        placeholder="鎼滅储鍔熻兘锛歵heme / collab / table / slash ..."
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
      <p v-if="filteredPaletteActions.length === 0" class="panel-tip">娌℃湁鍖归厤鍔熻兘</p>
    </div>
  </div>

  <EmbedWebDialog
    v-if="embedDialogVisible"
    :mode="embedDialogMode"
    :initial-url="embedDialogMode === 'edit' ? embedEditTarget?.sourceUrl ?? '' : ''"
    :initial-title="embedDialogMode === 'edit' ? embedEditTarget?.title ?? '' : ''"
    @cancel="closeEmbedDialog"
    @confirm="confirmEmbed"
  />

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

  <MindmapSimpleDialog
    v-if="mindmapEditorVisible"
    :mode="mindmapEditorMode"
    :title="mindmapEditorTitle"
    :initial-scene="mindmapEditorScene"
    @cancel="closeMindmapEditor"
    @save="saveMindmap"
  />
</template>


































