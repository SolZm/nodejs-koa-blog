import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/utils/token'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
      meta: { title: '登录', public: true }
    },
    {
      path: '/',
      component: () => import('@/layouts/BasicLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '工作台', icon: 'dashboard' } },
        { path: 'article', name: 'ArticleList', component: () => import('@/views/article/index.vue'), meta: { title: '文章列表', icon: 'article' } },
        { path: 'article/create', name: 'ArticleCreate', component: () => import('@/views/article/editor.vue'), meta: { title: '创建文章', parent: '文章管理' } },
        { path: 'article/edit', name: 'ArticleEdit', component: () => import('@/views/article/editor.vue'), meta: { title: '编辑文章', parent: '文章管理' } },
        { path: 'category', name: 'CategoryList', component: () => import('@/views/category/index.vue'), meta: { title: '分类管理', icon: 'category' } },
        { path: 'category/create', name: 'CategoryCreate', component: () => import('@/views/category/editor.vue'), meta: { title: '创建分类', parent: '分类管理' } },
        { path: 'category/edit', name: 'CategoryEdit', component: () => import('@/views/category/editor.vue'), meta: { title: '编辑分类', parent: '分类管理' } },
        { path: 'comment', name: 'CommentList', component: () => import('@/views/comment/index.vue'), meta: { title: '评论管理', icon: 'comment' } },
        { path: 'reply', name: 'ReplyList', component: () => import('@/views/reply/index.vue'), meta: { title: '回复管理', icon: 'reply' } },
        { path: 'user', name: 'UserList', component: () => import('@/views/user/index.vue'), meta: { title: '用户管理', icon: 'user' } },
        { path: 'user/edit', name: 'UserEdit', component: () => import('@/views/user/editor.vue'), meta: { title: '编辑用户', parent: '用户管理' } }
      ]
    },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/404.vue'), meta: { title: '页面不存在', public: true } }
  ]
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || '控制台'} · Solzm Admin`
  if (!to.meta.public && !getToken()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && getToken()) {
    return '/dashboard'
  }
})

export default router
