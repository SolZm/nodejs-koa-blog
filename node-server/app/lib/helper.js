/**
 * 统一响应体构造器。
 *
 * 【关于 fail() 的 err 参数 —— 这里曾经是个信息泄露口子】
 *
 * 调用点普遍写成 `ctx.body = res.fail(err)`（app/api/v1/ 下 30 处），
 * 而这里的 err 通常是 DAO 层 catch 到的 Sequelize 原始错误。早先的实现
 * 把它整个塞进响应体，序列化后等于把 SQL 语句、表名、字段名、连接信息
 * 直接交给客户端——非管理员接口也一样。
 *
 * 全局异常中间件（middlewares/exception.js）对「抛出去的异常」做过兜底脱敏，
 * 但那条路走不到这里：DAO 统一返回 [err, data] 二元组，走的是「正常返回」
 * 分支，压根不进 try/catch，所以脱敏必须在这一层补。
 *
 * 现在的策略：
 *   · 生产环境 —— 响应里不带任何错误字段，要排查看服务端日志
 *   · 非生产环境 —— 附一个 debug 字段，且只给错误【类型名】(err.name)；
 *     刻意不给 err.message，因为 Sequelize 的 message 里常常就带着完整 SQL
 *     （例如 "SELECT `id` FROM `article` WHERE ..."）
 *   · msg 的取值逻辑一个字没动，调用点的语义保持原样
 *
 * 顺带记一笔（本次未改，属于另一个待办）：单参数写法 res.fail(err) 在遇到
 * HttpException 时，客户端只会看到默认的「操作失败」，拿不到 err.msg 里
 * 那句具体原因。要改得逐个核对 30 个调用点的文案，不适合混在这次改动里。
 */
class Resolve {
  fail(err = {}, msg = '操作失败', errorCode = 10001) {
    const body = {
      msg,
      errorCode
    }

    // 生产环境连类型名都不给；开发环境给个类型名便于定位。
    const isProd = process.env.NODE_ENV === 'production'
    if (!isProd && err && err.name && err.name !== 'Error') {
      body.debug = err.name
    }

    return body
  }

  success(msg = 'success', errorCode = 0, code = 200) {
    return {
      msg,
      code,
      errorCode
    }
  }

  json(data, msg = 'success', errorCode = 0, code = 200) {
    return {
      code,
      msg,
      errorCode,
      data
    }
  }
}

module.exports = {
  Resolve
}
