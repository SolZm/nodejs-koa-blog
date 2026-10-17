<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LockOutlined, MailOutlined, ArrowRightOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref()
const loading = ref(false)
const form = reactive({ email: '', password: '' })

const rules = {
  email: [
    { required: true, message: '请输入管理员邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入登录密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
}

async function handleLogin() {
  if (loading.value) return
  try {
    await formRef.value.validate()
    loading.value = true
    await authStore.login(form)
    message.success('登录成功')
    await router.replace(String(route.query.redirect || '/dashboard'))
  } catch (error: any) {
    if (error?.errorFields) return
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="brand-panel">
      <div class="ambient ambient-a" />
      <div class="ambient ambient-b" />
      <div class="grid-lines" />

      <div class="brand">
        <div class="brand-mark">S</div>
        <div>
          <strong>Solzm</strong>
          <span>ADMIN CONSOLE</span>
        </div>
      </div>

      <div class="hero-copy">
        <div class="eyebrow"><span /> Vben Design System</div>
        <h1>更专注的<br />内容管理工作台</h1>
        <p>文章、分类、评论与用户，一套清晰、克制、高效的管理体验。</p>
      </div>

      <div class="preview-card">
        <div class="preview-bar">
          <span />
          <span />
          <span />
        </div>
        <div class="preview-content">
          <div class="preview-menu">
            <i class="active" />
            <i />
            <i />
            <i />
          </div>
          <div class="preview-main">
            <div class="preview-title" />
            <div class="preview-stats">
              <i />
              <i />
              <i />
            </div>
            <div class="preview-list">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="mobile-brand">
          <div class="brand-mark">S</div>
          <strong>Solzm Admin</strong>
        </div>
        <div class="login-heading">
          <span>WELCOME BACK</span>
          <h2>登录管理后台</h2>
          <p>使用管理员账户继续访问控制台</p>
        </div>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="handleLogin">
          <a-form-item label="邮箱地址" name="email">
            <a-input v-model:value="form.email" size="large" placeholder="admin@example.com" autocomplete="username">
              <template #prefix><MailOutlined class="field-icon" /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="登录密码" name="password">
            <a-input-password
              v-model:value="form.password"
              size="large"
              placeholder="请输入密码"
              autocomplete="current-password"
              @press-enter="handleLogin"
            >
              <template #prefix><LockOutlined class="field-icon" /></template>
            </a-input-password>
          </a-form-item>

          <a-button class="login-button" type="primary" size="large" html-type="submit" :loading="loading" block>
            进入控制台
            <ArrowRightOutlined />
          </a-button>
        </a-form>

        <p class="login-footnote">Solzm Content Platform · Secure Admin Access</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  min-height: 100vh;
  background: #f6f7f9;
}

.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 42px 56px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 18% 15%, rgba(76, 138, 255, 0.38), transparent 28%),
    radial-gradient(circle at 85% 78%, rgba(113, 80, 255, 0.3), transparent 30%),
    linear-gradient(145deg, #0d1424, #111a31 58%, #0c1220);
}

.ambient {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
}

.ambient-a {
  top: -110px;
  right: -90px;
  width: 360px;
  height: 360px;
  background: rgba(79, 135, 255, 0.13);
}

.ambient-b {
  bottom: -160px;
  left: -80px;
  width: 420px;
  height: 420px;
  background: rgba(124, 87, 255, 0.12);
}

.grid-lines {
  position: absolute;
  inset: 0;
  opacity: 0.13;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: linear-gradient(to bottom, black, transparent 85%);
}

.brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(145deg, #2f8bff, #6757fa);
  box-shadow: 0 10px 30px rgba(61, 123, 255, 0.34);
}

.brand > div:last-child {
  display: flex;
  flex-direction: column;
}

.brand strong {
  font-size: 17px;
}

.brand span {
  color: rgba(255, 255, 255, 0.45);
  font-size: 9px;
  letter-spacing: 0.17em;
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: 580px;
  margin-top: auto;
  margin-bottom: auto;
  padding: 72px 0 36px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #8eb9ff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.eyebrow span {
  width: 22px;
  height: 1px;
  background: #5e9cff;
}

.hero-copy h1 {
  margin: 25px 0 20px;
  font-size: clamp(42px, 4.2vw, 68px);
  font-weight: 720;
  line-height: 1.08;
  letter-spacing: -0.055em;
}

.hero-copy p {
  max-width: 440px;
  margin: 0;
  color: rgba(221, 231, 255, 0.62);
  font-size: 15px;
  line-height: 1.75;
}

.preview-card {
  position: relative;
  z-index: 2;
  width: min(500px, 78%);
  padding: 10px;
  margin-top: 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
  transform: perspective(900px) rotateX(2deg) rotateY(-3deg);
}

.preview-bar {
  display: flex;
  gap: 5px;
  padding: 2px 3px 10px;
}

.preview-bar span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.preview-content {
  display: grid;
  grid-template-columns: 76px 1fr;
  min-height: 152px;
  overflow: hidden;
  border-radius: 11px;
  background: rgba(11, 16, 28, 0.62);
}

.preview-menu {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 18px 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
}

.preview-menu i {
  width: 46px;
  height: 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.09);
}

.preview-menu i.active {
  background: rgba(66, 135, 255, 0.7);
}

.preview-main {
  padding: 20px;
}

.preview-title {
  width: 38%;
  height: 11px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.35);
}

.preview-stats {
  display: flex;
  gap: 9px;
  margin-top: 18px;
}

.preview-stats i {
  flex: 1;
  height: 55px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 13px;
}

.preview-list span {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
}

.preview-list span:nth-child(2) {
  width: 82%;
}

.preview-list span:nth-child(3) {
  width: 91%;
}

.login-panel {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 40px;
}

.login-card {
  width: min(390px, 100%);
}

.mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 36px;
}

.login-heading > span {
  color: #1677ff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.login-heading h2 {
  margin: 10px 0 8px;
  color: #151922;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -0.04em;
}

.login-heading p {
  margin: 0 0 32px;
  color: #7a8190;
  font-size: 13px;
}

.field-icon {
  color: #9aa1ad;
}

.login-button {
  height: 48px;
  margin-top: 8px;
  border-radius: 11px;
  box-shadow: 0 10px 24px rgba(22, 119, 255, 0.22);
}

.login-footnote {
  margin-top: 30px;
  color: #a1a7b0;
  font-size: 10px;
  text-align: center;
}

:deep(.ant-form-item-label > label) {
  color: #353b46;
  font-size: 12px;
  font-weight: 650;
}

:deep(.ant-input-affix-wrapper) {
  height: 46px;
  padding-inline: 13px;
  background: #fff;
  border-color: #e1e4e8;
  border-radius: 10px;
}

@media (max-width: 900px) {
  .login-page {
    display: block;
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }

  .brand-panel {
    display: none;
  }

  .login-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100vw;
    padding: 24px;
    overflow: hidden;
    background:
      radial-gradient(circle at 100% 0, rgba(22, 119, 255, 0.08), transparent 36%),
      #f6f7f9;
  }

  .login-card {
    width: calc(100vw - 48px);
    max-width: 100%;
    min-width: 0;
  }

  .login-card :deep(.ant-form),
  .login-card :deep(.ant-form-item),
  .login-card :deep(.ant-form-item-control),
  .login-card :deep(.ant-input-affix-wrapper),
  .login-button {
    width: 100%;
    max-width: 100%;
  }

  .mobile-brand {
    display: flex;
  }
}
</style>
