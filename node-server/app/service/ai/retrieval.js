/**
 * 检索层：关键词 + 向量两路召回，再用 RRF 融合
 *
 * 为什么必须混合，而不是只用向量：
 *   纯向量对「MCP」「SSE」「DIP」这类缩写和专有名词召回很差——
 *   这些词在训练语料里语义模糊，向量上挤在一起分不开；
 *   而关键词路对它们几乎是精确命中。反过来，关键词对同义改写无能为力
 *   （问「怎么让请求不重复」未必命中「取消重复请求」），这正是向量路的强项。
 *
 * 融合为什么用 RRF（Reciprocal Rank Fusion）：
 *   两路的分数不可比——全文检索给的是相关度，余弦给的是相似度，量纲完全不同。
 *   RRF 只看「排在第几名」，公式是 score = Σ 1/(k + rank)，因此不需要任何归一化调参，
 *   工程上最省心，效果也稳定。k 取 60 是论文里的经验值。
 */
const { ArticleChunkDao } = require('@dao/article-chunk')
const config = require('../../../config/config')
const { embedTexts, cosineSimilarity } = require('./embedding')
const { throwIfAborted } = require('./http')

const RRF_K = 60
const PER_PATH_LIMIT = 20
const DEFAULT_TOP_K = 6

// 向量全量扫描的缓存。300 多条切片约 1MB，每次请求都重新读表并 JSON 解析太浪费。
const VECTOR_CACHE_TTL_MS = 5 * 60 * 1000
let vectorCache = { rows: null, loadedAt: 0 }

function toVector(value) {
  return typeof value === 'string' ? JSON.parse(value) : value
}

/**
 * 加载全部切片向量（带 TTL 缓存）
 * 重建索引后需要调用 invalidateVectorCache()，否则会有一段时间读到旧向量。
 */
async function loadVectorIndex({ force = false } = {}) {
  const now = Date.now()
  const fresh = vectorCache.rows && now - vectorCache.loadedAt < VECTOR_CACHE_TTL_MS

  if (!force && fresh) return vectorCache.rows

  const rows = await ArticleChunkDao.loadAllWithEmbedding()
  vectorCache = { rows, loadedAt: now }
  return rows
}

function invalidateVectorCache() {
  vectorCache = { rows: null, loadedAt: 0 }
}

/** 关键词路：交给数据库的全文索引排序 */
async function keywordPath(question) {
  const rows = await ArticleChunkDao.keywordSearch(question, PER_PATH_LIMIT)
  return rows.map((row) => ({
    id: row.id,
    article_id: row.article_id,
    chunk_index: row.chunk_index,
    heading_path: row.heading_path,
    content: row.content,
    keywordScore: Number(row.score) || 0
  }))
}

/** 向量路：把问题向量化后，和所有切片算余弦相似度 */
async function vectorPath(question, { signal } = {}) {
  throwIfAborted(signal)

  const rows = await loadVectorIndex()
  if (rows.length === 0) return []

  const [queryVector] = await embedTexts([question], { signal })
  throwIfAborted(signal)

  return rows
    .map((row) => ({
      id: row.id,
      article_id: row.article_id,
      chunk_index: row.chunk_index,
      heading_path: row.heading_path,
      content: row.content,
      vectorScore: cosineSimilarity(queryVector, toVector(row.embedding))
    }))
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, PER_PATH_LIMIT)
}

/**
 * RRF 融合：同一篇切片在两路里都出现，得分会叠加——两路都认可的结果自然排前面。
 */
function fuse(rankLists) {
  const merged = new Map()

  for (const list of rankLists) {
    list.forEach((item, index) => {
      let entry = merged.get(item.id)
      if (!entry) {
        entry = {
          id: item.id,
          article_id: item.article_id,
          chunk_index: item.chunk_index,
          heading_path: item.heading_path,
          content: item.content,
          rrfScore: 0,
          keywordScore: 0,
          vectorScore: 0
        }
        merged.set(item.id, entry)
      }

      entry.rrfScore += 1 / (RRF_K + index + 1)
      if (typeof item.keywordScore === 'number') entry.keywordScore = item.keywordScore
      if (typeof item.vectorScore === 'number') entry.vectorScore = item.vectorScore
    })
  }

  return [...merged.values()].sort((a, b) => b.rrfScore - a.rrfScore)
}

/**
 * 检索主入口
 * @param {string} question 用户问题
 * @param {{ topK?: number, mode?: 'hybrid'|'keyword'|'vector', signal?: AbortSignal }} options
 *        mode 用于阶段 4 的消融对比（纯关键词 / 纯向量 / 混合），默认混合
 */
async function retrieve(question, { topK = DEFAULT_TOP_K, mode = 'hybrid', signal } = {}) {
  const q = String(question || '').trim()
  throwIfAborted(signal)

  if (!q) {
    return { chunks: [], meta: { mode, keywordCount: 0, vectorCount: 0, topScore: 0 } }
  }

  const [keywordHits, vectorHits] = await Promise.all([
    mode === 'vector' ? Promise.resolve([]) : keywordPath(q),
    mode === 'keyword' ? Promise.resolve([]) : vectorPath(q, { signal })
  ])
  throwIfAborted(signal)

  const candidates = fuse([keywordHits, vectorHits]).slice(0, topK)

  // 置信度取「向量路里最高的一条」——它就是整库最相似的切片。
  // 纯关键词模式没有相似度可比，不做阈值判断（评测消融时需要拿到原始结果）。
  const bestVectorScore = vectorHits.length > 0 ? vectorHits[0].vectorScore : 0
  const useThreshold = mode !== 'keyword'
  const sourceRejected = useThreshold && bestVectorScore < config.ai.minRelevance

  return {
    chunks: sourceRejected ? [] : candidates,
    meta: {
      mode,
      keywordCount: keywordHits.length,
      vectorCount: vectorHits.length,
      // confidence 无论是否采用博客资料都返回，便于线上观察分布、回头调阈值
      confidence: bestVectorScore,
      minRelevance: config.ai.minRelevance,
      sourceRejected,
      topScore: candidates.length > 0 ? candidates[0].vectorScore : 0
    }
  }
}

module.exports = {
  retrieve,
  fuse,
  keywordPath,
  vectorPath,
  loadVectorIndex,
  invalidateVectorCache,
  RRF_K,
  DEFAULT_TOP_K
}
