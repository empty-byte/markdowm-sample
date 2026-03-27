<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import '@blocksuite/presets/effects'
import { createEmptyDoc } from '@blocksuite/presets'

const host = ref<HTMLDivElement | null>(null)
let pageEditor: (HTMLElement & { doc?: unknown }) | null = null

onMounted(() => {
  if (!host.value) return

  const { init } = createEmptyDoc()
  const doc = init()

  pageEditor = document.createElement('page-editor') as HTMLElement & { doc?: unknown }
  pageEditor.doc = doc
  pageEditor.style.height = '640px'
  pageEditor.style.display = 'block'
  host.value.appendChild(pageEditor)
})

onBeforeUnmount(() => {
  pageEditor?.remove()
  pageEditor = null
})
</script>

<template>
  <section class="page">
    <h1>方案3：BlockSuite（块编辑）</h1>
    <p class="subtitle">形态更接近飞书/Notion 的块结构编辑，适合做完整知识协作工作台。</p>

    <div ref="host" class="editor-shell blocksuite-host"></div>

    <p class="tip">这个页面使用 BlockSuite 的 Web Components，在 Vue3 中以无缝嵌入方式运行。</p>
  </section>
</template>

