/**
 * 向量化服务
 *
 * 对外只暴露 embedTexts(texts) -> 向量数组，内部按配置切换实现：
 *
 * - mock：本地确定性实现，不联网、不花钱。做法是把字符二元组哈希到固定维度
 *   （hashing trick），再 L2 归一化。它没有语义能力，但字面越接近、向量越相似，
 *   所以足以把「建索引 → 检索 → 评测」整条链路跑通，也方便写不依赖网络的测试。
 *
 * - openai：走 OpenAI 兼容协议，POST {baseUrl}/embeddings。
 *   这样换厂商（百炼 / DeepSeek / OpenAI）只改环境变量，代码不用动。
 */
const config = require('../../../config/config')
const {
  fetchWithTimeout,
  throwIfAborted,
  isAbortError,
  abortableDelay
} = require('./http')

const BATCH_SIZE = 10
const MAX_RETRY = 3

/** FNV-1a 32 位哈希，用于 mock 模式把字符组合映射到向量下标 */
function hash32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 把文本变成一个 dim 维、已归一化的向量 */
function mockEmbed(text, dim) {
  const vec = new Array(dim).fill(0)
  const s = String(text)

  for (let i = 0; i < s.length - 1; i++) {
    const h = hash32(s.slice(i, i + 2))
    // 用哈希的最高位决定正负号，抵消一部分碰撞带来的系统性偏置
    const sign = h & 0x80000000 ? -1 : 1
    vec[h % dim] += sign
  }

  let norm = 0
  for (const v of vec) norm += v * v
  norm = Math.sqrt(norm)

  // 文本为空或全部抵消时，返回零向量，交给上层判定
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

/** 走 OpenAI 兼容协议批量取向量 */
async function openaiEmbed(texts, signal) {
  const { baseUrl, apiKey, model } = config.ai.embedding
  const { timeoutMs } = config.ai

  if (!baseUrl) throw new Error('AI_BASE_URL 未配置，无法调用向量服务')
  if (!model) throw new Error('AI_EMBEDDING_MODEL 未配置')

  const response = await fetchWithTimeout(
    `${baseUrl}/embeddings`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({ model, input: texts })
    },
    timeoutMs,
    signal
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`向量服务返回 ${response.status}：${detail.slice(0, 200)}`)
  }

  const body = await response.json()
  if (!Array.isArray(body.data) || body.data.length !== texts.length) {
    throw new Error('向量服务返回的数据条数与请求不一致')
  }

  // 按 index 排序，确保返回顺序和输入顺序严格对应
  return body.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding)
}

/**
 * 批量向量化
 * @param {string[]} texts
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<number[][]>}
 */
async function embedTexts(texts, { signal } = {}) {
  const list = Array.isArray(texts) ? texts : [texts]
  if (list.length === 0) return []
  throwIfAborted(signal)

  if (config.ai.provider === 'mock') {
    return list.map((text) => mockEmbed(text, config.ai.embedding.dim))
  }

  const result = []
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE)
    let lastError = null

    // 重试：向量服务偶发 5xx / 超时，重试比整轮失败划算得多
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const vectors = await openaiEmbed(batch, signal)
        result.push(...vectors)
        lastError = null
        break
      } catch (err) {
        lastError = err
        if (isAbortError(err, signal)) throw err
        if (attempt < MAX_RETRY) {
          await abortableDelay(500 * attempt, signal)
        }
      }
    }

    if (lastError) throw lastError
  }

  return result
}

/** 当前使用的向量模型标识，写进 article_chunk.embedding_model，换模型时便于识别旧数据 */
function currentEmbeddingModel() {
  return config.ai.provider === 'mock'
    ? `mock-${config.ai.embedding.dim}`
    : config.ai.embedding.model
}

/** 余弦相似度。两个向量都已归一化时等价于点积，这里仍做通用实现以防万一 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

module.exports = {
  embedTexts,
  currentEmbeddingModel,
  cosineSimilarity,
  mockEmbed,
  hash32,
  BATCH_SIZE
}
