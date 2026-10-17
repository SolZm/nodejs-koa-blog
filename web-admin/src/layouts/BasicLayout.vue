<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AppstoreOutlined,
  BgColorsOutlined,
  BulbOutlined,
  CommentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'

defineProps<{ isDark?: boolean }>()
const emit = defineEmits<{ (event: 'toggle-theme'): void }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const collapsed = ref(localStorage.getItem('solzm-sidebar-collapsed') === '1')
const mobileOpen = ref(false)
const isMobile = ref(false)

const selectedKeys = computed(() => {
  if (route.path.startsWith('/article')) return ['/article']
  if (route.path.startsWith('/category')) return ['/category']
  if (route.path.startsWith('/comment')) return ['/comment']
  if (route.path.startsWith('/reply')) return ['/reply']
  if (route.path.startsWith('/user')) return ['/user']
  return ['/dashboard']
})

const breadcrumbs = computed(() => {
  const items = [{ title: '控制台', path: '/dashboard' }]
  if (route.meta.parent) items.push({ title: String(route.meta.parent), path: route.path.split('/').slice(0, 2).join('/') })
  if (route.meta.title && route.path !== '/dashboard') items.push({ title: String(route.meta.title), path: route.path })
  return items
})

function updateViewport() {
  isMobile.value = window.innerWidth < 900
  if (!isMobile.value) mobileOpen.value = false
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileOpen.value = !mobileOpen.value
    return
  }
  collapsed.value = !collapsed.value
  localStorage.setItem('solzm-sidebar-collapsed', collapsed.value ? '1' : '0')
}

function handleMenuClick({ key }: { key: string }) {
  router.push(key)
  mobileOpen.value = false
}

function handleLogout() {
  authStore.logout()
  router.replace('/login')
}

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  if (!authStore.adminInfo) authStore.fetchInfo().catch(() => undefined)
})
</script>

<template>
  <div class="admin-layout" :class="{ collapsed, 'mobile-open': mobileOpen, mobile: isMobile }">
    <div v-if="isMobile && mobileOpen" class="sidebar-mask" @click="mobileOpen = false" />

    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">S</div>
        <div class="brand-copy">
          <strong>Solzm</strong>
          <span>ADMIN CONSOLE</span>
        </div>
      </div>

      <div class="menu-caption">工作空间</div>
      <a-menu
        class="sidebar-menu"
        mode="inline"
        :selected-keys="selectedKeys"
        :inline-collapsed="collapsed && !isMobile"
        @click="handleMenuClick"
      >
        <a-menu-item key="/dashboard">
          <template #icon><AppstoreOutlined /></template>
          工作台
        </a-menu-item>
        <a-menu-item key="/article">
          <template #icon><FileTextOutlined /></template>
          文章管理
        </a-menu-item>
        <a-menu-item key="/category">
          <template #icon><FolderOpenOutlined /></template>
          分类管理
        </a-menu-item>
        <a-menu-item key="/comment">
          <template #icon><CommentOutlined /></template>
          评论管理
        </a-menu-item>
        <a-menu-item key="/reply">
          <template #icon><MessageOutlined /></template>
          回复管理
        </a-menu-item>
        <a-menu-item key="/user">
          <template #icon><UserOutlined /></template>
          用户管理
        </a-menu-item>
      </a-menu>

      <div class="sidebar-footer">
        <div class="status-dot" />
        <div class="sidebar-footer-copy">
          <strong>系统运行正常</strong>
          <span>API · v1</span>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-button" type="button" aria-label="切换菜单" @click="toggleSidebar">
            <MenuUnfoldOutlined v-if="collapsed || isMobile" />
            <MenuFoldOutlined v-else />
          </button>
          <a-breadcrumb class="breadcrumb">
            <a-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="topbar-actions">
          <button class="icon-button" type="button" aria-label="切换主题" @click="emit('toggle-theme')">
            <BgColorsOutlined v-if="!isDark" />
            <BulbOutlined v-else />
          </button>
          <a-dropdown placement="bottomRight">
            <button class="profile-button" type="button">
              <a-avatar :size="32">{{ authStore.displayName.slice(0, 1).toUpperCase() }}</a-avatar>
              <span class="profile-name">{{ authStore.displayName }}</span>
            </button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="profile" disabled>{{ authStore.adminInfo?.email || '管理员账户' }}</a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" danger @click="handleLogout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </header>

      <section class="content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--admin-bg);
  transition: grid-template-columns 0.2s ease;
}

.admin-layout.collapsed {
  grid-template-columns: 80px minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 18px 12px;
  overflow: hidden;
  background: var(--admin-sidebar);
  border-right: 1px solid var(--admin-border);
}

.brand {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 10px;
  margin-bottom: 22px;
  color: var(--admin-text);
  white-space: nowrap;
}

.brand-mark {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #fff;
  font-size: 19px;
  font-weight: 800;
  background: linear-gradient(145deg, #1677ff, #5b4bff);
  box-shadow: 0 8px 22px rgba(22, 119, 255, 0.24);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: 11px;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.brand-copy strong {
  font-size: 16px;
  letter-spacing: -0.01em;
}

.brand-copy span {
  color: var(--admin-text-secondary);
  font-size: 9px;
  letter-spacing: 0.16em;
}

.menu-caption {
  padding: 0 14px;
  margin-bottom: 8px;
  color: var(--admin-text-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  background: transparent;
  border-inline-end: 0 !important;
}

.sidebar-menu :deep(.ant-menu-item) {
  height: 42px;
  margin-block: 4px;
  border-radius: 10px;
  line-height: 42px;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.08);
}

.sidebar-menu :deep(.ant-menu-item .anticon) {
  font-size: 17px;
}

.sidebar-footer {
  display: flex;
  align-items: center;
  min-height: 58px;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  background: var(--admin-hover);
  white-space: nowrap;
}

.status-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.sidebar-footer-copy {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
  transition: opacity 0.15s ease;
}

.sidebar-footer-copy strong {
  font-size: 11px;
}

.sidebar-footer-copy span {
  color: var(--admin-text-secondary);
  font-size: 9px;
}

.collapsed .brand-copy,
.collapsed .menu-caption,
.collapsed .sidebar-footer-copy {
  opacity: 0;
}

.collapsed .brand {
  justify-content: center;
  padding: 0;
}

.collapsed .sidebar-footer {
  justify-content: center;
  padding: 0;
}

.main {
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: color-mix(in srgb, var(--admin-bg) 82%, transparent);
  border-bottom: 1px solid var(--admin-border);
  backdrop-filter: blur(16px);
}

.topbar-left,
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--admin-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.18s ease;
}

.icon-button:hover {
  background: var(--admin-hover);
  border-color: var(--admin-border);
}

.breadcrumb {
  margin-left: 4px;
}

.profile-button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 7px 4px 4px;
  color: var(--admin-text);
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  cursor: pointer;
}

.profile-name {
  max-width: 120px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  padding: 24px;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.sidebar-mask {
  display: none;
}

@media (max-width: 900px) {
  .admin-layout,
  .admin-layout.collapsed {
    display: block;
  }

  .sidebar {
    position: fixed;
    left: 0;
    transform: translateX(-100%);
    width: 248px;
    transition: transform 0.2s ease;
  }

  .mobile-open .sidebar {
    transform: translateX(0);
  }

  .sidebar-mask {
    position: fixed;
    inset: 0;
    z-index: 25;
    display: block;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(2px);
  }

  .topbar {
    padding: 0 16px;
  }

  .content {
    padding: 16px;
  }
}

@media (max-width: 560px) {
  .breadcrumb,
  .profile-name {
    display: none;
  }
}
</style>
