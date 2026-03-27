<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { demoRoutes } from './router/routes'

const navRoutes = demoRoutes.filter((route) => route.path !== '/')
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <RouterLink to="/" class="brand">Vue3 文档编辑器对比</RouterLink>
      <nav class="nav">
        <RouterLink v-for="route in navRoutes" :key="route.path" :to="route.path" class="nav-link">
          {{ route.meta.title }}
        </RouterLink>
      </nav>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

