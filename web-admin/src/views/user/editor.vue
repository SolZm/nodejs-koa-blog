<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import { updateUser, userInfo } from '@/api/user'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)
const loading = ref(true)
const form = reactive({
  id: route.query.id as string | undefined,
  username: '',
  email: '',
  status: 1
})
const rules = {
  username: [{ required: true, message: '请输入用户昵称', trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: '请输入有效邮箱地址', trigger: 'blur' }]
}

async function loadDetail() {
  try {
    const res = await userInfo({ id: String(route.query.id) })
    Object.assign(form, {
      id: res.data.id,
      username: res.data.username || '',
      email: res.data.email || '',
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
    const res = await updateUser(form)
    message.success(res.msg || '用户信息更新成功')
    router.push('/user')
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
    <PageHeader title="编辑用户" description="更新用户基础资料和账户可用状态。">
      <a-button @click="router.push('/user')"><ArrowLeftOutlined />返回列表</a-button>
      <a-button type="primary" :loading="saving" :disabled="loading" @click="submit"><SaveOutlined />保存更新</a-button>
    </PageHeader>

    <section class="panel editor-card">
      <div class="profile-head">
        <a-avatar :size="52" style="background: linear-gradient(145deg, #1677ff, #6d5dfc)">
          {{ String(form.username || 'U').slice(0, 1).toUpperCase() }}
        </a-avatar>
        <div>
          <h2>{{ form.username || '用户资料' }}</h2>
          <p>用户 ID · {{ form.id }}</p>
        </div>
      </div>
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" :disabled="loading">
        <a-form-item label="用户昵称" name="username">
          <a-input v-model:value="form.username" size="large" />
        </a-form-item>
        <a-form-item label="邮箱地址" name="email">
          <a-input v-model:value="form.email" size="large" />
        </a-form-item>
        <a-form-item label="账户状态">
          <a-radio-group v-model:value="form.status" button-style="solid">
            <a-radio-button :value="1">正常</a-radio-button>
            <a-radio-button :value="0">禁用</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <div class="form-actions">
          <a-button size="large" @click="router.push('/user')">取消</a-button>
          <a-button size="large" type="primary" :loading="saving" :disabled="loading" @click="submit">保存更新</a-button>
        </div>
      </a-form>
    </section>
  </div>
</template>

<style scoped>
.narrow-page {
  max-width: 760px;
}

.editor-card {
  padding: 28px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 15px;
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--admin-border);
}

.profile-head h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 16px;
}

.profile-head p {
  margin: 4px 0 0;
  color: var(--admin-text-secondary);
  font-size: 11px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}
</style>
