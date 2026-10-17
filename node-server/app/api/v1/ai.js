/**
 * AI 问答相关路由
 * 只做路由注册和中间件挂载，业务逻辑在 @controller/ai
 */
const Router = require('koa-router')
const ratelimit = require('koa-ratelimit')

const { AiController } = require('@controller/ai')
const { Auth } = require('@middlewares/auth')

const AUTH_ADMIN = 16

const router = new Router({
  prefix: '/api/v1/ai'
})

/**
 * 问答接口单独限流。
 * 全局那条是 100 次/分钟，对普通读写接口够用；
 * 但问答每次都要调模型、按量计费，被刷的代价完全不同，所以单独收紧到 10 次/分钟。
 */
const askLimiter = ratelimit({
  driver: 'memory',
  db: new Map(),
  duration: 60000,
  max: 10,
  id: (ctx) => ctx.ip,
  errorMessage: '提问太频繁了，休息一下再问吧',
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  },
  disableHeader: false
})

// 提问（公开，但限流）
router.post('/ask', askLimiter, AiController.ask)

// 重建索引（管理员）
router.post('/reindex', new Auth(AUTH_ADMIN).m, AiController.reindex)

// 运行指标（管理员）
router.get('/stats', new Auth(AUTH_ADMIN).m, AiController.stats)

module.exports = router
