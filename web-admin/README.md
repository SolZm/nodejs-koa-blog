# Solzm Admin · Vben Design

基于 Vue 3、Vite、TypeScript 和 Ant Design Vue 的后台管理界面，采用 Vben 5 风格的轻量设计体系。

## 本地运行

```bash
npm install
npm run dev
```

默认地址：`http://localhost:9529`

开发环境接口地址由 `.env.development` 的 `VITE_API_BASE_URL` 控制，默认指向：

```text
http://localhost:3000/api/v1
```

## 生产构建

```bash
npm run build
```

构建输出位于 `dist/`。生产环境默认使用同源接口 `/api/v1`，可通过 `.env.production` 修改。

## 已迁移页面

- 登录与路由鉴权
- 工作台数据概览
- 文章列表、创建、编辑
- Markdown 编辑器与七牛图片上传
- 分类列表、创建、编辑
- 评论审核、编辑、删除
- 回复审核、编辑、删除
- 用户列表、编辑、删除
- 明暗主题、响应式侧栏

旧版已保留在 `../web-admin-legacy`，可用于回滚和差异对照。
