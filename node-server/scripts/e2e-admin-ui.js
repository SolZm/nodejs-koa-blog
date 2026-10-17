/**
 * 新版后台浏览器级验收。
 *
 * 需要 Vite 开发服务运行在 http://127.0.0.1:9529，
 * 使用本机 Google Chrome 执行真实页面交互。
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert/strict')
const { chromium } = require('../../web-admin/node_modules/playwright-core')
require('module-alias/register')
require('../config/config')
const { Admin } = require('@models/admin')

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3000/api/v1'
const APP_URL = process.env.E2E_APP_URL || 'http://127.0.0.1:9529'
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const previewDir = path.resolve(__dirname, '../../web-admin/docs/previews')
const runId = Date.now().toString(36)
const marker = `UI-${runId}`
const adminEmail = `e2e-ui-admin-${runId}@example.com`
const userEmail = `e2e-ui-user-${runId}@example.com`
const password = 'UiTest123456'
const categoryName = `${marker}-分类`
const categoryUpdatedName = `${categoryName}-更新`
const articleTitle = `${marker}-文章`
const articleUpdatedTitle = `${articleTitle}-更新`
const userName = `${marker.slice(0, 11)}用户`
const userUpdatedName = `${marker.slice(0, 8)}改`
const commentContent = `${marker} 评论`
const commentUpdatedContent = `${marker} 评论已修改`
const replyContent = `${marker} 回复`
const replyUpdatedContent = `${marker} 回复已修改`

let adminToken = ''
let adminId = null
let userToken = ''
let userId = null
let categoryId = null
let articleId = null
let commentId = null
let replyId = null
let browser = null
let passed = 0
const failures = []
const browserErrors = []

function authHeader(token) {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`
}

async function api(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: authHeader(token) } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }
  return { status: response.status, body: payload }
}

async function ok(pathname, options, label) {
  const result = await api(pathname, options)
  assert.equal(result.body?.code, 200, `${label}: HTTP ${result.status}, ${result.body?.msg || JSON.stringify(result.body)}`)
  passed += 1
  return result.body
}

async function step(label, fn) {
  try {
    await fn()
    console.log(`  PASS  ${label}`)
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
    console.error(`  FAIL  ${label}: ${error.message}`)
    throw error
  }
}

async function waitForText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 })
}

async function gotoPage(page, pathname, heading) {
  await page.goto(`${APP_URL}${pathname}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: heading, exact: true }).waitFor({ state: 'visible', timeout: 12000 })
}

async function clickModalConfirm(page, text = '确定') {
  const modal = page.locator('.ant-modal-confirm, .ant-modal').filter({ hasText: text }).last()
  await modal.getByRole('button', { name: text, exact: true }).click()
  await page.waitForTimeout(400)
}

async function cleanup() {
  try {
    if (replyId) await api(`/reply/${replyId}`, { method: 'DELETE', token: adminToken })
    if (commentId) await api(`/comment/${commentId}`, { method: 'DELETE', token: adminToken })
    if (articleId) await api(`/article/${articleId}`, { method: 'DELETE', token: adminToken })
    if (categoryId) await api(`/category/${categoryId}`, { method: 'DELETE', token: adminToken })
    if (userId) await api(`/user/delete/${userId}`, { method: 'DELETE', token: adminToken })
    await Admin.destroy({ where: { email: adminEmail } })
    console.log('  CLEAN 浏览器验收临时数据')
  } catch (error) {
    failures.push(`清理失败: ${error.message}`)
  }
  if (browser) await browser.close().catch(() => undefined)
}

async function main() {
  fs.mkdirSync(previewDir, { recursive: true })
  console.log(`后台浏览器验收：${APP_URL}`)
  console.log(`测试标记：${marker}\n`)

  await ok('/admin/register', {
    method: 'POST',
    body: { email: adminEmail, password1: password, password2: password, nickname: `UI${runId.slice(-6)}` }
  }, '创建 UI 临时管理员')
  const login = await ok('/admin/login', {
    method: 'POST',
    body: { email: adminEmail, password }
  }, '登录 UI 临时管理员')
  adminToken = login.data.token
  adminId = (await ok('/admin/auth', { token: adminToken }, '读取临时管理员')).data.id

  const user = await ok('/user/register', {
    method: 'POST',
    body: { email: userEmail, password1: password, password2: password, username: userName }
  }, '创建 UI 临时用户')
  userId = user.data.id
  userToken = user.data.token

  browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-background-networking', '--no-first-run']
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.stack || error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('requestfailed', (request) => {
    if (!request.url().includes('favicon')) browserErrors.push(`requestfailed: ${request.method()} ${request.url()}`)
  })

  await step('真实登录并进入工作台', async () => {
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('邮箱地址').fill(adminEmail)
    await page.getByLabel('登录密码').fill(password)
    await page.getByRole('button', { name: /进入控制台/ }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.getByRole('heading', { name: /工作台|早上好|下午好|晚上好|夜深了/ }).waitFor({ timeout: 12000 })
    await page.locator('.stat-card').first().waitFor({ state: 'visible' })
    passed += 1
  })

  await step('主题切换与侧栏折叠', async () => {
    const before = await page.locator('html').getAttribute('data-theme')
    await page.getByRole('button', { name: '切换主题' }).click()
    const after = await page.locator('html').getAttribute('data-theme')
    assert.notEqual(after, before)
    await page.getByRole('button', { name: '切换菜单' }).click()
    await page.locator('.admin-layout').waitFor({ state: 'visible' })
    passed += 1
  })

  await page.screenshot({ path: path.join(previewDir, 'dashboard-desktop.png'), fullPage: true })

  await step('通过 UI 创建分类', async () => {
    await page.getByRole('menuitem', { name: /分类管理/ }).click()
    await page.waitForURL('**/category')
    await page.getByRole('button', { name: /新增分类/ }).click()
    await page.waitForURL('**/category/create')
    await page.getByLabel('分类名称').fill(categoryName)
    await page.locator('.ant-input-number-input').fill('3')
    await page.locator('.form-actions').getByRole('button', { name: '保存分类' }).click()
    await page.waitForURL(/\/category$/, { timeout: 20000 })
    await page.getByRole('heading', { name: '分类管理', exact: true }).waitFor({ timeout: 12000 })
    await waitForText(page, categoryName)
    const categoryList = await ok(`/category?name=${encodeURIComponent(categoryName)}`, {}, 'API 回查 UI 新建分类')
    categoryId = categoryList.data.data.find((item) => item.name === categoryName)?.id || null
    assert.ok(categoryId)
    passed += 1
  })

  await step('通过 UI 编辑分类', async () => {
    const row = page.locator('tr').filter({ hasText: categoryName }).first()
    await row.getByRole('button', { name: /编辑/ }).click()
    await page.waitForURL(/\/category\/edit\?id=/)
    await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden', timeout: 12000 })
    await page.getByLabel('分类名称').fill(categoryUpdatedName)
    await page.getByRole('button', { name: '保存分类' }).click()
    await page.waitForURL('**/category', { timeout: 15000 })
    const categoryUpdated = await ok(`/category?name=${encodeURIComponent(categoryUpdatedName)}`, {}, 'API 回查 UI 更新分类')
    assert.ok(categoryUpdated.data.data.some((item) => item.id === categoryId))
    await page.goto(`${APP_URL}/category`, { waitUntil: 'networkidle' })
    await waitForText(page, categoryUpdatedName)
    passed += 1
  })

  await step('通过 UI 创建文章', async () => {
    await page.getByRole('menuitem', { name: /文章管理/ }).click()
    await page.waitForURL('**/article')
    await page.getByRole('button', { name: /新建文章/ }).click()
    await page.waitForURL('**/article/create')
    await page.getByLabel('文章标题').fill(articleTitle)
    await page.getByLabel('文章描述').fill(`${marker} 浏览器验收文章`)
    await page.getByLabel('SEO 关键字').fill('E2E, Vben, Ant Design Vue')
    await page.waitForTimeout(800)
    await page.locator('.ant-select-selector').first().click()
    const categoryOption = page.locator('.ant-select-item-option').filter({ hasText: categoryUpdatedName })
    await categoryOption.waitFor({ state: 'visible', timeout: 12000 })
    await categoryOption.click()
    await page.getByPlaceholder('也可以直接粘贴图片外链').fill(
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiIGZpbGw9IiMxNjc3ZmYiLz48L3N2Zz4='
    )
    const editor = page.locator('.cm-content').first()
    await editor.click()
    await page.keyboard.insertText(`# ${articleTitle}\n\n这是一篇浏览器自动验收文章。\n\n\`\`\`js\nconsole.log("UI E2E")\n\`\`\``)
    await page.getByRole('button', { name: /发布文章/ }).click()
    await page.waitForURL('**/article', { timeout: 20000 })
    await waitForText(page, articleTitle)
    const articleList = await ok(`/article?keyword=${encodeURIComponent(marker)}&page=1&page_size=10`, {}, 'API 回查 UI 新建文章')
    articleId = articleList.data.data[0]?.id || null
    assert.ok(articleId)
    passed += 1
  })

  const comment = await ok('/comment', {
    method: 'POST',
    body: { article_id: articleId, user_id: userId, content: commentContent }
  }, '为 UI 验收创建评论')
  commentId = comment.data.id
  await ok(`/comment/${commentId}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 1, content: commentContent }
  }, '预先审核 UI 测试评论')
  await ok('/reply', {
    method: 'POST',
    body: {
      comment_id: commentId,
      article_id: articleId,
      user_id: userId,
      reply_user_id: adminId,
      content: replyContent
    }
  }, '为 UI 验收创建回复')
  const replyList = await ok(`/reply?article_id=${articleId}&page=1&page_size=10`, {}, '读取 UI 测试回复')
  replyId = replyList.data.data.find((item) => String(item.content).includes(marker))?.id || null
  assert.ok(replyId)
  await ok(`/reply/${replyId}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 1, content: replyContent }
  }, '预先审核 UI 测试回复')

  await step('评论列表、筛选与编辑弹窗', async () => {
    await page.getByRole('menuitem', { name: /评论管理/ }).click()
    await page.waitForURL('**/comment')
    await page.getByPlaceholder('文章 ID').fill(String(articleId))
    await page.getByRole('button', { name: /查询/ }).click()
    const row = page.locator('tr').filter({ hasText: commentContent }).first()
    await row.waitFor({ state: 'visible', timeout: 12000 })
    await row.getByRole('button', { name: /编辑/ }).click()
    const modal = page.locator('.ant-modal').last()
    await modal.locator('textarea').fill(commentUpdatedContent)
    await modal.locator('.ant-btn-primary').click()
    await waitForText(page, commentUpdatedContent)
    passed += 1
  })

  await step('回复列表、筛选与编辑弹窗', async () => {
    await page.getByRole('menuitem', { name: /回复管理/ }).click()
    await page.waitForURL('**/reply')
    await page.getByPlaceholder('文章 ID').fill(String(articleId))
    await page.getByRole('button', { name: /查询/ }).click()
    const row = page.locator('tr').filter({ hasText: replyContent }).first()
    await row.waitFor({ state: 'visible', timeout: 12000 })
    await row.getByRole('button', { name: /编辑/ }).click()
    const modal = page.locator('.ant-modal').last()
    await modal.locator('textarea').fill(replyUpdatedContent)
    await modal.locator('.ant-btn-primary').click()
    await waitForText(page, replyUpdatedContent)
    passed += 1
  })

  await step('用户列表、搜索与编辑资料', async () => {
    await page.getByRole('menuitem', { name: /用户管理/ }).click()
    await page.waitForURL('**/user')
    await page.getByPlaceholder('用户 ID').fill(String(userId))
    await page.getByRole('button', { name: /查询/ }).click()
    const row = page.locator('tr').filter({ hasText: userEmail }).first()
    await row.waitFor({ state: 'visible', timeout: 12000 })
    await row.getByRole('button', { name: /编辑/ }).click()
    await page.waitForURL(/\/user\/edit\?id=/)
    await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden', timeout: 12000 })
    await page.getByLabel('用户昵称').fill(userUpdatedName)
    await page.locator('.form-actions').getByRole('button', { name: '保存更新' }).click()
    await page.waitForURL('**/user', { timeout: 15000 })
    await waitForText(page, userUpdatedName)
    passed += 1
  })

  await step('通过 UI 编辑文章', async () => {
    await page.getByRole('menuitem', { name: /文章管理/ }).click()
    await page.waitForURL('**/article')
    await page.getByPlaceholder('输入文章标题').fill(articleTitle)
    await page.getByRole('button', { name: /查询/ }).click()
    const row = page.locator('tr').filter({ hasText: articleTitle }).first()
    await row.waitFor({ state: 'visible', timeout: 12000 })
    await row.getByRole('button', { name: /编辑/ }).click()
    await page.waitForURL(/\/article\/edit\?id=/)
    await page.locator('.ant-spin-spinning').waitFor({ state: 'hidden', timeout: 12000 })
    await page.getByLabel('文章标题').fill(articleUpdatedTitle)
    await page.locator('.page-header-actions').getByRole('button', { name: /保存更新/ }).click()
    await page.waitForURL('**/article', { timeout: 20000 })
    const updatedArticleList = await ok(`/article?keyword=${encodeURIComponent(articleUpdatedTitle)}&page=1&page_size=10`, {}, 'API 回查 UI 更新文章')
    assert.ok(updatedArticleList.data.data.some((item) => item.id === articleId))
    await page.goto(`${APP_URL}/article`, { waitUntil: 'networkidle' })
    await page.getByPlaceholder('输入文章标题').fill(articleUpdatedTitle)
    await page.getByRole('button', { name: /查询/ }).click()
    await waitForText(page, articleUpdatedTitle)
    passed += 1
  })

  await page.screenshot({ path: path.join(previewDir, 'article-list-desktop.png'), fullPage: true })

  await step('通过 UI 删除文章、评论、回复、用户和分类', async () => {
    const articleRow = page.locator('tr').filter({ hasText: articleUpdatedTitle }).first()
    await articleRow.getByRole('button', { name: /删除/ }).click()
    await page.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click()
    await page.waitForTimeout(700)

    await page.getByRole('menuitem', { name: /回复管理/ }).click()
    await page.waitForURL('**/reply')
    const replyRow = page.locator('tr').filter({ hasText: replyUpdatedContent }).first()
    await replyRow.locator('.table-actions button').last().click()
    await page.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click()
    await page.waitForTimeout(500)
    replyId = null

    await page.getByRole('menuitem', { name: /评论管理/ }).click()
    await page.waitForURL('**/comment')
    const commentRow = page.locator('tr').filter({ hasText: commentUpdatedContent }).first()
    await commentRow.locator('.table-actions button').last().click()
    await page.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click()
    await page.waitForTimeout(500)
    commentId = null

    await page.getByRole('menuitem', { name: /用户管理/ }).click()
    await page.waitForURL('**/user')
    const userRow = page.locator('tr').filter({ hasText: userUpdatedName }).first()
    await userRow.getByRole('button', { name: /删除/ }).click()
    await page.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click()
    await page.waitForTimeout(500)
    userId = null

    await page.getByRole('menuitem', { name: /分类管理/ }).click()
    await page.waitForURL('**/category')
    const categoryRow = page.locator('tr').filter({ hasText: categoryUpdatedName }).first()
    await categoryRow.getByRole('button', { name: /删除/ }).click()
    await page.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click()
    await page.waitForTimeout(500)
    categoryId = null
    articleId = null
    passed += 1
  })

  await step('404 页面与退出登录', async () => {
    await page.goto(`${APP_URL}/not-a-real-page`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: '页面走丢了' }).waitFor()
    await page.getByRole('button', { name: /返回工作台/ }).click()
    await page.waitForURL('**/dashboard')
    await page.locator('.profile-button').click()
    await page.getByRole('menuitem', { name: '退出登录' }).click()
    await page.waitForURL('**/login')
    passed += 1
  })

  await step('移动端工作台与侧栏抽屉', async () => {
    await page.setViewportSize({ width: 500, height: 844 })
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('邮箱地址').fill(adminEmail)
    await page.getByLabel('登录密码').fill(password)
    await page.getByRole('button', { name: /进入控制台/ }).click()
    await page.waitForURL('**/dashboard')
    await page.getByRole('button', { name: '切换菜单' }).click()
    await page.locator('.admin-layout.mobile-open').waitFor({ state: 'visible' })
    await page.screenshot({ path: path.join(previewDir, 'dashboard-mobile.png'), fullPage: true })
    passed += 1
  })
}

main()
  .then(async () => {
    if (browserErrors.length) {
      failures.push(...browserErrors.map((error) => `浏览器错误: ${error}`))
    }
  })
  .catch((error) => {
    failures.push(`未捕获异常: ${error.stack || error.message}`)
    console.error(error)
  })
  .finally(async () => {
    await cleanup()
    console.log(`\n结果：${passed} 个 UI 步骤通过，${failures.length} 项失败`)
    if (failures.length) {
      failures.forEach((failure) => console.error(`- ${failure}`))
      process.exitCode = 1
    }
  })
