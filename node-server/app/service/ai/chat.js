/**
 * 生成层：拼 prompt、流式拿回答
 *
 * 这里采用「博客资料 + 通用技术补充」的混合知识模式：
 *   1. 博客里的观点必须可追溯，所以凡是用到资料内容就标注 [编号]
 *   2. 通用技术知识可以补充原理、例子、对比和取舍，但必须和博客资料分开
 *   3. 博客只覆盖问题的一部分时，先回答已有部分，再继续通用说明，不能整体拒答
 */
const config = require('../../../config/config')
const {
  fetchWithTimeout,
  createAbortError,
  throwIfAborted,
  isAbortError,
  abortableDelay
} = require('./http')

const SYSTEM_PROMPT = [
  '你是这个技术博客的资深技术问答编辑。你的任务不是复述几段资料，而是把技术问题讲清楚、讲完整。',
  '',
  '知识分为两层：',
  '1. 博客资料：只能转述「资料」中明确写出的内容。凡是采用资料事实的句子，在句末用 [编号] 标注；' +
    '编号只能使用资料里给出的编号，同一份资料始终使用同一个编号。',
  '2. 延伸说明：可以使用稳定、通用的技术知识，补充原理、代码例子、语言或方案对比、使用场景、优点和局限。' +
    '这里不要添加 [编号]，也不要用引用编号暗示内容来自博客。',
  '',
  '回答规则：',
  '- 先判断问题意图。概念题讲清定义、核心机制、最小示例、相关对比、使用场景、优点和局限；' +
    '操作题讲清目标、步骤、代码、常见坑和验证方式；对比题先给选择建议，再逐项比较。',
  '- 只展开与当前问题有关的章节，不要为了凑篇幅重复同一句话。默认给出足够解决问题的深度，而不是一句话概括。',
  '- 资料只能回答部分问题时，先写资料能支持的内容，再继续给通用说明，不要因为缺少对比、场景或优缺点就整体拒答。',
  '- 如果资料与问题无关，明确写「博客中没有找到直接相关内容」，然后继续给出通用技术说明。',
  '- 通用知识必须准确；不确定的 API、版本、性能数字或兼容性要明确说明，不得编造。',
  '- 强制使用下面的 Markdown 结构，让读者能区分两种来源：',
  '## 博客资料',
  '（只写博客资料直接支持的内容；没有相关内容就明确说明）',
  '## 延伸说明',
  '（用通用技术知识补充完整解释、例子、对比、场景和取舍）',
  '## 小结',
  '（用两三句话给出结论和选择建议）',
  '- 用中文回答；代码块标明语言；除非问题确实不需要，否则不要只给概念定义。'
].join('\n')

const MOCK_PREFIX = '（当前是 mock 模式，没有接入真实模型）根据检索到的资料 [1]，'
const MOCK_SUFFIX =
  '\n\n要得到真实回答，请在 .env 里把 AI_PROVIDER 换成 openai，并配置 AI_BASE_URL / AI_API_KEY / AI_CHAT_MODEL。'

/**
 * 拼资料块：一篇文章 = 一份资料 = 一个编号。
 *
 * 编号按「来源」而不是「切片」给——一篇匹配度高的文章常常被切出好几个段落，
 * 如果按切片编号，同一篇文章就会占掉 [1][2][3] 好几个号，
 * 读者会以为有好几份来源，而引用列表里只有一篇，看起来就对不上。
 */
function buildContextBlock(sources) {
  return sources
    .map((source) => {
      const header = `[${source.index}] 《${source.title || '未命名'}》`
      const body = source.chunks
        .map((chunk) => (chunk.heading_path ? `【${chunk.heading_path}】\n${chunk.content}` : chunk.content))
        .join('\n\n')
      return `${header}\n${body}`
    })
    .join('\n\n---\n\n')
}

