<template>
  <div class="app-layout">
    <nuxt />

    <!--
      「问博客」抽屉改成懒加载。

      它带着 Markdown 渲染等逻辑，但只有用户真的点开才用得上；
      直接挂载会让每个页面的首屏都多下载一份代码。改成动态 import 之后
      它会被拆成独立的 chunk，首屏不再包含它。

      双保险策略：
        - 用户点了但还没加载好 → 立刻加载（保证点了一定能开）
        - 页面空闲时预取一次（正常情况下点开时已经就绪，感觉不到延迟）

      注意：入口按钮在 Header 里，不在这个组件里，所以按钮本身仍是服务端直出的，
      不会因为懒加载而延迟出现。
    -->
    <component :is="askDrawer" v-if="askDrawer" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      askDrawer: null
    }
  },
  mounted() {
    // 用户点开时立刻加载
    this.stopWatchingAsk = this.$watch(
      () => this.$askBlog.visible,
      (visible) => {
        if (visible) this.loadAskDrawer()
      }
    )

    // 空闲时预取，让点击几乎无等待感；不支持 requestIdleCallback 就退化成定时器
    if (typeof window.requestIdleCallback === 'function') {
      this.idleHandle = window.requestIdleCallback(() => this.loadAskDrawer(), { timeout: 4000 })
    } else {
      this.idleTimer = setTimeout(() => this.loadAskDrawer(), 2000)
    }
  },
  beforeDestroy() {
    if (this.stopWatchingAsk) this.stopWatchingAsk()
    if (this.idleHandle && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this.idleHandle)
    }
    if (this.idleTimer) clearTimeout(this.idleTimer)
  },
  methods: {
    loadAskDrawer() {
      if (this.askDrawer) return
      this.askDrawer = () => import('@/components/AskBlog.vue')
    }
  },
}
</script>
