const Koa = require('koa')
const InitManager = require('./core/init')
const parser = require('koa-bodyparser')
const cors = require('@koa/cors');
const ratelimit = require('koa-ratelimit');

require('module-alias/register')


const catchError = require('./middlewares/exception')

const app = new Koa()

app.use(cors())
app.use(catchError)
app.use(parser())

// 接口调用频率限制（Rate-Limiting）
// Rate limiter middleware for koa.
// https://github.com/koajs/ratelimit
const db = new Map();
app.use(ratelimit({
  driver: 'memory',
  db: db,
  duration: 60000,
  errorMessage: 'Sometimes You Just Have to Slow Down.',
  id: (ctx) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  },
  max: 100,
  disableHeader: false,
  whitelist: (ctx) => {
    // some logic that returns a boolean
  },
  blacklist: (ctx) => {
    // some logic that returns a boolean
  }
}));

InitManager.initCore(app)

const port = Number(process.env.PORT) || 3000

// 只有「直接 node app.js 启动」时才监听端口。
//
// 原因：测试里是 require('../app') 把应用引进来跑的，如果模块一加载就 listen，
// 端口被占用（本地开发服务器、上一次测试残留）时整个测试套件会以 EADDRINUSE 挂掉。
if (require.main === module) {
  app.listen(port, () => {
    console.log('Koa is listening in http://localhost:' + port)
  })
}

module.exports = app
