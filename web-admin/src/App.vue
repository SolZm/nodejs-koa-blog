<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { theme as antTheme } from 'ant-design-vue'

const isDark = ref(localStorage.getItem('solzm-admin-theme') === 'dark')

const themeConfig = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 10,
    colorBgLayout: isDark.value ? '#0f1115' : '#f6f7f9',
    fontFamily: '"Inter", "PingFang SC", "Microsoft YaHei", sans-serif'
  }
}))

function applyTheme() {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
}

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('solzm-admin-theme', isDark.value ? 'dark' : 'light')
  applyTheme()
  window.dispatchEvent(new CustomEvent('solzm-theme-change', { detail: isDark.value }))
}

onMounted(applyTheme)
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="themeConfig">
    <a-app>
      <router-view v-slot="{ Component }">
        <component :is="Component" @toggle-theme="toggleTheme" :is-dark="isDark" />
      </router-view>
    </a-app>
  </a-config-provider>
</template>
