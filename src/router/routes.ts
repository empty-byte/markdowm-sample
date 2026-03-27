import type { RouteRecordRaw } from 'vue-router'

export interface DemoRoute {
  path: string
  name: string
  component: RouteRecordRaw['component']
  meta: {
    title: string
    description: string
  }
}

export const demoRoutes: DemoRoute[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: {
      title: '方案总览',
      description: '对比三个可集成到 Vue3 的在线文档编辑方案',
    },
  },
  {
    path: '/tiptap',
    name: 'tiptap',
    component: () => import('../views/TiptapView.vue'),
    meta: {
      title: '方案1 · Tiptap + Yjs',
      description: '头部可定制能力强，协同编辑生态成熟，最适合飞书风格定制',
    },
  },
  {
    path: '/milkdown',
    name: 'milkdown',
    component: () => import('../views/MilkdownView.vue'),
    meta: {
      title: '方案2 · Milkdown + Yjs',
      description: 'Markdown 语义优先，支持协同，适合文档场景快速落地',
    },
  },
  {
    path: '/blocksuite',
    name: 'blocksuite',
    component: () => import('../views/BlocksuiteView.vue'),
    meta: {
      title: '方案3 · BlockSuite',
      description: '块编辑体验更接近飞书/Notion，天然面向协作内容系统',
    },
  },
]

export const vueRoutes = demoRoutes as unknown as RouteRecordRaw[]


