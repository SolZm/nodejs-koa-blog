<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: number | string
  type?: 'content' | 'article'
}>()

const config = computed(() => {
  const status = Number(props.status)
  if (props.type === 'content') {
    return {
      0: { color: 'orange', text: '待审核' },
      1: { color: 'green', text: '已通过' },
      2: { color: 'red', text: '未通过' }
    }[status] || { color: 'default', text: '未知' }
  }
  return status === 1
    ? { color: 'green', text: '正常' }
    : { color: 'default', text: status === 0 ? '隐藏' : '未知' }
})
</script>

<template>
  <a-tag :color="config.color" :bordered="false">{{ config.text }}</a-tag>
</template>
