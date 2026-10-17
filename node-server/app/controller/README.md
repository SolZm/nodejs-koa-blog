# controller 层约定

## 为什么要有这一层

之前 `app/api/v1/*.js` 里同时做了四件事：注册路由、校验参数、写业务逻辑、组装响应。
功能少的时候没问题，但只要出现下面任意一种情况就会难受：

- 同一段业务逻辑要在别处复用（后台接口、定时任务、脚本都要用）
- 想给业务逻辑写单元测试，却得先把整个 HTTP 层搭起来
- 一个路由函数长到一百多行，看代码要不停上下滚动

所以从新的接口开始，按下面的分工来写。

## 四层分工

| 层 | 目录 | 只负责 | 不应该出现 |
|---|---|---|---|
| 路由 | `app/api/v1/` | 注册路径、中间件（鉴权/限流）、把请求交给 controller | 业务逻辑、数据库调用 |
| controller | `app/controller/` | 校验参数、调用 service、组装响应 | 写 SQL、写复杂业务规则 |
| service | `app/service/` | 业务逻辑，可被任何地方复用 | 直接读写 `ctx` |
| dao | `app/dao/` | 数据库读写 | 业务判断、HTTP 相关代码 |

## 写法示例

```js
// app/api/v1/example.js —— 只做路由注册
const Router = require('koa-router')
const { ExampleController } = require('@controller/example')
const { Auth } = require('@middlewares/auth')

const AUTH_ADMIN = 16
const router = new Router({ prefix: '/api/v1/example' })

router.post('/do', new Auth(AUTH_ADMIN).m, ExampleController.do)

module.exports = router
```

```js
// app/controller/example.js —— 校验 + 调 service + 组装响应
const { ExampleService } = require('@service/example')
const { Resolve } = require('@lib/helper')
const res = new Resolve()

class ExampleController {
  static async do(ctx) {
    const v = await new SomeValidator().validate(ctx)
    const [err, data] = await ExampleService.do(v.get('body.xxx'))

    if (err) throw err

    ctx.status = 200
    ctx.body = res.json(data)
  }
}

module.exports = { ExampleController }
```

## 两条约定

1. **`app/service/` 目录名保持不变**（是单数）。`@service` 这个别名指向它，改名会让所有老代码报错——能换实现就别换接口。
2. **老代码不强制重构。** 现有的 `app/api/v1/*.js` 保持原样，碰到哪块改哪块。新接口一律按上面的分工写。
