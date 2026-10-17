<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { list, remove } from '@/api/category'

const router = useRouter()
const loading = ref(false)
const rows = ref<any[]>([])
const searchForm = reactive({
  id: '',
  name: '',
  status: undefined as number | undefined,
  page: 1
})

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
  { title: '分类名称', dataIndex: 'name', key: 'name' },
  { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 100 },
  { title: '状态', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 170, fixed: 'right' }
]

async function fetchData() {
  loading.value = true
  try {
    const res = await list({ ...searchForm })
    rows.value = res.data?.data || []
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  Object.assign(searchForm, { id: '', name: '', status: undefined, page: 1 })
  fetchData()
}

function handleDelete(id: number) {
  Modal.confirm({
    title: '删除分类',
    content: '该分类下的文章不会自动删除，但可能失去分类归属。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const res = await remove(id)
      message.success(res.msg || '删除成功')
      await fetchData()
    }
  })
}

onMounted(fetchData)
</script>

<template>
  <div class="page-shell">
    <PageHeader title="分类管理" description="维护文章分类、展示顺序与可见状态。">
      <a-button type="primary" @click="router.push('/category/create')"><PlusOutlined />新增分类</a-button>
    </PageHeader>

    <section class="panel search-panel">
      <a-form layout="inline" :model="searchForm">
        <a-form-item label="分类 ID">
          <a-input v-model:value="searchForm.id" placeholder="分类 ID" allow-clear style="width: 130px" />
        </a-form-item>
        <a-form-item label="名称">
          <a-input v-model:value="searchForm.name" placeholder="分类名称" allow-clear style="width: 190px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="searchForm.status" placeholder="全部状态" allow-clear style="width: 130px">
            <a-select-option :value="1">正常</a-select-option>
            <a-select-option :value="0">隐藏</a-select-option>
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
      <a-table :columns="columns" :data-source="rows" :loading="loading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <strong>{{ record.name }}</strong>
          </template>
          <template v-else-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="table-actions">
              <a-button type="text" size="small" @click="router.push(`/category/edit?id=${record.id}`)"><EditOutlined />编辑</a-button>
              <a-button type="text" danger size="small" @click="handleDelete(record.id)"><DeleteOutlined />删除</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>
