/**
 * 问答日志的数据访问对象
 */
const { sequelize } = require('@core/db')
const { AiQueryLog } = require('@models/ai-query-log')

class AiQueryLogDao {
  /**
   * 写一条问答记录。
   * 注意这里吞掉了异常：日志写失败不应该让用户拿不到回答。
   */
  static async record(data) {
    try {
      return await AiQueryLog.create(data)
    } catch (err) {
      console.warn('[ai] 写入问答日志失败：', err.message)
      return null
    }
  }

  /** 近 N 天的汇总指标 */
  static async summary(days = 7) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000)

    const [row] = await sequelize.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(hit), 0) AS hits,
              COALESCE(SUM(cache_hit), 0) AS cache_hits,
              COALESCE(AVG(latency_ms), 0) AS avg_latency,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) AS completion_tokens
         FROM ai_query_log
        WHERE created_at >= :since`,
      { replacements: { since }, type: sequelize.QueryTypes.SELECT }
    )

    const total = Number(row.total) || 0
    const hits = Number(row.hits) || 0
    const cacheHits = Number(row.cache_hits) || 0

    return {
      days,
      total,
      hit_rate: total ? Number((hits / total).toFixed(4)) : 0,
      blog_miss_rate: total ? Number((1 - hits / total).toFixed(4)) : 0,
      // 保留旧字段，避免已有调用方升级时突然取不到值。
      no_result_rate: total ? Number((1 - hits / total).toFixed(4)) : 0,
      cache_hit_rate: total ? Number((cacheHits / total).toFixed(4)) : 0,
      avg_latency_ms: Math.round(Number(row.avg_latency) || 0),
      prompt_tokens: Number(row.prompt_tokens) || 0,
      completion_tokens: Number(row.completion_tokens) || 0
    }
  }

  /** 近 N 天按天聚合，给后台看趋势用 */
  static async daily(days = 7) {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000)

    return sequelize.query(
      `SELECT DATE(created_at) AS day,
              COUNT(*) AS total,
              COALESCE(SUM(hit), 0) AS hits,
              COALESCE(AVG(latency_ms), 0) AS avg_latency
         FROM ai_query_log
        WHERE created_at >= :since
        GROUP BY DATE(created_at)
        ORDER BY day ASC`,
      { replacements: { since }, type: sequelize.QueryTypes.SELECT }
    )
  }
}

module.exports = { AiQueryLogDao }
