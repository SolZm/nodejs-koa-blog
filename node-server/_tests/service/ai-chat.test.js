const {
  buildMessages,
  buildContextBlock,
  SYSTEM_PROMPT,
  streamChat
} = require('@service/ai/chat')
const { abortableDelay } = require('@service/ai/http')
const { createTestAbortController } = require('./abort-controller')

const sources = [
  {
    index: 1,
    title: 'JavaScript New 原理',
    chunks: [
      {
        heading_path: '对象创建',
        content: 'new 会创建对象、绑定原型并执行构造函数。'
      }
    ]
  }
]

test('混合知识提示词要求博客资料与通用补充分开输出', () => {
  expect(SYSTEM_PROMPT).toContain('## 博客资料')
  expect(SYSTEM_PROMPT).toContain('## 延伸说明')
  expect(SYSTEM_PROMPT).toContain('这里不要添加 [编号]')
  expect(SYSTEM_PROMPT).toContain('不要因为缺少对比、场景或优缺点就整体拒答')
})

test('有博客命中时，用户消息携带编号、标题和正文', () => {
  const messages = buildMessages({ question: 'new 做了什么？', sources })
  const userMessage = messages.find((item) => item.role === 'user').content

  expect(userMessage).toContain('博客资料：')
  expect(userMessage).toContain('[1] 《JavaScript New 原理》')
  expect(userMessage).toContain('【对象创建】')
  expect(userMessage).toContain('问题：new 做了什么？')
})

test('没有博客命中时仍允许生成通用技术说明', () => {
  const messages = buildMessages({ question: 'JavaScript 是什么？', sources: [] })
  const userMessage = messages.find((item) => item.role === 'user').content

  expect(userMessage).toContain('本次没有检索到与问题直接相关的内容')
  expect(userMessage).toContain('问题：JavaScript 是什么？')
})

test('多篇文章按来源编号拼成独立资料块', () => {
  const context = buildContextBlock([
    ...sources,
    {
      index: 2,
      title: '语言对比',
      chunks: [{ heading_path: '', content: 'JavaScript 是动态类型语言。' }]
    }
  ])

  expect(context).toContain('[1] 《JavaScript New 原理》')
  expect(context).toContain('[2] 《语言对比》')
  expect(context).toContain('\n\n---\n\n')
})

test('已取消的信号会在生成开始前终止回答', async () => {
  const controller = createTestAbortController()
  controller.abort()

  const generator = streamChat({
    question: 'JavaScript 是什么？',
    sources: [],
    signal: controller.signal
  })

  await expect(generator.next()).rejects.toMatchObject({ name: 'AbortError' })
})

test('可取消延时不会在用户停止后继续等待', async () => {
  const controller = createTestAbortController()
  const waiting = abortableDelay(5000, controller.signal)
  controller.abort()

  await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
})
