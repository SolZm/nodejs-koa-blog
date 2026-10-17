<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, InboxOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import axios from 'axios'
import { MdEditor } from 'md-editor-v3'
import PageHeader from '@/components/PageHeader.vue'
import { create, detail, update } from '@/api/article'
import { list as listCategories } from '@/api/category'
import { getUploadToken } from '@/api/upload'
import { useAuthStore } from '@/stores/auth'
import { findUnclosedCodeFence } from '@/utils/markdown'

const QINIU_UPLOAD_URL = 'https://up-z1.qiniup.com'
const QINIU_IMAGE_BASE = 'https://img.solzm.com/'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref()
const saving = ref(false)
const loading = ref(Boolean(route.query.id))
const categories = ref<any[]>([])
const uploadToken = ref('')
const isEdit = computed(() => Boolean(route.query.id))

const form = reactive({
  id: route.query.id as string | undefined,
  title: '',
  description: '',
  img_url: '',
  seo_keyword: '',
  status: 1,
  sort_order: 1,
  admin_id: '',
  category_id: undefined as number | undefined,
  content: ''
})

const rules = {
  title: [{ required: true, message: '请输入文章标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入文章描述', trigger: 'blur' }],
  img_url: [{ required: true, message: '请上传文章封面', trigger: 'change' }],
  seo_keyword: [{ required: true, message: '请输入 SEO 关键字', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择文章分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入文章正文', trigger: 'blur' }]
}

async function loadCategories() {
  const res = await listCategories()
  categories.value = res.data?.data || []
}

async function loadToken() {
  try {
    const res = await getUploadToken()
    uploadToken.value = res.data.token
  } catch {
    message.warning('图片上传凭证获取失败，正文和封面仍可填写外链')
  }
}

async function loadDetail() {
  if (!isEdit.value) {
    loading.value = false
    return
  }
  try {
    const res = await detail({ id: String(route.query.id), is_markdown: false })
    const data = res.data
    Object.assign(form, {
      id: data.id,
      title: data.title || '',
      description: data.description || '',
      img_url: data.img_url || '',
      seo_keyword: data.seo_keyword || '',
      status: Number(data.status),
      sort_order: data.sort_order ?? 1,
      admin_id: data.admin_id || data.adminInfo?.id || authStore.adminInfo?.id || '',
      category_id: data.category_info?.id || data.category_id,
      content: data.content || ''
    })
  } finally {
    loading.value = false
  }
}

async function uploadToQiniu(file: File) {
  if (!uploadToken.value) throw new Error('请先获取图片上传凭证')
  const data = new FormData()
  data.append('file', file)
  data.append('token', uploadToken.value)
  const res = await axios.post(QINIU_UPLOAD_URL, data)
  if (!res.data?.key) throw new Error(res.data?.error || '图片上传失败')
  return `${QINIU_IMAGE_BASE}${res.data.key}`
}

async function uploadCover(options: any) {
  try {
    const url = await uploadToQiniu(options.file)
    form.img_url = url
    options.onSuccess?.(resData(url))
    message.success('封面上传成功')
  } catch (error: any) {
    options.onError?.(error)
    message.error(error.message || '封面上传失败')
  }
}

function resData(url: string) {
  return { key: url.replace(QINIU_IMAGE_BASE, '') }
}

async function onUploadImg(files: File[], callback: (urls: string[]) => void) {
  try {
    const urls = await Promise.all(files.map(uploadToQiniu))
    callback(urls)
  } catch (error: any) {
    message.error(error.message || '正文图片上传失败')
  }
}

async function submit() {
  if (saving.value) return
  try {
    await formRef.value.validate()
    const unclosedFence = findUnclosedCodeFence(form.content)
    if (unclosedFence) {
      message.error(`第 ${unclosedFence.line} 行的代码块没有闭合，请补上 ${unclosedFence.char.repeat(3)}`)
      return
    }
    saving.value = true
    form.admin_id = authStore.adminInfo?.id ? String(authStore.adminInfo.id) : form.admin_id
    const payload = { ...form, admin_id: Number(form.admin_id) }
    const res = isEdit.value ? await update(payload) : await create(payload)
    message.success(res.msg || (isEdit.value ? '文章更新成功' : '文章创建成功'))
    router.push('/article')
  } catch (error: any) {
    if (!error?.errorFields) message.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.allSettled([loadCategories(), loadToken(), loadDetail()])
})
</script>

<template>
  <div class="page-shell editor-page">
    <PageHeader :title="isEdit ? '编辑文章' : '创建文章'" description="使用 Markdown 编写内容，保存后同步到博客前台。">
      <a-button @click="router.push('/article')"><ArrowLeftOutlined />返回列表</a-button>
      <a-button type="primary" :loading="saving" :disabled="loading" @click="submit"><SaveOutlined />{{ isEdit ? '保存更新' : '发布文章' }}</a-button>
    </PageHeader>

    <a-spin :spinning="loading">
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" :disabled="loading">
        <div class="form-grid">
          <section class="panel form-panel">
            <div class="section-title">
              <span>01</span>
              <div>
                <h2>基础信息</h2>
                <p>用于文章列表与 SEO 展示</p>
              </div>
            </div>

            <a-form-item label="文章标题" name="title">
              <a-input v-model:value="form.title" size="large" placeholder="输入一个清晰的标题" show-count :maxlength="100" />
            </a-form-item>
            <a-form-item label="文章描述" name="description">
              <a-textarea v-model:value="form.description" :rows="3" placeholder="用一两句话概括文章内容" show-count :maxlength="240" />
            </a-form-item>
            <a-form-item label="SEO 关键字" name="seo_keyword">
              <a-input v-model:value="form.seo_keyword" placeholder="例如：Vue3, 前端工程化, UI 设计" />
            </a-form-item>
          </section>

          <section class="panel form-panel">
            <div class="section-title">
              <span>02</span>
              <div>
                <h2>发布设置</h2>
                <p>控制文章归属和展示状态</p>
              </div>
            </div>

            <div class="split-fields">
              <a-form-item label="文章分类" name="category_id">
                <a-select v-model:value="form.category_id" size="large" placeholder="选择分类">
                  <a-select-option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="排序值">
                <a-input-number v-model:value="form.sort_order" size="large" :min="0" style="width: 100%" />
              </a-form-item>
            </div>

            <a-form-item label="展示状态">
              <a-radio-group v-model:value="form.status" button-style="solid">
                <a-radio-button :value="1">正常展示</a-radio-button>
                <a-radio-button :value="0">暂时隐藏</a-radio-button>
              </a-radio-group>
            </a-form-item>

            <a-form-item label="文章封面" name="img_url">
              <a-form-item-rest>
                <a-upload-dragger
                  name="file"
                  :show-upload-list="false"
                  :custom-request="uploadCover"
                  accept="image/*"
                  class="cover-uploader"
                >
                  <div v-if="form.img_url" class="cover-preview">
                    <img :src="form.img_url" alt="文章封面" />
                    <span>点击更换封面</span>
                  </div>
                  <template v-else>
                    <InboxOutlined class="upload-icon" />
                    <p>点击或拖拽图片到此处上传</p>
                    <span>建议尺寸 1200 × 630，支持 JPG / PNG</span>
                  </template>
                </a-upload-dragger>
              </a-form-item-rest>
              <a-input v-model:value="form.img_url" placeholder="也可以直接粘贴图片外链" style="margin-top: 10px" />
            </a-form-item>
          </section>
        </div>

        <section class="panel editor-panel">
          <div class="section-title editor-title">
            <span>03</span>
            <div>
              <h2>文章正文</h2>
              <p>支持 Markdown、代码高亮与图片上传</p>
            </div>
          </div>
          <a-form-item name="content" class="editor-form-item">
            <MdEditor
              v-model="form.content"
              language="zh-CN"
              :toolbars-exclude="['github']"
              :on-upload-img="onUploadImg"
              preview-theme="github"
              style="height: 680px"
            />
          </a-form-item>
        </section>
      </a-form>
    </a-spin>
  </div>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr);
  gap: 16px;
  margin-bottom: 16px;
}

