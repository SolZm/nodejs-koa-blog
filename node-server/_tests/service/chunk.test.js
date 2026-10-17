const {
  chunkArticle,
  buildEmbeddingText,
  contentHash,
  MAX_CHARS,
  OVERLAP_CHARS
} = require('@service/ai/chunk')

test('代码块里的 # 不会被误当成标题，代码块也不会被从中间切断', () => {
  const markdown = [
    '## 代码示例',
    '',
    '```js',
    '// # 这行看着像标题，其实是注释',
    'const answer = 42',
    '```',
    '',
    '后面这段是正常说明文字，用来把这一块撑过最小长度，避免被合并逻辑吃掉后看不出问题。'
  ].join('\n')

  const chunks = chunkArticle({ title: '测试文章', content: markdown })

  expect(chunks).toHaveLength(1)
  expect(chunks[0].headingPath).toBe('代码示例')
  expect(chunks[0].content).toContain('// # 这行看着像标题，其实是注释')
  expect(chunks[0].content).toContain('const answer = 42')
})

test('标题路径按层级拼接；遇到同级标题时替换而不是累加', () => {
  const markdown = [
    '## 一级',
    '',
    'a'.repeat(120),
    '',
    '### 二级',
    '',
    'b'.repeat(120),
    '',
    '## 另一个一级',
    '',
    'c'.repeat(120)
  ].join('\n')

  const chunks = chunkArticle({ content: markdown })

  expect(chunks.map((c) => c.headingPath)).toEqual(['一级', '一级 > 二级', '另一个一级'])
})

test('超长章节会拆成多块，且不会超过上限（含重叠部分）', () => {
  const paragraph = 'x'.repeat(300)
  const markdown = '## 长章节\n\n' + [paragraph, paragraph, paragraph, paragraph].join('\n\n')

  const chunks = chunkArticle({ content: markdown })

  expect(chunks.length).toBeGreaterThan(1)
  chunks.forEach((chunk) => {
    expect(chunk.charLen).toBeLessThanOrEqual(MAX_CHARS + OVERLAP_CHARS)
  })
})

test('过短的内容会被合并，不产生碎片块', () => {
  const markdown = '## 短章节\n\n短句一。\n\n短句二。'

  const chunks = chunkArticle({ content: markdown })

  expect(chunks).toHaveLength(1)
  expect(chunks[0].content).toContain('短句一。')
  expect(chunks[0].content).toContain('短句二。')
})

test('只有标题、没有正文的章节不会产生空切片', () => {
  const markdown = ['## 空章节', '', '## 有内容的章节', '', 'd'.repeat(150)].join('\n')

  const chunks = chunkArticle({ content: markdown })

  expect(chunks).toHaveLength(1)
  expect(chunks[0].headingPath).toBe('有内容的章节')
})

test('contentHash 稳定，且内容变化时会变', () => {
  expect(contentHash('同一段内容')).toBe(contentHash('同一段内容'))
  expect(contentHash('同一段内容')).not.toBe(contentHash('另一段内容'))
})

test('buildEmbeddingText 把文章标题和标题路径拼进待向量化的文本', () => {
  const text = buildEmbeddingText({
    title: '文章标题',
    headingPath: '一章 > 二节',
    content: '正文'
  })

  expect(text).toBe('文章标题\n一章 > 二节\n正文')
})
