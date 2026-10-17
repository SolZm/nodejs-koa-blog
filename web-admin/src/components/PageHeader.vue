<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="page-header-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  color: var(--admin-text);
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.03em;
}

p {
  margin: 7px 0 0;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 640px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
