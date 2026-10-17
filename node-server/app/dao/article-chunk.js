/**
 * 文章切片的数据访问对象
 */
const { sequelize } = require('@core/db')
const { ArticleChunk } = require('@models/article-chunk')

/**
 * 把问题拆成若干 2 字词条，用于全文索引不可用时的兜底匹配。
 * 中文没有天然空格，按 2 字一组的 n 元组切分是最省事的召回方式。
 */
function queryTerms(question, maxTerms = 8) {
  const cleaned = String(question || '').replace(/[\s\p{P}]+/gu, '')
  const terms = []

  for (let i = 0; i < cleaned.length - 1 && terms.length < maxTerms; i += 2) {
    terms.push(cleaned.slice(i, i + 2))
  }

  return terms
}

class ArticleChunkDao {
  /**
   * 关键词召回
   * 优先走 ngram 全文索引；索引缺失或语句不支持时，退回多词条 LIKE。
   */
  static async keywordSearch(question, limit = 20) {
    try {
      return await sequelize.query(
        `SELECT id, article_id, chunk_index, heading_path, content,
                MATCH(content, heading_path) AGAINST (:q IN NATURAL LANGUAGE MODE) AS score
           FROM article_chunk
          WHERE MATCH(content, heading_path) AGAINST (:q IN NATURAL LANGUAGE MODE)
          ORDER BY score DESC
          LIMIT :limit`,
        {
          replacements: { q: question, limit },
          type: sequelize.QueryTypes.SELECT
        }
      )
    } catch (err) {
      // 只有「语句本身跑不起来」（索引缺失、版本不支持）才降级到 LIKE。
      // 注意不要因为「返回 0 条」就降级——那只是关键词真的没命中，
      // 贸然用宽泛的 LIKE 兜底会让无关文章也进入博客资料，污染引用和回答。
      console.warn('[retrieval] 全文检索不可用，退回 LIKE 匹配：', err.message)
    }

    const terms = queryTerms(question)
    if (terms.length === 0) return []

    const conditions = terms.map((_, index) => `(content LIKE :t${index} OR heading_path LIKE :t${index})`)
    const replacements = { limit }
    terms.forEach((term, index) => {
      replacements[`t${index}`] = `%${term}%`
    })

    return sequelize.query(
      `SELECT id, article_id, chunk_index, heading_path, content, 0 AS score
         FROM article_chunk
        WHERE ${conditions.join(' OR ')}
        LIMIT :limit`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    )
  }

  /**
   * 取出全部切片及其向量，供「向量路」在内存里做暴力相似度计算。
   *
   * 这是有意为之的简化：几百条切片全量扫描只要几毫秒，
   * 上向量数据库反而引入一个要运维的组件。等到万级切片再换。
   */
  static async loadAllWithEmbedding() {
    return ArticleChunk.findAll({
      attributes: ['id', 'article_id', 'chunk_index', 'heading_path', 'content', 'embedding'],
      raw: true
    })
  }

  /** 删除某篇文章的全部切片（重建索引时使用，可传入事务） */
  static async destroyByArticle(articleId, transaction) {
    return ArticleChunk.destroy({ where: { article_id: articleId }, transaction })
  }

  /** 批量写入切片（重建索引时使用，可传入事务） */
  static async bulkCreate(rows, transaction) {
    return ArticleChunk.bulkCreate(rows, { transaction })
  }

  /** 查询某篇文章现有切片的元信息，用于判断是否需要重建 */
  static async listMetaByArticle(articleId) {
    return ArticleChunk.findAll({
      where: { article_id: articleId },
      attributes: ['content_hash', 'embedding_model', 'embedding'],
      raw: true
    })
  }
}

module.exports = {
  ArticleChunkDao,
  queryTerms
}
