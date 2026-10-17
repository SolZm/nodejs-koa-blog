<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import { create, detail, update } from '@/api/category'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)
const isEdit = computed(() => Boolean(route.query.id))
const loading = ref(isEdit.value)
const form = reactive({
  id: route.query.id as string | undefined,
  name: '',
  sort_order: 1,
  status: 1
})
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
}

async function loadDetail() {
  if (!isEdit.value) {
    loading.value = false
    return
  }
  try {
    const res = await detail({ id: String(route.query.id) })
    Object.assign(form, {
      id: res.data.id,
      name: res.data.name,
      sort_order: Number(res.data.sort_order || 1),
      status: Number(res.data.status)
    })
  } finally {
    loading.value = false
  }
}

async function submit() {
  try {
    await formRef.value.validate()
    saving.value = true
    const res = isEdit.value ? await update(form) : await create(form)
    message.success(res.msg || (isEdit.value ? '分类更新成功' : '分类创建成功'))
    router.push('/category')
  } catch (error: any) {
    if (!error?.errorFields) message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="page-shell narrow-page">
    <PageHeader :title="isEdit ? '编辑分类' : '新增分类'" description="分类用于组织文章，并影响前台导航展示。">
      <a-button @click="router.push('/category')"><ArrowLeftOutlined />返回列表</a-button>
      <a-button type="primary" :loading="saving" :disabled="loading" @click="submit"><SaveOutlined />保存</a-button>
    </PageHeader>

    <section class="panel editor-card">
      <div class="card-intro">
        <div class="intro-mark">C</div>
        <div>
          <h2>分类信息</h2>
          <p>建议使用简短、易识别的分类名称。</p>
        </div>
      </div>
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" :disabled="loading">
        <a-form-item label="分类名称" name="name">
          <a-input v-model:value="form.name" size="large" placeholder="例如：前端开发" />
        </a-form-item>
        <div class="two-columns">
          <a-form-item label="排序值">
            <a-input-number v-model:value="form.sort_order" size="large" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="展示状态">
            <a-radio-group v-model:value="form.status" button-style="solid" style="width: 100%">
              <a-radio-button :value="1">正常</a-radio-button>
              <a-radio-button :value="0">隐藏</a-radio-button>
            </a-radio-group>
          </a-form-item>
        </div>
        <div class="form-actions">
          <a-button size="large" @click="router.push('/category')">取消</a-button>
          <a-button size="large" type="primary" :loading="saving" :disabled="loading" @click="submit">保存分类</a-button>
        </div>
      </a-form>
    </section>
  </div>
</template>

<style scoped>
.narrow-page {
  max-width: 820px;
}

.editor-card {
  padding: 28px;
}

.card-intro {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--admin-border);
}

.intro-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: #1677ff;
  font-weight: 800;
  background: rgba(22, 119, 255, 0.08);
  border-radius: 12px;
}

.card-intro h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 16px;
}

.card-intro p {
  margin: 4px 0 0;
  color: var(--admin-text-secondary);
  font-size: 11px;
}

.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

@media (max-width: 560px) {
  .two-columns {
    grid-template-columns: 1fr;
  }
}
</style>
