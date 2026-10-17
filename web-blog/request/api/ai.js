import ai from '../urls/ai'

// 后端没就绪时，把 .env 里的 AI_MOCK 改成 true，就能用本地假数据预览完整交互
export const USE_MOCK = process.env.AI_MOCK === 'true'

const BASE_URL = process.env.BASE_URL

function createAbortError() {
  const error = new Error('回答已停止')
  error.name = 'AbortError'
  return error
}

function isAbortError(error, signal) {
  return Boolean((signal && signal.aborted) || (error && error.name === 'AbortError'))
}

function abortableDelay(ms, signal) {
  if (signal && signal.aborted) return Promise.reject(createAbortError())

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(createAbortError())
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 解析一条 SSE 事件并分发
 * SSE 的格式是：
 *   event: delta
 *   data: {"text":"片段"}
 * 事件之间用空行分隔
 */
function dispatch(rawEvent, handlers = {}) {
  const lines = rawEvent.split('\n')
  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLine = lines.find((line) => line.startsWith('data:'))

  if (!eventLine || !dataLine) return

  const type = eventLine.slice(6).trim()
  let data

  try {
    data = JSON.parse(dataLine.slice(5).trim())
  } catch (err) {
    return
  }

  if (type === 'delta' && handlers.onDelta) {
    handlers.onDelta(data.text || '')
  } else if (type === 'meta' && handlers.onMeta) {
    handlers.onMeta(data)
  } else if (type === 'citations' && handlers.onCitations) {
    handlers.onCitations(data.citations || [])
  } else if (type === 'done' && handlers.onDone) {
    handlers.onDone(data)
  } else if (type === 'error' && handlers.onError) {
    handlers.onError(new Error(data.msg || '问答服务异常'))
  }
}

/** mock 实现：不联网，按固定节奏吐一段文本和引用，用来预览交互 */
async function mockAsk(question, handlers = {}, { signal } = {}) {
  if (signal && signal.aborted) throw createAbortError()

  const answer =
    '（mock 预览）这是本地假数据返回的回答，用来在没有后端时看交互效果。' +
    '接入真实接口后，这里会变成基于你博客内容生成的回答，并附带引用来源。'

  if (handlers.onMeta) {
    handlers.onMeta({ knowledge_mode: 'hybrid', blog_hit: true })
  }

  for (let i = 0; i < answer.length; i += 8) {
    await abortableDelay(40, signal)
    if (handlers.onDelta) handlers.onDelta(answer.slice(i, i + 8))
  }

  if (handlers.onCitations) {
    handlers.onCitations([
      { index: 1, article_id: 31, title: 'LangGraph 测试三大层级', headings: ['一、整图测试'] },
      { index: 2, article_id: 26, title: '一文读懂MCP理论', headings: ['四、核心重点'] },
    ])
  }

  if (handlers.onDone) handlers.onDone({ latency_ms: answer.length * 5, cached: false })

  return [null, null]
}

/**
 * 向博客提问
 *
 * 这里用原生 fetch 而不是项目里封装的 axios：
 * SSE 是流式响应，axios 在浏览器端不方便逐段读取，
 * fetch 的 response.body 可以直接拿 reader 一段段读。
 *
 * @param {string} question
 * @param {{ onMeta?, onDelta?, onCitations?, onDone?, onAbort?, onError? }} handlers
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<[Error|null, null]>} 沿用项目里 [err, res] 的约定
 */
export async function askBlog(question, handlers = {}, { signal } = {}) {
  try {
    if (USE_MOCK) {
      return await mockAsk(question, handlers, { signal })
    }

    const response = await fetch(`${BASE_URL}${ai.ask}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`请求失败（HTTP ${response.status}）`)
    }
    if (!response.body) {
      throw new Error('当前浏览器不支持流式响应')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 最后一段可能是半个事件，留到下一轮再拼
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      parts.forEach((part) => dispatch(part, handlers))
    }

    return [null, null]
  } catch (err) {
    if (isAbortError(err, signal)) {
      if (handlers.onAbort) handlers.onAbort()
      return [null, null]
    }

    if (handlers.onError) handlers.onError(err)
    return [err, null]
  }
}
