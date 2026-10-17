<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import PageHeader from './PageHeader.vue'
import StatusTag from './StatusTag.vue'
import * as commentApi from '@/api/comment'
import * as replyApi from '@/api/reply'

const props = defineProps<{ kind: 'comment' | 'reply' }>()
const md = new MarkdownIt({ linkify: true, breaks: true })
const api = computed(() => (props.kind === 'comment' ? commentApi : replyApi))
const title = computed(() => (props.kind === 'comment' ? '评论管理' : '回复管理'))
const description = computed(() =>
  props.kind === 'comment'
    ? '审核、编辑和维护博客文章下的评论。'
    : '审核、编辑和维护评论下的回复内容。'
)

const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const editOpen = ref(false)
const editing = reactive({ id: 0, content: '', status: 0 })
const searchForm = reactive({
  id: '',
  article_id: '',
  content: '',
  status: undefined as number | undefined,
  page: 1,
  is_user: 1,
  is_article: 1
})
const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 72 },
  { title: '内容', key: 'content', width: 390 },
  { title: '用户', key: 'user', width: 130 },
  { title: '关联文章', key: 'article', width: 220 },
  { title: '状态', key: 'status', width: 105 },
  { title: '操作', key: 'action', width: 260, fixed: 'right' }
]

function articleTitle(record: any) {
  if (props.kind === 'reply') {
    if (Array.isArray(record.article)) return record.article[0]?.title || '-'
    return record.article?.title || '-'
  }
  return record.article?.title || '-'
}

function articleId(record: any) {
  if (props.kind === 'reply') {
    if (Array.isArray(record.article)) return record.article[0]?.id || record.article_id || '-'
    return record.article?.id || record.article_id || '-'
  }
  return record.article?.id || record.article_id || '-'
}

function renderMarkdown(value = '') {
  return md.render(value)
}

async function fetchData() {
  loading.value = true
  try {
    const res = await api.value.list({ ...searchForm })
    rows.value = res.data?.data || []
    total.value = res.data?.meta?.count || 0
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  Object.assign(searchForm, {
    id: '',
    article_id: '',
    content: '',
    status: undefined,
    page: 1,
    is_user: 1,
    is_article: 1
  })
  fetchData()
}

async function changeStatus(record: any, status: number) {
  const res = await api.value.update({ id: record.id, status })
  message.success(res.msg || '审核状态已更新')
  await fetchData()
}

function openEdit(record: any) {
  Object.assign(editing, {
    id: record.id,
    content: record.content || '',
    status: Number(record.status)
  })
  editOpen.value = true
}

async function saveEdit() {
  const res = await api.value.update({ ...editing })
  message.success(res.msg || '内容更新成功')
  editOpen.value = false
  await fetchData()
}

function handleDelete(record: any) {
  Modal.confirm({
    title: `删除${props.kind === 'comment' ? '评论' : '回复'}`,
    content: '删除后无法恢复，确定继续吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const res = await api.value.remove(record.id)
      message.success(res.msg || '删除成功')
      await fetchData()
    }
  })
}

onMounted(fetchData)
</script>

<template>
  <div class="page-shell">
    <PageHeader :title="title" :description="description" />

    <section class="panel search-panel">
      <a-form layout="inline" :model="searchForm">
        <a-form-item :label="kind === 'comment' ? '评论 ID' : '回复 ID'">
          <a-input v-model:value="searchForm.id" placeholder="内容 ID" allow-clear style="width: 120px" />
        </a-form-item>
        <a-form-item label="文章 ID">
          <a-input v-model:value="searchForm.article_id" placeholder="文章 ID" allow-clear style="width: 120px" />
        </a-form-item>
        <a-form-item label="内容">
          <a-input v-model:value="searchForm.content" placeholder="搜索内容" allow-clear style="width: 180px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="searchForm.status" placeholder="全部状态" allow-clear style="width: 135px">
            <a-select-option :value="0">待审核</a-select-option>
            <a-select-option :value="1">已通过</a-select-option>
            <a-select-option :value="2">未通过</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="searchForm.page = 1; fetchData()"><SearchOutlined />查询</a-button>
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
        :scroll="{ x: 1170 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'content'">
            <div class="markdown-body content-preview" v-html="renderMarkdown(record.content)" />
          </template>
          <template v-else-if="column.key === 'user'">
            <div class="user-chip">
              <a-avatar :size="26">{{ String(record.user_info || '匿').slice(0, 1) }}</a-avatar>
              <span>{{ record.user_info || '匿名用户' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'article'">
            <div class="article-link">
              <span>#{{ articleId(record) }}</span>
              <strong>{{ articleTitle(record) }}</strong>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <StatusTag :status="record.status" type="content" />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="table-actions">
              <a-tooltip title="审核通过">
                <a-button type="text" size="small" :disabled="Number(record.status) === 1" @click="changeStatus(record, 1)"><CheckOutlined /></a-button>
              </a-tooltip>
              <a-tooltip title="审核不通过">
                <a-button type="text" danger size="small" :disabled="Number(record.status) === 2" @click="changeStatus(record, 2)"><CloseOutlined /></a-button>
              </a-tooltip>
              <a-button type="text" size="small" @click="openEdit(record)"><EditOutlined />编辑</a-button>
              <a-button type="text" danger size="small" @click="handleDelete(record)"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
      <div class="pagination-row">
        <a-pagination v-model:current="searchForm.page" :total="total" :show-size-changer="false" @change="fetchData" />
      </div>
    </section>

    <a-modal v-model:open="editOpen" :title="kind === 'comment' ? '编辑评论' : '编辑回复'" ok-text="保存" cancel-text="取消" @ok="saveEdit">
      <a-form layout="vertical" style="margin-top: 18px">
        <a-form-item label="内容">
          <a-textarea v-model:value="editing.content" :rows="7" />
        </a-form-item>
        <a-form-item label="审核状态">
          <a-radio-group v-model:value="editing.status">
            <a-radio :value="0">待审核</a-radio>
            <a-radio :value="1">通过</a-radio>
            <a-radio :value="2">不通过</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.content-preview {
  max-height: 100px;
  overflow: hidden;
  color: var(--admin-text);
  font-size: 12px;
  line-height: 1.55;
}

.content-preview :deep(p) {
  margin: 0;
}

.content-preview :deep(pre) {
  padding: 8px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

.article-link {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 200px;
}

.article-link span {
  color: #1677ff;
  font-size: 10px;
}

.article-link strong {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
