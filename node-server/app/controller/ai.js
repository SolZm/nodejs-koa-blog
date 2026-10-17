/**
 * AI 问答控制器
 * 只做「校验参数 → 调 service → 组装/推送响应」，不含业务规则。
 */
const { Readable } = require('stream')

const { Resolve } = require('@lib/helper')
const { AskValidator } = require('@validators/ai')
const { ask } = require('@service/ai/qa')
const { indexAll } = require('@service/ai/indexer')
const { invalidateVectorCache } = require('@service/ai/retrieval')
const { AiQueryLogDao } = require('@dao/ai-query-log')

const res = new Resolve()

/** 拼一条 SSE 事件 */
function sseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}

class AiController {
  /**
   * POST /api/v1/ai/ask
   * 流式返回（text/event-stream）：
   *   event: meta       data: {"knowledge_mode":"hybrid","blog_hit":true}
   *   event: delta      data: {"text":"片段"}
   *   event: citations  data: {"citations":[{index,article_id,title,heading_path}]}
   *   event: done       data: {"latency_ms":1234,"cached":false,"knowledge_mode":"hybrid","blog_hit":true}
   *   event: error      data: {"msg":"...","errorCode":10000}
   */
  static async ask(ctx) {
    const v = await new AskValidator().validate(ctx)
    const question = v.get('body.question')

    // SSE 是长连接：关掉 socket 超时；X-Accel-Buffering 用来让 nginx 不要缓冲，
    // 否则前端会「卡很久然后一次性全出来」，打字机效果就没了
    ctx.request.socket.setTimeout(0)
    ctx.req.socket.setNoDelay(true)
    ctx.req.socket.setKeepAlive(true)
    ctx.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
    ctx.status = 200

    // 浏览器停止回答时会中断当前连接。把断开事件转成 AbortSignal，
    // 这样检索、向量化和对话模型请求都能尽快释放，而不是后台继续生成。
    const requestController = new AbortController()
    const abortRequest = () => {
      if (!requestController.signal.aborted) requestController.abort()
    }
    ctx.req.once('aborted', abortRequest)
    ctx.res.once('close', abortRequest)
    if (ctx.req.aborted || ctx.res.destroyed) abortRequest()

    // 用 Readable.from 包一个异步生成器，Koa 会负责把它 pipe 出去。
    // 这里必须自己兜住异常：响应头已经发出去了，再抛给全局中间件只会变成一句莫名的错误。
    ctx.body = Readable.from(
      (async function* stream() {
        try {
          for await (const event of ask(question, { signal: requestController.signal })) {
            if (event.type === 'delta') {
              yield sseEvent('delta', { text: event.text })
            } else if (event.type === 'meta') {
              yield sseEvent('meta', event.meta)
            } else if (event.type === 'citations') {
              yield sseEvent('citations', { citations: event.citations })
            } else if (event.type === 'done') {
              yield sseEvent('done', event.meta)
            }
          }
        } catch (err) {
          // 客户端已经主动断开时不再写 error 事件，也不要把正常的停止记成服务异常。
          if (requestController.signal.aborted) return

          console.error('[ai] 问答失败：', err)
          yield sseEvent('error', { msg: err.message || '问答服务异常', errorCode: 10000 })
        } finally {
          ctx.req.removeListener('aborted', abortRequest)
          ctx.res.removeListener('close', abortRequest)
        }
      })()
    )
  }

  /** POST /api/v1/ai/reindex —— 重建索引（管理员） */
  static async reindex(ctx) {
    const body = ctx.request.body || {}
    // force 和 id 都是可选参数，直接读 body 即可
    const stats = await indexAll({ force: Boolean(body.force), onlyId: body.id })

    // 索引变了必须让检索层的向量缓存失效，否则会有一段时间仍读到旧向量
    invalidateVectorCache()

    ctx.status = 200
    ctx.body = res.json({
      processed: stats.indexed,
      skipped: stats.skipped,
      failed: stats.failed,
      chunks: stats.chunks,
      seconds: stats.seconds
    })
  }

  /** GET /api/v1/ai/stats —— 问答运行指标（管理员） */
  static async stats(ctx) {
    const days = Number(ctx.query.days) || 7

    const [summary, daily] = await Promise.all([
      AiQueryLogDao.summary(days),
      AiQueryLogDao.daily(days)
    ])

    ctx.status = 200
    ctx.body = res.json({ ...summary, daily })
  }
}

module.exports = { AiController }
