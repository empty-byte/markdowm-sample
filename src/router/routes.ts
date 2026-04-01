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
    name: 'milkdown',
    component: () => import('../views/MilkdownView.vue'),
    meta: {
      title: 'Milkdown + Yjs + Hocuspocus',
      description: '基于 Milkdown Playground 风格的在线文档编辑方案',
    },
  },
]

export const vueRoutes = demoRoutes as unknown as RouteRecordRaw[]
