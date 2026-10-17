<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRightOutlined,
  CommentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  PlusOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import { list as listArticles } from '@/api/article'
import { list as listCategories } from '@/api/category'
import { list as listComments } from '@/api/comment'
import { list as listReplies } from '@/api/reply'
import { getUserList } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(true)
const counts = ref({ article: 0, category: 0, comment: 0, reply: 0, user: 0 })
const recentArticles = ref<any[]>([])
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

async function fetchDashboard() {
  loading.value = true
  const results = await Promise.allSettled([
    listArticles({ page: 1 }),
    listCategories({ page: 1 }),
    listComments({ page: 1, is_user: 1, is_article: 1 }),
    listReplies({ page: 1, is_user: 1, is_article: 1 }),
    getUserList({ page: 1 })
  ])

  const getCount = (index: number) => {
    const item = results[index]
    return item.status === 'fulfilled' ? item.value?.data?.meta?.count || 0 : 0
  }

  counts.value = {
    article: getCount(0),
    category: getCount(1),
    comment: getCount(2),
    reply: getCount(3),
    user: getCount(4)
  }
  recentArticles.value = results[0].status === 'fulfilled' ? results[0].value?.data?.data?.slice(0, 5) || [] : []
  loading.value = false
}

onMounted(fetchDashboard)
</script>

<template>
  <div class="page-shell dashboard">
    <PageHeader :title="`${greeting}，${authStore.displayName}`" description="这里是内容平台今天的整体状态。">
      <a-button @click="fetchDashboard" :loading="loading">刷新数据</a-button>
      <a-button type="primary" @click="router.push('/article/create')">
        <PlusOutlined />
        新建文章
      </a-button>
    </PageHeader>

    <a-spin :spinning="loading">
      <div class="stats-grid">
        <StatCard label="文章总数" :value="counts.article" hint="内容资产" tone="blue">
          <template #icon><FileTextOutlined /></template>
        </StatCard>
        <StatCard label="分类总数" :value="counts.category" hint="内容分类" tone="violet">
          <template #icon><FolderOpenOutlined /></template>
        </StatCard>
        <StatCard label="评论待处理" :value="counts.comment" hint="全部评论记录" tone="orange">
          <template #icon><CommentOutlined /></template>
        </StatCard>
        <StatCard label="注册用户" :value="counts.user" hint="平台用户规模" tone="green">
          <template #icon><UserOutlined /></template>
        </StatCard>
      </div>

      <div class="dashboard-grid">
        <section class="panel recent-panel">
          <div class="panel-heading">
            <div>
              <h2>最近文章</h2>
              <p>最近创建或更新的内容</p>
            </div>
            <a-button type="text" @click="router.push('/article')">
              查看全部
              <ArrowRightOutlined />
            </a-button>
          </div>

          <div v-if="recentArticles.length" class="article-list">
            <button v-for="article in recentArticles" :key="article.id" class="article-item" @click="router.push(`/article/edit?id=${article.id}`)">
              <div class="article-cover">
                <img v-if="article.img_url" :src="article.img_url" :alt="article.title" />
                <FileTextOutlined v-else />
              </div>
              <div class="article-copy">
                <strong>{{ article.title }}</strong>
                <span>{{ article.description || '暂无描述' }}</span>
              </div>
              <a-tag :color="article.status === 1 ? 'green' : 'default'" :bordered="false">
                {{ article.status === 1 ? '展示中' : '已隐藏' }}
              </a-tag>
            </button>
          </div>
          <a-empty v-else description="暂无文章数据" />
        </section>

        <section class="panel quick-panel">
          <div class="panel-heading">
            <div>
              <h2>快捷入口</h2>
              <p>常用管理操作</p>
            </div>
          </div>

          <div class="quick-grid">
            <button @click="router.push('/article/create')">
              <FileTextOutlined />
              <span>创建文章</span>
            </button>
            <button @click="router.push('/category/create')">
              <FolderOpenOutlined />
              <span>新增分类</span>
            </button>
            <button @click="router.push('/comment')">
              <CommentOutlined />
              <span>审核评论</span>
            </button>
            <button @click="router.push('/reply')">
              <MessageOutlined />
              <span>审核回复</span>
            </button>
          </div>

          <div class="activity-card">
            <div class="activity-icon"><MessageOutlined /></div>
            <div>
              <strong>共 {{ counts.reply }} 条回复</strong>
              <span>及时处理互动，让社区保持活跃</span>
            </div>
          </div>
        </section>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.75fr);
  gap: 16px;
  margin-top: 16px;
}

.recent-panel,
.quick-panel {
  padding: 22px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.panel-heading h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 16px;
  font-weight: 700;
}

.panel-heading p {
  margin: 5px 0 0;
  color: var(--admin-text-secondary);
  font-size: 11px;
}

.article-list {
  display: flex;
  flex-direction: column;
}

.article-item {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 12px 0;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--admin-border);
  cursor: pointer;
}

.article-item:last-child {
  border-bottom: 0;
}

.article-cover {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  color: #1677ff;
  background: color-mix(in srgb, #1677ff 9%, transparent);
  border-radius: 10px;
}

.article-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.article-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.article-copy strong,
.article-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-copy strong {
  color: var(--admin-text);
  font-size: 13px;
}

.article-copy span {
  color: var(--admin-text-secondary);
  font-size: 11px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.quick-grid button {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
  min-height: 92px;
  color: var(--admin-text);
  font-size: 12px;
  background: var(--admin-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: 0.18s ease;
}

.quick-grid button:hover {
  color: #1677ff;
  border-color: rgba(22, 119, 255, 0.2);
  transform: translateY(-1px);
}

.quick-grid :deep(.anticon) {
  font-size: 20px;
}

.activity-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  margin-top: 14px;
  border: 1px solid rgba(109, 93, 252, 0.13);
  border-radius: 12px;
  background: rgba(109, 93, 252, 0.06);
}

.activity-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: #6d5dfc;
  background: rgba(109, 93, 252, 0.1);
  border-radius: 10px;
}

.activity-card > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.activity-card strong {
  color: var(--admin-text);
  font-size: 12px;
}

.activity-card span {
  color: var(--admin-text-secondary);
  font-size: 10px;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
