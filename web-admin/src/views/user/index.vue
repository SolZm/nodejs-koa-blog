<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DeleteOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { deleteUser, getUserList } from '@/api/user'

const router = useRouter()
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref(0)
const searchForm = reactive({
  id: '',
  username: '',
  status: undefined as number | undefined,
  page: 1
})
const columns = [
  { title: '用户', key: 'user', width: 260 },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '状态', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 170, fixed: 'right' }
]

async function fetchData() {
  loading.value = true
  try {
    const res = await getUserList({ ...searchForm })
    rows.value = res.data?.data || []
    total.value = res.data?.meta?.count || 0
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  Object.assign(searchForm, { id: '', username: '', status: undefined, page: 1 })
  fetchData()
}

function handleDelete(id: number) {
  Modal.confirm({
    title: '删除用户',
    content: '确定删除该用户吗？该操作不可撤销。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const res = await deleteUser(id)
      message.success(res.msg || '删除成功')
      await fetchData()
    }
  })
}

onMounted(fetchData)
</script>

<template>
  <div class="page-shell">
    <PageHeader title="用户管理" description="查看注册用户，管理账户状态与基础资料。" />

    <section class="panel search-panel">
      <a-form layout="inline" :model="searchForm">
        <a-form-item label="用户 ID">
          <a-input v-model:value="searchForm.id" placeholder="用户 ID" allow-clear style="width: 130px" />
        </a-form-item>
        <a-form-item label="用户名称">
          <a-input v-model:value="searchForm.username" placeholder="输入用户名" allow-clear style="width: 190px" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="searchForm.status" placeholder="全部状态" allow-clear style="width: 130px">
            <a-select-option :value="1">正常</a-select-option>
            <a-select-option :value="0">禁用</a-select-option>
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
          <template v-if="column.key === 'user'">
            <div class="user-cell">
              <a-avatar :size="38" style="background: linear-gradient(145deg, #1677ff, #6d5dfc)">
                {{ String(record.username || 'U').slice(0, 1).toUpperCase() }}
              </a-avatar>
              <div>
                <strong>{{ record.username }}</strong>
                <span>ID · {{ record.id }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <StatusTag :status="record.status" />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="table-actions">
              <a-button type="text" size="small" @click="router.push(`/user/edit?id=${record.id}`)"><EditOutlined />编辑</a-button>
              <a-button type="text" danger size="small" @click="handleDelete(record.id)"><DeleteOutlined />删除</a-button>
            </div>
          </template>
        </template>
      </a-table>
      <div class="pagination-row">
        <a-pagination v-model:current="searchForm.page" :total="total" :show-size-changer="false" @change="fetchData" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 11px;
}

.user-cell > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-cell strong {
  color: var(--admin-text);
  font-size: 13px;
}

.user-cell span {
  color: var(--admin-text-secondary);
  font-size: 10px;
}
</style>
