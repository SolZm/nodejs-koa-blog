<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <main class="not-found">
    <div class="code">404</div>
    <h1>页面走丢了</h1>
    <p>你访问的页面不存在，或已经被移动。</p>
    <a-button type="primary" size="large" @click="router.push('/dashboard')">返回工作台</a-button>
  </main>
</template>

<style scoped>
.not-found {
  display: grid;
  place-items: center;
  align-content: center;
  min-height: 100vh;
  padding: 30px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 35%, rgba(22, 119, 255, 0.08), transparent 30%),
    var(--admin-bg);
}

.code {
  color: #1677ff;
  font-size: clamp(100px, 20vw, 180px);
  font-weight: 850;
  line-height: 1;
  letter-spacing: -0.08em;
  opacity: 0.16;
}

h1 {
  margin: -26px 0 8px;
  color: var(--admin-text);
  font-size: 26px;
}

p {
  margin: 0 0 24px;
  color: var(--admin-text-secondary);
}
</style>
