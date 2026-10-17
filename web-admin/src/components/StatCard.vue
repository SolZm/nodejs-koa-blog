<script setup lang="ts">
defineProps<{
  label: string
  value: number | string
  hint?: string
  tone?: 'blue' | 'violet' | 'green' | 'orange'
}>()
</script>

<template>
  <div class="stat-card panel" :class="tone || 'blue'">
    <div class="stat-top">
      <span>{{ label }}</span>
      <div class="stat-icon"><slot name="icon" /></div>
    </div>
    <strong>{{ value }}</strong>
    <p>{{ hint }}</p>
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  min-height: 146px;
  padding: 20px;
  overflow: hidden;
}

.stat-card::after {
  position: absolute;
  right: -24px;
  bottom: -36px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: var(--tone-color);
  content: "";
  opacity: 0.08;
}

.blue { --tone-color: #1677ff; }
.violet { --tone-color: #6d5dfc; }
.green { --tone-color: #16a34a; }
.orange { --tone-color: #f59e0b; }

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--admin-text-secondary);
  font-size: 13px;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: var(--tone-color);
  font-size: 17px;
  background: color-mix(in srgb, var(--tone-color) 10%, transparent);
  border-radius: 10px;
}

strong {
  display: block;
  margin-top: 17px;
  color: var(--admin-text);
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

p {
  margin: 5px 0 0;
  color: var(--admin-text-secondary);
  font-size: 11px;
}
</style>
