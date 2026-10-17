/**
 * 建索引服务
 *
 * 抽出来是为了让「离线脚本」和「后台接口」共用同一套逻辑——
 * 否则两处各写一遍，早晚会出现只改了一边的情况。
 */
const { sequelize } = require('@core/db')
const { Article } = require('@models/article')
const { ArticleChunkDao } = require('@dao/article-chunk')
const { chunkArticle, buildEmbeddingText, contentHash } = require('./chunk')
const { embedTexts, currentEmbeddingModel } = require('./embedding')

/**
 * 向量写入前保留 6 位小数。
 * 对余弦相似度来说这点精度损失可以忽略，但 JSON 体积能小掉三成左右。
 */
function roundVector(vector) {
  return vector.map((value) => Number(value.toFixed(6)))
}

/**
 * 判断某篇文章是否需要重建索引。
 * 两条判据缺一不可：切片集合没变，且每片都已有「当前模型」的向量。
 * 换向量模型后这里的比对会失败，从而自动全量重建，不需要手动 --force。
 */
async function isUpToDate(articleId, prepared, model) {
  const existing = await ArticleChunkDao.listMetaByArticle(articleId)

  if (existing.length !== prepared.length) return false
  if (!existing.every((row) => prepared.some((item) => item.hash === row.content_hash))) return false

  return existing.every(
    (row) =>
      Array.isArray(row.embedding) &&
      row.embedding.length > 0 &&
      row.embedding_model === model
  )
}

/**
 * 处理单篇文章
 * @returns {Promise<{skipped: boolean, chunks?: number, reason?: string}>}
 */
async function indexArticle(article, { force = false, model = currentEmbeddingModel() } = {}) {
  const chunks = chunkArticle({ title: article.title, content: article.content })
  if (chunks.length === 0) return { skipped: true, reason: '没有可切分的内容' }

  const prepared = chunks.map((chunk) => {
    const embeddingText = buildEmbeddingText({
      title: article.title,
      headingPath: chunk.headingPath,
      content: chunk.content
    })
    return { ...chunk, embeddingText, hash: contentHash(embeddingText) }
  })

  if (!force && (await isUpToDate(article.id, prepared, model))) {
    return { skipped: true }
  }

  const vectors = await embedTexts(prepared.map((item) => item.embeddingText))

  const rows = prepared.map((item, index) => ({
    article_id: article.id,
    chunk_index: item.chunkIndex,
    heading_path: item.headingPath,
    content: item.content,
    char_len: item.charLen,
    embedding: roundVector(vectors[index]),
    embedding_model: model,
    content_hash: item.hash
  }))

  // 先删后插必须在一个事务里，否则中途失败会留下「删了旧的、没写新的」的空窗
  await sequelize.transaction(async (transaction) => {
    await ArticleChunkDao.destroyByArticle(article.id, transaction)
    await ArticleChunkDao.bulkCreate(rows, transaction)
  })

  return { skipped: false, chunks: rows.length }
}

/**
 * 批量建索引
 * @param {{ force?: boolean, onlyId?: number }} options
 * @param {(line: string) => void} [onProgress] 进度回调，脚本里用来实时打印
 */
async function indexAll({ force = false, onlyId } = {}, onProgress) {
  const startedAt = Date.now()
  const model = currentEmbeddingModel()

  const where = { status: 1 }
  if (onlyId) where.id = onlyId

  const articles = await Article.findAll({
    where,
    attributes: ['id', 'title', 'content'],
    order: [['id', 'ASC']]
  })

  const stats = { total: articles.length, indexed: 0, skipped: 0, failed: 0, chunks: 0 }
  const failures = []

  for (const article of articles) {
    const label = `#${article.id} ${String(article.title).slice(0, 26)}`
    try {
      const result = await indexArticle(article, { force, model })

      if (result.skipped) {
        stats.skipped++
        if (onProgress) onProgress(`  - 跳过 ${label}${result.reason ? '（' + result.reason + '）' : ''}`)
      } else {
        stats.indexed++
        stats.chunks += result.chunks
        if (onProgress) onProgress(`  ✓ 索引 ${label} → ${result.chunks} 片`)
      }
    } catch (err) {
      stats.failed++
      failures.push({ id: article.id, message: err.message })
      if (onProgress) onProgress(`  ✗ 失败 ${label}：${err.message}`)
    }
  }

  stats.model = model
  stats.seconds = Number(((Date.now() - startedAt) / 1000).toFixed(1))
  stats.failures = failures

  return stats
}

module.exports = {
  indexArticle,
  indexAll,
  isUpToDate,
  roundVector
}
