<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <RouterLink to="/" class="brand">Vue3 · Milkdown 在线编辑器</RouterLink>
    </header>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
