<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { list, remove } from '@/api/article'
import { list as listCategories } from '@/api/category'

const router = useRouter()
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const categories = ref<any[]>([])
const searchForm = reactive({
  id: '',
  title: '',
  status: undefined as number | undefined,
  category_id: undefined as number | undefined,
  page: 1
})

const columns = [
  { title: '文章', dataIndex: 'title', key: 'title', width: 320 },
  { title: '分类', key: 'category', width: 120 },
  { title: '作者', key: 'author', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 80 },
  { title: '创建时间', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 160, fixed: 'right' }
]

async function fetchCategories() {
  try {
    const res = await listCategories()
    categories.value = res.data?.data || []
  } catch {
    categories.value = []
  }
}

async function fetchData() {
  loading.value = true
  try {
    const res = await list({ ...searchForm })
    rows.value = res.data?.data || []
    total.value = res.data?.meta?.count || 0
  } finally {
    loading.value = false
  }
}

function searchData() {
  searchForm.page = 1
  fetchData()
}

function resetSearch() {
  Object.assign(searchForm, {
    id: '',
    title: '',
    status: undefined,
    category_id: undefined,
    page: 1
  })
  fetchData()
}

function handleDelete(id: number) {
  Modal.confirm({
    title: '删除文章',
    content: '删除后无法恢复，确定继续吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const res = await remove(id)
      message.success(res.msg || '删除成功')
      if (rows.value.length === 1 && searchForm.page > 1) searchForm.page -= 1
      await fetchData()
    }
  })
}

function formatDate(value: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
}

onMounted(() => {
  fetchCategories()
  fetchData()
})
</script>

<template>
  <div class="page-shell">
    <PageHeader title="文章管理" description="管理所有内容、发布状态与分类归属。">
      <a-button type="primary" @click="router.push('/article/create')">
        <PlusOutlined />
        新建文章
      </a-button>
    </PageHeader>

    <section class="panel search-panel">
      <a-form layout="inline" :model="searchForm">
        <a-form-item label="文章 ID">
          <a-input v-model:value="searchForm.id" placeholder="例如 1024" allow-clear style="width: 130px" />
        </a-form-item>
        <a-form-item label="标题">
          <a-input v-model:value="searchForm.title" placeholder="输入文章标题" allow-clear style="width: 190px" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select v-model:value="searchForm.category_id" placeholder="全部分类" allow-clear style="width: 150px">
            <a-select-option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="searchForm.status" placeholder="全部状态" allow-clear style="width: 130px">
            <a-select-option :value="1">正常</a-select-option>
            <a-select-option :value="0">隐藏</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="searchData"><SearchOutlined />查询</a-button>
            <a-button @click="resetSearch"><ReloadOutlined />重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </section>

    <section class="panel content-panel">
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1180 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="article-cell">
              <a-avatar shape="square" :size="42" :src="record.img_url">
                {{ String(record.title || '文').slice(0, 1) }}
              </a-avatar>
              <div>
                <strong>{{ record.title }}</strong>
                <span>{{ record.description || '暂无文章描述' }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'category'">
            <a-tag :bordered="false">{{ record.category_info?.name || '-' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'author'">
            {{ record.admin_info?.nickname || '-' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
          <template v-else-if="column.key === 'created_at'">
            <span class="text-secondary">{{ formatDate(record.created_at) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="table-actions">
              <a-button type="text" size="small" @click="router.push(`/article/edit?id=${record.id}`)">
                <EditOutlined />编辑
              </a-button>
              <a-button type="text" danger size="small" @click="handleDelete(record.id)">
                <DeleteOutlined />删除
              </a-button>
            </div>
          </template>
        </template>
      </a-table>

      <div class="pagination-row">
        <a-pagination
          v-model:current="searchForm.page"
          :total="total"
          :show-size-changer="false"
          show-less-items
          @change="fetchData"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.article-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.article-cell > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.article-cell strong,
.article-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-cell strong {
  color: var(--admin-text);
  font-size: 13px;
}

.article-cell span {
  max-width: 250px;
  color: var(--admin-text-secondary);
  font-size: 11px;
}
</style>
