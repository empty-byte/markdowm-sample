<script setup lang="ts">
import { demoRoutes } from '../router/routes'

const schemeRoutes = demoRoutes.filter((route) => route.path !== '/')
</script>

<template>
  <section class="page">
    <h1>在线文档编辑方案演示</h1>
    <p class="subtitle">每个页面都是一个可独立对比的集成实现，便于你快速选择技术栈。</p>

    <div class="grid">
      <article v-for="route in schemeRoutes" :key="route.path" class="card">
        <h2>{{ route.meta.title }}</h2>
        <p>{{ route.meta.description }}</p>
        <RouterLink :to="route.path" class="btn">查看效果</RouterLink>
      </article>
    </div>

    <p class="tip">
      提示：协同编辑演示默认连接 <code>ws://localhost:1234</code>，如果你还没起 websocket 服务，单机编辑仍可体验。
    </p>
  </section>
</template>

