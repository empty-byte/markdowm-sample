import { createRouter, createWebHistory } from 'vue-router'
import { vueRoutes } from './routes'

const router = createRouter({
  history: createWebHistory(),
  routes: vueRoutes,
})

export default router

