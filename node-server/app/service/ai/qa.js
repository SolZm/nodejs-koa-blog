/**
 * 问答编排：检索 → 拼 prompt → 流式生成 → 落日志
 *
 * 为什么单独一层，而不是把逻辑塞进 controller：
 *   「先查缓存、再检索、区分博客资料与通用补充、完了写日志」这些是业务规则，
 *   后台接口、评测脚本、以后的定时任务都要用同一套。放进 HTTP 层就没法复用了。
 */
const { retrieve } = require('./retrieval')
const { streamChat, splitForStream } = require('./chat')
const { throwIfAborted } = require('./http')
const { ArticleDao } = require('@dao/article')
const { AiQueryLogDao } = require('@dao/ai-query-log')

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

// 相同问题直接复用答案：省一次模型调用，也快得多
const answerCache = new Map()

/** 归一化问题，让「怎么封装 axios?」和「怎么封装axios」命中同一个缓存 */
function normalizeQuestion(question) {
  return String(question)
    .replace(/\s+/g, '')
    .replace(/[?？。.！!，,、；;：:]/g, '')
    .toLowerCase()
}

function unique(list) {
  return [...new Set(list)]
}

/**
 * 提问主入口
 * @param {string} question
 * @param {{ topK?: number, signal?: AbortSignal }} options
 * @returns {AsyncGenerator<{type: string, text?: string, citations?: Array, meta?: object}>}
 */
async function* ask(question, { topK, signal } = {}) {
  const startedAt = Date.now()
  const cacheKey = normalizeQuestion(question)
  throwIfAborted(signal)

  // ---- 命中缓存 ----
  const cached = answerCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    throwIfAborted(signal)
    yield {
      type: 'meta',
      meta: {
        knowledge_mode: 'hybrid',
        blog_hit: cached.blogHit
      }
    }
    for (const piece of splitForStream(cached.answer)) {
      throwIfAborted(signal)
      yield { type: 'delta', text: piece }
    }
    yield { type: 'citations', citations: cached.citations }
    yield {
      type: 'done',
      meta: {
        latency_ms: 0,
        cached: true,
        knowledge_mode: 'hybrid',
        blog_hit: cached.blogHit
      }
    }

    await AiQueryLogDao.record({
      question: String(question).slice(0, 500),
      retrieved_ids: unique(cached.citations.map((item) => item.article_id)),
      top_score: cached.topScore,
      hit: cached.blogHit ? 1 : 0,
      answer_len: cached.answer.length,
      latency_ms: 0,
      cache_hit: 1
    })
    return
  }

  // ---- 检索 ----
  const { chunks, meta } = await retrieve(question, { topK, signal })
  throwIfAborted(signal)

  // 博客资料是首选依据，但检索为空不再直接拒答：
  // 通用技术说明仍然可以回答问题，只是不能伪造博客引用。
  const titles = chunks.length
    ? await ArticleDao.listTitlesByIds(unique(chunks.map((item) => item.article_id)))
    : {}
  const contexts = chunks.map((item) => ({ ...item, articleTitle: titles[item.article_id] || '' }))

  // 按「文章」重组上下文，一篇文章 = 一份来源 = 一个编号。
  //
  // 这里必须把编号口径统一，否则会出现一种很有迷惑性的错位：
  // 检索按切片排序，一篇匹配度高的文章会占掉好几个名额，
  // 如果按切片编号，同一篇文章就会变成 [1][2][3][4][5][6] 六个编号，
  // 读者以为有六份来源，底部却只列出一篇，看起来就像对不上。
  //
  // 改成按文章分组后：编号数 = 来源数，正文里的 [1] 和底部的 [1] 始终一一对应。
  const grouped = new Map()
  contexts.forEach((item) => {
    const entry = grouped.get(item.article_id) || {
      article_id: item.article_id,
      title: item.articleTitle,
      chunks: []
    }
    entry.chunks.push(item)
    grouped.set(item.article_id, entry)
  })

  // Map 的迭代顺序 = 首次出现的顺序 = 相关度顺序，不用再排一次
  const sources = [...grouped.values()].map((source, index) => ({
    index: index + 1,
    article_id: source.article_id,
    title: source.title,
    chunks: source.chunks,
    headings: unique(source.chunks.map((chunk) => chunk.heading_path).filter(Boolean))
  }))

  const citations = sources.map((source) => ({
    index: source.index,
    article_id: source.article_id,
    title: source.title,
    headings: source.headings
  }))

  const blogHit = sources.length > 0
  const knowledgeMeta = {
    knowledge_mode: 'hybrid',
    blog_hit: blogHit
  }

  // 在正文之前告诉前端本轮知识来源，用户不用等整段回答结束才知道是否有博客依据。
  yield { type: 'meta', meta: knowledgeMeta }

  // ---- 流式生成 ----
  let answer = ''
  for await (const delta of streamChat({ question, sources, signal })) {
    answer += delta
    yield { type: 'delta', text: delta }
  }

  throwIfAborted(signal)
  yield { type: 'citations', citations }

  const latency = Date.now() - startedAt
  yield { type: 'done', meta: { latency_ms: latency, cached: false, ...knowledgeMeta } }

  answerCache.set(cacheKey, {
    answer,
    citations,
    topScore: meta.topScore,
    blogHit,
    at: Date.now()
  })
  if (answerCache.size > CACHE_MAX_ENTRIES) {
    answerCache.delete(answerCache.keys().next().value)
  }

  await AiQueryLogDao.record({
    question: String(question).slice(0, 500),
    retrieved_ids: sources.map((source) => source.article_id),
    top_score: meta.topScore || 0,
    hit: blogHit ? 1 : 0,
    answer_len: answer.length,
    latency_ms: latency,
    cache_hit: 0
  })
}

function clearAnswerCache() {
  answerCache.clear()
}

module.exports = {
  ask,
  clearAnswerCache,
  normalizeQuestion,
  CACHE_TTL_MS
}