function buildMessages({ question, sources }) {
  const context = sources.length
    ? `博客资料：\n\n${buildContextBlock(sources)}`
    : '博客资料：本次没有检索到与问题直接相关的内容。'

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${context}\n\n问题：${question}`
    }
  ]
}

/** 把长文本切成小块，用于模拟流式输出 */
function splitForStream(text, size = 14) {
  const pieces = []
  for (let i = 0; i < text.length; i += size) {
    pieces.push(text.slice(i, i + size))
  }
  return pieces
}

/**
 * mock 模式：不联网，用资料里的原文拼一个回答。
 * 目的是让前端和整条链路的联调不依赖任何付费服务。
 */
async function* mockStream(sources, signal) {
  throwIfAborted(signal)

  if (sources.length === 0) {
    const answer =
      '（当前是 mock 模式，没有接入真实模型）博客中没有检索到与问题直接相关的内容。' +
      '接入真实模型后，这里会继续给出通用技术说明，并明确与博客资料分开。'

    for (const piece of splitForStream(answer)) {
      await abortableDelay(25, signal)
      yield piece
    }
    return
  }

  const firstChunk = sources[0] && sources[0].chunks && sources[0].chunks[0]
  const first = String((firstChunk && firstChunk.content) || '').replace(/\s+/g, ' ').slice(0, 100)
  const answer = `${MOCK_PREFIX}${first}……${MOCK_SUFFIX}`

  for (const piece of splitForStream(answer)) {
    await abortableDelay(25, signal)
    yield piece
  }
}

/**
 * OpenAI 兼容协议的流式对话。
 * 返回体是 SSE，逐行读 `data: {...}`，把 choices[0].delta.content 吐出去。
 */
async function* openaiStream(candidate, messages, signal) {
  const { baseUrl, apiKey, model } = candidate
  const { timeoutMs } = config.ai

  if (!baseUrl) throw new Error('AI_BASE_URL 未配置，无法调用对话服务')
  if (!model) throw new Error('AI_CHAT_MODEL 未配置')

  const response = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.2
      })
    },
    timeoutMs,
    signal
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`对话服务返回 ${response.status}：${detail.slice(0, 200)}`)
  }

  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  const reader = response.body.getReader()
  const onAbort = () => {
    // fetch 已经返回响应头后，fetchWithTimeout 内部的控制器不再等待 body；
    // 这里主动取消 reader，才能让模型连接也随用户停止而结束。
    reader.cancel().catch(() => {})
  }

  if (signal) {
    if (signal.aborted) reader.cancel().catch(() => {})
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 以空行分隔事件；最后一段可能不完整，留到下一轮
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const dataLine = event.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue

        const payload = dataLine.slice(5).trim()
        if (payload === '[DONE]') return

        try {
          const json = JSON.parse(payload)
          const delta = json.choices && json.choices[0] && json.choices[0].delta
          if (delta && delta.content) yield delta.content
        } catch (err) {
          // 心跳行、非 JSON 行直接跳过
        }
      }
    }

    throwIfAborted(signal)
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }
}

/**
 * 流式生成回答
 * @param {{ question: string, sources: Array }} params
 * @returns {AsyncGenerator<string>} 逐段吐出回答文本
 */
async function* streamChat({ question, sources, signal }) {
  throwIfAborted(signal)

  if (config.ai.provider === 'mock') {
    yield* mockStream(sources, signal)
    return
  }

  const messages = buildMessages({ question, sources })
  const candidates = [config.ai.chat, ...config.ai.chatFallbacks]

  let lastError = null
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    let emitted = false

    try {
      for await (const delta of openaiStream(candidate, messages, signal)) {
        emitted = true
        yield delta
      }
      return
    } catch (err) {
      lastError = err

      // 用户主动停止时不再降级到备用模型，否则会重新开始一次付费请求。
      if (isAbortError(err, signal)) throw createAbortError()

      // 已经吐出内容就不能再降级：用户已经看到前半段，
      // 换个模型接着写会拼出前后不一致的回答，比直接报错更糟。
      if (emitted) throw err

      const next = candidates[index + 1]
      if (next) {
        console.warn(`[ai] ${candidate.model} 调用失败（${err.message}），降级到 ${next.model}`)
      }
    }
  }

  throw isAbortError(lastError, signal) ? createAbortError() : lastError
}

module.exports = {
  streamChat,
  buildMessages,
  buildContextBlock,
  splitForStream,
  SYSTEM_PROMPT
}
