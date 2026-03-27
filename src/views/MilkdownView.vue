<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { replaceAll } from '@milkdown/utils'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import * as Y from 'yjs'
import '@milkdown/crepe/theme/common/style.css'

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

const featureFlags = ref<Record<CrepeFeature, boolean>>(
  crepeFeatureItems.reduce((acc, item) => {
    acc[item.key] = true
    return acc
  }, {} as Record<CrepeFeature, boolean>)
)

const room = 'demo-milkdown-playground-room'
const wsUrl = import.meta.env.VITE_COLLAB_WS_URL || 'ws://127.0.0.1:1234'
const ydoc = new Y.Doc()
const websocketProvider = new HocuspocusProviderWebsocket({
  url: wsUrl,
  autoConnect: false,
})
const provider = new HocuspocusProvider({
  name: room,
  document: ydoc,
  websocketProvider,
})

provider.on('status', (event: { status: ConnectionStatus }) => {
  status.value = event.status
})

let crepe: Crepe | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncingFromPane = false
let syncingFromEditor = false
let rebuildVersion = 0
let copyTimer: ReturnType<typeof setTimeout> | null = null

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

function getFeatureFlags() {
  return crepeFeatureItems.reduce((acc, item) => {
    acc[item.key] = featureFlags.value[item.key]
    return acc
  }, {} as Partial<Record<CrepeFeature, boolean>>)
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
    },
  })

  instance.editor.use(collab)

  instance.on((listener) => {
    listener.markdownUpdated((_ctx, next) => {
      if (syncingFromPane) return
      syncingFromEditor = true
      markdown.value = next
      syncingFromEditor = false
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

  if (collabWanted.value) provider.connect()
  else provider.disconnect()

  isRebuilding.value = false
}

async function applyMarkdownFromPane() {
  if (!crepe || syncingFromEditor) return

  syncingFromPane = true
  crepe.editor.action(replaceAll(markdown.value, true))
  syncingFromPane = false
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
}

function disconnectCollab() {
  collabWanted.value = false
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
  if (value) provider.connect()
  else provider.disconnect()
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
  await rebuildEditor(initialMarkdown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)

  if (syncTimer) clearTimeout(syncTimer)
  if (copyTimer) clearTimeout(copyTimer)

  provider.destroy()
  websocketProvider.destroy()
  ydoc.destroy()

  void destroyEditor()
})
</script>

<template>
  <section class="page milk-playground-page">
    <h1>方案2：Milkdown Playground（完整能力版）</h1>
    <p class="subtitle">
      对齐官方 Playground 的核心体验：Crepe 可视化编辑、右侧 Markdown 同步、Slash/Toolbar/Block
      编辑、图片表格代码块、主题切换与 Hocuspocus 协同。
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
      <button type="button" class="btn" :disabled="isRebuilding" @click="applyMarkdownFromPane">应用右侧 Markdown</button>
      <button type="button" class="btn" @click="resetSampleMarkdown">恢复示例</button>
      <button type="button" class="btn" @click="copyMarkdown">{{ copied ? '已复制' : '复制 Markdown' }}</button>
      <button type="button" class="btn" @click="connectCollab">连接协同</button>
      <button type="button" class="btn ghost" @click="disconnectCollab">断开协同</button>
      <span class="status" :data-online="status === 'connected'">{{ status }}</span>
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

    <div class="playground-split">
      <section class="play-pane">
        <header class="play-pane-head">
          <h3>Visual Editor</h3>
          <span>{{ activeThemeClass }}</span>
        </header>
        <div class="play-editor-shell" :class="activeThemeClass">
          <div ref="host" class="playground-host"></div>
        </div>
      </section>

      <section class="play-pane">
        <header class="play-pane-head">
          <h3>Markdown</h3>
          <span>{{ markdown.split('\n').length }} 行</span>
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
      编辑提示：在左侧输入 <code>/</code> 打开块菜单，选中文本触发浮动工具栏。协同房间：<code>{{ room }}</code>，服务地址：<code>{{ wsUrl }}</code>
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
            <span class="menu-group">{{ item.group }}</span>
          </div>
          <p>{{ item.description }}</p>
        </li>
      </ul>
      <p v-if="filteredPaletteActions.length === 0" class="panel-tip">没有匹配功能</p>
    </div>
  </div>
</template>

