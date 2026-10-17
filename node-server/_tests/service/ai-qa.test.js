jest.mock('@service/ai/retrieval', () => ({
  retrieve: jest.fn()
}))

jest.mock('@service/ai/chat', () => ({
  streamChat: jest.fn(),
  splitForStream: (text) => [text]
}))

jest.mock('@dao/article', () => ({
  ArticleDao: {
    listTitlesByIds: jest.fn()
  }
}))

jest.mock('@dao/ai-query-log', () => ({
  AiQueryLogDao: {
    record: jest.fn().mockResolvedValue(null)
  }
}))

const { retrieve } = require('@service/ai/retrieval')
const { streamChat } = require('@service/ai/chat')
const { ArticleDao } = require('@dao/article')
const { ask, clearAnswerCache } = require('@service/ai/qa')
const { createTestAbortController } = require('./abort-controller')

async function collect(question, options) {
  const events = []
  for await (const event of ask(question, options)) events.push(event)
  return events
}

beforeEach(() => {
  clearAnswerCache()
  jest.clearAllMocks()
})

test('没有博客命中时仍生成通用回答，并返回空引用', async () => {
  retrieve.mockResolvedValue({
    chunks: [],
    meta: { topScore: 0 }
  })
  streamChat.mockImplementation(() =>
    (async function* () {
      yield '## 博客资料\n没有直接相关内容。\n\n'
      yield '## 延伸说明\nJavaScript 是一门动态类型语言。'
    })()
  )

  const events = await collect('JavaScript 是什么？')

  expect(events[0]).toEqual({
    type: 'meta',
    meta: { knowledge_mode: 'hybrid', blog_hit: false }
  })
  expect(events.filter((event) => event.type === 'delta').map((event) => event.text).join('')).toContain(
    '## 延伸说明'
  )
  expect(events.find((event) => event.type === 'citations').citations).toEqual([])
  expect(streamChat).toHaveBeenCalledWith({ question: 'JavaScript 是什么？', sources: [] })
  expect(ArticleDao.listTitlesByIds).not.toHaveBeenCalled()
})

test('博客命中时把文章作为带编号来源传给生成层', async () => {
  retrieve.mockResolvedValue({
    chunks: [
      {
        article_id: 18,
        heading_path: '对象创建',
        content: 'new 会创建对象并绑定原型。'
      }
    ],
    meta: { topScore: 0.82 }
  })
  ArticleDao.listTitlesByIds.mockResolvedValue({ 18: 'JavaScript New 原理' })
  streamChat.mockImplementation(() =>
    (async function* () {
      yield '### 回答\nnew 会创建对象 [1]。'
    })()
  )

  const events = await collect('new 做了什么？')
  const citationsEvent = events.find((event) => event.type === 'citations')

  expect(events[0].meta).toEqual({ knowledge_mode: 'hybrid', blog_hit: true })
  expect(streamChat.mock.calls[0][0].sources).toEqual([
    expect.objectContaining({
      index: 1,
      article_id: 18,
      title: 'JavaScript New 原理',
      headings: ['对象创建']
    })
  ])
  expect(citationsEvent.citations).toEqual([
    {
      index: 1,
      article_id: 18,
      title: 'JavaScript New 原理',
      headings: ['对象创建']
    }
  ])
})

test('用户停止后不再启动检索或模型生成', async () => {
  const controller = createTestAbortController()
  controller.abort()

  await expect(collect('JavaScript 是什么？', { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError'
  })
  expect(retrieve).not.toHaveBeenCalled()
  expect(streamChat).not.toHaveBeenCalled()
})
