/**
 * 后台管理面板端到端验收。
 *
 * 仅操作本次运行创建的临时数据，并在结束时通过接口和数据库收尾。
 * 运行：node scripts/e2e-admin-panel.js
 */
const qiniu = require('qiniu')
require('module-alias/register')
require('../config/config')
const { Admin } = require('@models/admin')

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000/api/v1'
const runId = Date.now().toString(36)
const marker = `E2E-${runId}`
const adminEmail = `e2e-admin-${runId}@example.com`
const userEmail = `e2e-user-${runId}@example.com`
const password = 'Test123456'

const records = {
  adminEmail,
  categoryId: null,
  userId: null,
  articleId: null,
  commentId: null,
  replyId: null,
  qiniuKey: null
}

let adminToken = ''
let adminId = null
let userToken = ''
let assertions = 0
const failures = []

function basicAuth(token) {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`
}

async function request(pathname, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: basicAuth(token) } : {}),
      ...headers
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

function check(condition, label, detail = '') {
  assertions += 1
  if (condition) {
    console.log(`  PASS  ${label}`)
    return
  }
  const message = `${label}${detail ? ` — ${detail}` : ''}`
  failures.push(message)
  console.error(`  FAIL  ${message}`)
}

function expectOk(result, label) {
  check(result.body?.code === 200, label, `HTTP ${result.status}, code=${result.body?.code}, msg=${result.body?.msg || ''}`)
  return result.body
}

function expectError(result, label) {
  check(result.body?.code !== 200, label, `HTTP ${result.status}, code=${result.body?.code}`)
}

async function deleteQiniuObject(key) {
  const accessKey = process.env.QINIU_ACCESS_KEY
  const secretKey = process.env.QINIU_SECRET_KEY
  if (!key || !accessKey || !secretKey) return
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const bucketManager = new qiniu.rs.BucketManager(mac)
  await new Promise((resolve, reject) => {
    bucketManager.delete('myblog-article', key, (error, responseBody, responseInfo) => {
      if (error || responseInfo.statusCode !== 200) {
        reject(error || new Error(`Qiniu delete failed: ${responseInfo.statusCode}`))
        return
      }
      resolve(responseBody)
    })
  })
}

async function cleanup() {
  console.log('\n清理测试数据')
  if (records.replyId) {
    await request(`/reply/${records.replyId}`, { method: 'DELETE', token: adminToken }).catch(() => undefined)
  }
  if (records.commentId) {
    await request(`/comment/${records.commentId}`, { method: 'DELETE', token: adminToken }).catch(() => undefined)
  }
  if (records.articleId) {
    await request(`/article/${records.articleId}`, { method: 'DELETE', token: adminToken }).catch(() => undefined)
  }
  if (records.categoryId) {
    await request(`/category/${records.categoryId}`, { method: 'DELETE', token: adminToken }).catch(() => undefined)
  }
  if (records.userId) {
    await request(`/user/delete/${records.userId}`, { method: 'DELETE', token: adminToken }).catch(() => undefined)
  }
  if (records.qiniuKey) {
    try {
      await deleteQiniuObject(records.qiniuKey)
      console.log('  CLEAN 七牛测试图片')
    } catch (error) {
      failures.push(`七牛测试图片清理失败: ${error.message}`)
    }
  }
  try {
    const removed = await Admin.destroy({ where: { email: adminEmail } })
    console.log(`  CLEAN 临时管理员 ${removed}`)
  } catch (error) {
    failures.push(`临时管理员清理失败: ${error.message}`)
  }
}

async function main() {
  console.log(`后台 E2E 验收：${BASE_URL}`)
  console.log(`测试标记：${marker}\n`)

  console.log('认证与权限')
  expectError(await request('/admin/auth'), '未登录不能读取管理员信息')
  expectOk(await request('/admin/register', {
    method: 'POST',
    body: { email: adminEmail, password1: password, password2: password, nickname: `E2E${runId.slice(-6)}` }
  }), '创建临时管理员')
  expectError(await request('/admin/login', {
    method: 'POST',
    body: { email: adminEmail, password: `${password}x` }
  }), '错误密码不能登录')

  const login = expectOk(await request('/admin/login', {
    method: 'POST',
    body: { email: adminEmail, password }
  }), '管理员登录')
  adminToken = login?.data?.token || ''
  check(Boolean(adminToken), '登录返回 token')

  const adminInfo = expectOk(await request('/admin/auth', { token: adminToken }), '读取管理员信息')
  adminId = adminInfo?.data?.id || null
  check(adminInfo?.data?.email === adminEmail, '管理员身份正确', `email=${adminInfo?.data?.email}`)

  console.log('\n分类 CRUD 与校验')
  expectOk(await request('/category', {
    method: 'POST',
    token: adminToken,
    body: { name: `${marker}-分类`, sort_order: 9, status: 1, parent_id: 0 }
  }), '创建分类')
  const createdCategoryList = expectOk(await request(`/category?name=${encodeURIComponent(`${marker}-分类`)}`), '回查新建分类')
  records.categoryId = createdCategoryList?.data?.data?.find((item) => item.name === `${marker}-分类`)?.id || null
  check(Boolean(records.categoryId), '创建分类后可在列表中找到')
  expectError(await request('/category', {
    method: 'POST',
    body: { name: `${marker}-未授权`, sort_order: 1, status: 1 }
  }), '未登录不能创建分类')

  const categoryDetail = expectOk(await request(`/category/${records.categoryId}`), '读取分类详情')
  check(categoryDetail?.data?.name === `${marker}-分类`, '分类详情名称正确')
  expectOk(await request(`/category/${records.categoryId}`, {
    method: 'PUT',
    token: adminToken,
    body: { name: `${marker}-分类-更新`, sort_order: 6, status: 1, parent_id: 0 }
  }), '更新分类')
  const categoryList = expectOk(await request(`/category?name=${encodeURIComponent(marker)}&status=1`), '筛选分类列表')
  check(categoryList?.data?.data?.some((item) => item.id === records.categoryId), '分类筛选命中新数据')

  console.log('\n用户注册、登录与管理')
  const userRegister = expectOk(await request('/user/register', {
    method: 'POST',
    body: { email: userEmail, password1: password, password2: password, username: `E2E${runId.slice(-8)}` }
  }), '注册临时用户')
  records.userId = userRegister?.data?.id
  userToken = userRegister?.data?.token || ''
  check(Boolean(records.userId && userToken), '用户注册返回 ID 与 token')

  const userAuth = expectOk(await request('/user/auth', { token: userToken }), '用户读取自身资料')
  check(userAuth?.data?.email === userEmail, '用户身份正确')
  const userLogin = expectOk(await request('/user/login', {
    method: 'POST',
    body: { email: userEmail, password }
  }), '用户密码登录')
  userToken = userLogin?.data?.token || userToken

  const userList = expectOk(await request(`/user/list?id=${records.userId}&page=1&page_size=10`, { token: adminToken }), '管理员读取用户列表')
  check(userList?.data?.data?.some((item) => item.id === records.userId), '用户列表命中新用户')
  expectOk(await request(`/user/detail/${records.userId}`, { token: adminToken }), '读取用户详情')
  expectOk(await request(`/user/update/${records.userId}`, {
    method: 'PUT',
    token: adminToken,
    body: { username: `${marker}-用户`, email: userEmail, status: 1 }
  }), '更新用户资料')

  console.log('\n文章 CRUD、筛选与权限')
  const articlePayload = {
    title: `${marker}-文章`,
    description: `${marker} 自动验收文章`,
    img_url: 'https://img.solzm.com/e2e-placeholder.png',
    content: '# E2E 标题\n\n```js\nconsole.log("e2e")\n```',
    seo_keyword: 'E2E, 后台测试',
    status: 1,
    sort_order: 8,
    admin_id: adminId,
    category_id: records.categoryId
  }
  const articleCreate = expectOk(await request('/article', {
    method: 'POST',
    token: adminToken,
    body: articlePayload
  }), '创建文章')
  const articleList = expectOk(await request(`/article?category_id=${records.categoryId}&keyword=${encodeURIComponent(marker)}&status=1&page=1&page_size=5`), '文章列表多条件筛选')
  records.articleId = articleList?.data?.data?.[0]?.id || null
  check(Boolean(records.articleId), '文章列表返回新文章')

  expectError(await request('/article', {
    method: 'POST',
    token: userToken,
    body: { ...articlePayload, title: `${marker}-越权文章` }
  }), '普通用户不能创建文章')

  const articleDetail = expectOk(await request(`/article/${records.articleId}?is_markdown=false`), '读取文章详情')
  check(articleDetail?.data?.category_info?.id === records.categoryId, '文章详情包含分类')
  check(articleDetail?.data?.browse >= 1, '文章浏览数正常递增')
  expectOk(await request(`/article/${records.articleId}`, {
    method: 'PUT',
    token: adminToken,
    body: { ...articlePayload, title: `${marker}-文章-更新`, status: 0 }
  }), '更新文章')
  const updatedArticle = expectOk(await request(`/article/${records.articleId}`), '读取更新后的文章')
  check(updatedArticle?.data?.title === `${marker}-文章-更新` && Number(updatedArticle?.data?.status) === 0, '文章更新内容正确')

  console.log('\n评论审核')
  const commentCreate = expectOk(await request('/comment', {
    method: 'POST',
    body: {
      article_id: records.articleId,
      user_id: records.userId,
      content: `**${marker}** 评论\n\n- 自动测试`
    }
  }), '创建评论')
  records.commentId = commentCreate?.data?.id
  check(Boolean(records.commentId), '评论返回 ID')
  expectOk(await request(`/comment/${records.commentId}?is_user=1&is_article=1&is_replay=1`, { token: adminToken }), '管理员读取评论详情')
  expectOk(await request(`/comment/${records.commentId}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 1, content: `${marker} 评论已审核` }
  }), '审核评论')
  const commentList = expectOk(await request(`/comment?article_id=${records.articleId}&status=1&is_user=1&is_article=1&page=1&page_size=10`), '筛选已审核评论')
  check(commentList?.data?.data?.some((item) => item.id === records.commentId), '评论筛选命中新评论')

  console.log('\n回复审核')
  expectOk(await request('/reply', {
    method: 'POST',
    body: {
      comment_id: records.commentId,
      article_id: records.articleId,
      user_id: records.userId,
      reply_user_id: adminId,
      content: `${marker} 回复`
    }
  }), '创建回复')
  const replyList = expectOk(await request(`/reply?article_id=${records.articleId}&page=1&page_size=10`), '读取回复列表')
  records.replyId = replyList?.data?.data?.find((item) => String(item.content).includes(marker))?.id || null
  check(Boolean(records.replyId), '回复列表命中新回复')
  expectOk(await request(`/reply/${records.replyId}`), '读取回复详情')
  expectOk(await request(`/reply/${records.replyId}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 1, content: `${marker} 回复已审核` }
  }), '审核回复')
  const replyUpdated = expectOk(await request(`/reply/${records.replyId}`), '读取更新后的回复')
  check(Number(replyUpdated?.data?.status) === 1, '回复审核状态正确')

  console.log('\n图片上传')
  const uploadTokenResult = expectOk(await request('/upload/token', { method: 'POST', token: adminToken }), '获取七牛上传凭证')
  const uploadToken = uploadTokenResult?.data?.token
  check(Boolean(uploadToken), '上传凭证非空')
  if (uploadToken) {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=', 'base64')
    const form = new FormData()
    form.append('token', uploadToken)
    form.append('file', new Blob([png], { type: 'image/png' }), `${marker}.png`)
    const uploadResponse = await fetch('https://up-z1.qiniup.com', { method: 'POST', body: form })
    const uploadBody = await uploadResponse.json().catch(() => ({}))
    records.qiniuKey = uploadBody.key || null
    check(uploadResponse.ok && Boolean(records.qiniuKey), '上传测试图片到七牛', JSON.stringify(uploadBody))
    check((await fetch(`https://img.solzm.com/${records.qiniuKey}`)).ok, '七牛测试图片可公开访问')
  }

  console.log('\n删除与清理流程')
  expectOk(await request(`/reply/${records.replyId}`, { method: 'DELETE', token: adminToken }), '删除回复')
  records.replyId = null
  expectOk(await request(`/comment/${records.commentId}`, { method: 'DELETE', token: adminToken }), '删除评论')
  records.commentId = null
  expectOk(await request(`/article/${records.articleId}`, { method: 'DELETE', token: adminToken }), '删除文章')
  records.articleId = null
  expectOk(await request(`/category/${records.categoryId}`, { method: 'DELETE', token: adminToken }), '删除分类')
  records.categoryId = null
  expectOk(await request(`/user/delete/${records.userId}`, { method: 'DELETE', token: adminToken }), '删除用户')
  records.userId = null
}

main()
  .catch((error) => {
    failures.push(`未捕获异常: ${error.stack || error.message}`)
    console.error(error)
  })
  .finally(async () => {
    if (adminToken || records.categoryId || records.userId || records.articleId || records.commentId || records.replyId || records.qiniuKey) {
      await cleanup()
    }
    console.log(`\n结果：${assertions} 项断言，${failures.length} 项失败`)
    if (failures.length) {
      failures.forEach((failure) => console.error(`- ${failure}`))
      process.exitCode = 1
    }
  })