.form-panel,
.editor-panel {
  padding: 22px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.section-title > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #1677ff;
  font-size: 10px;
  font-weight: 800;
  background: rgba(22, 119, 255, 0.08);
  border-radius: 10px;
}

.section-title h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 15px;
}

.section-title p {
  margin: 3px 0 0;
  color: var(--admin-text-secondary);
  font-size: 10px;
}

.split-fields {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.cover-preview {
  position: relative;
  height: 172px;
  overflow: hidden;
  border-radius: 10px;
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-preview span {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 5px 10px;
  color: #fff;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 7px;
  backdrop-filter: blur(8px);
}

.upload-icon {
  color: #1677ff;
  font-size: 28px;
}

.cover-uploader p {
  margin: 9px 0 3px;
  color: var(--admin-text);
  font-size: 12px;
}

.cover-uploader span {
  color: var(--admin-text-secondary);
  font-size: 10px;
}

.editor-panel {
  overflow: hidden;
}

.editor-form-item {
  margin-bottom: 0;
}

.editor-form-item :deep(.ant-form-item-control-input-content) {
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: 12px;
}

.editor-form-item :deep(.md-editor) {
  --md-bk-color: var(--admin-card-solid);
  --md-color: var(--admin-text);
  --md-border-color: var(--admin-border);
  --md-theme-color: #1677ff;
  background: var(--admin-card-solid);
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .split-fields {
    grid-template-columns: 1fr;
  }

  .form-panel,
  .editor-panel {
    padding: 16px;
  }
}
</style>
