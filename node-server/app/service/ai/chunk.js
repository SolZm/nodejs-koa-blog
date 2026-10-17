/**
 * 文章切片（chunking）
 *
 * 为什么按 Markdown 标题切、而不是按固定字数切：
 *   技术文章的结构本身就是语义单元。一段「在讲什么」由它所在的章节决定，
 *   按 500 字硬切会把「核心思路」和「代码示例」混进同一块，检索出来答非所问。
 *
 * 本文件是纯函数：输入 Markdown，输出切片数组，不碰数据库、不联网，因此可以直接单测。
 */
const crypto = require('crypto')

// 单个切片的目标上限（字符）。超过就拆，避免一块塞太多导致检索命中不精确
const MAX_CHARS = 800
// 下限（字符）。低于这个长度且能合并时，会并进相邻切片，避免产生「碎片块」
const MIN_CHARS = 100
// 相邻切片的重叠长度（字符）。防止一句话正好被切在边界上，两边都读不完整
const OVERLAP_CHARS = 50

/**
 * 第一步：把 Markdown 拆成「标题 / 代码块 / 普通文本」三种块。
 *
 * 关键点是**代码块必须整体识别**：代码里经常出现 `# 注释`，如果不先识别围栏，
 * 会被误当成标题，把一块完整的代码从中间劈开。
 */
function splitBlocks(markdown) {
  const lines = String(markdown || '').split('\n')
  const blocks = []
  let textBuffer = []

  const flushText = () => {
    if (textBuffer.length > 0) {
      blocks.push({ type: 'text', text: textBuffer.join('\n') })
      textBuffer = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块：``` 或 ~~~
    const fence = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      flushText()
      const marker = fence[1]
      const codeLines = [line]
      i++
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'fence', text: codeLines.join('\n') })
      continue
    }

    // 标题：# ~ ######
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushText()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      i++
      continue
    }

    textBuffer.push(line)
    i++
  }

  flushText()
  return blocks
}

/**
 * 第二步：按标题把块归入章节，并维护标题路径。
 * 例如遇到 ## 一、整图测试 再遇到 ### 核心思路，路径就是「一、整图测试 > 核心思路」。
 */
function toSections(blocks) {
  const sections = []
  const stack = [] // [{ level, title }]
  let current = null

  const ensureCurrent = () => {
    if (!current) {
      current = { headingPath: '', blocks: [] }
      sections.push(current)
    }
    return current
  }

  for (const block of blocks) {
    if (block.type === 'heading') {
      // 弹出层级不低于当前标题的祖先，再把当前标题压栈
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop()
      }
      stack.push({ level: block.level, title: block.text })

      current = {
        headingPath: stack.map((item) => item.title).join(' > '),
        blocks: []
      }
      sections.push(current)
      continue
    }

    ensureCurrent().blocks.push(block)
  }

  return sections
}

/**
 * 把章节里的块拆成可拼装的「最小单元」：代码块整体算一个单元，普通文本按空行分段。
 */
function toUnits(blocks) {
  const units = []

  for (const block of blocks) {
    if (block.type === 'fence') {
      units.push(block.text.trim())
      continue
    }
    block.text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => units.push(part))
  }

  return units
}

/**
 * 第三步：把单元按上限拼成切片。
 * 单个单元本身就超长时（比如一大段代码）不硬切，让它单独成块——
 * 从中间切断代码的代价，比这一块稍微大一点更糟。
 */
function packUnits(units) {
  const chunks = []
  let current = ''

  for (const unit of units) {
    if (current && current.length + unit.length + 2 > MAX_CHARS) {
      chunks.push(current)
      current = unit
    } else {
      current = current ? current + '\n\n' + unit : unit
    }
  }

  if (current) chunks.push(current)
  return chunks
}

/**
 * 第四步：把过短的切片并进相邻切片，避免碎片。
 * 合并时会放宽到 MAX_CHARS 的 1.5 倍，否则「刚好差一点」的块永远合不上。
 *
 * 分两遍做：
 *   第一遍向后合——并进前一块，保留前一块的标题路径；
 *   第二遍向前合——处理第一遍合不掉的（章节的第一块，或前一块已经太满），
 *   否则会留下一批几十个字的碎片，向量化之后几乎是噪声。
 */
function mergeSmallChunks(chunks) {
  const backward = []

  for (const chunk of chunks) {
    const prev = backward[backward.length - 1]
    const canMerge =
      prev &&
      chunk.content.length < MIN_CHARS &&
      prev.content.length + chunk.content.length <= MAX_CHARS * 1.5

    if (canMerge) {
      prev.content = prev.content + '\n\n' + chunk.content
    } else {
      backward.push({ headingPath: chunk.headingPath, content: chunk.content })
    }
  }

  const result = []
  for (let i = 0; i < backward.length; i++) {
    const chunk = backward[i]
    const next = backward[i + 1]
    const canMergeForward =
      next &&
      chunk.content.length < MIN_CHARS &&
      chunk.content.length + next.content.length <= MAX_CHARS * 1.5

    if (canMergeForward) {
      // 并进后一块，标题路径沿用后一块的（更能代表合并后的内容）
      next.content = chunk.content + '\n\n' + next.content
    } else {
      result.push(chunk)
    }
  }

  return result
}

/**
 * 第五步：给相邻切片加重叠尾巴。
 * 只在同一章节内做重叠——跨章节拼进来的内容会污染语义。
 */
function addOverlap(chunks) {
  return chunks.map((chunk, index) => {
    if (index === 0 || OVERLAP_CHARS <= 0) return chunk

    const prev = chunks[index - 1]
    if (prev.headingPath !== chunk.headingPath) return chunk
    if (prev.content.length <= OVERLAP_CHARS) return chunk

    const tail = prev.content.slice(-OVERLAP_CHARS)
    return { headingPath: chunk.headingPath, content: tail + '\n\n' + chunk.content }
  })
}

/**
 * 主入口：把一篇文章切成若干带标题路径的切片
 * @param {{ title?: string, content: string }} article
 * @returns {Array<{ chunkIndex: number, headingPath: string, content: string, charLen: number }>}
 */
function chunkArticle(article = {}) {
  const blocks = splitBlocks(article.content)
  const sections = toSections(blocks)

  const raw = []
  for (const section of sections) {
    for (const content of packUnits(toUnits(section.blocks))) {
      raw.push({ headingPath: section.headingPath, content })
    }
  }

  const merged = mergeSmallChunks(raw)
  const overlapped = addOverlap(merged)

  return overlapped.map((chunk, index) => ({
    chunkIndex: index,
    headingPath: chunk.headingPath,
    content: chunk.content,
    charLen: chunk.content.length
  }))
}

/**
 * 拼出用于生成向量的文本。
 *
 * 为什么不直接拿 content 去向量化：标题承载了大量语义信息。
 * 「一、整图测试 > 核心思路」这几个字能让向量更贴近「怎么测整图」这类提问，
 * 只把这段内容单独拿去编码就会丢掉这层上下文。
 */
function buildEmbeddingText({ title, headingPath, content }) {
  return [title, headingPath, content].filter(Boolean).join('\n')
}

/**
 * 切片正文的 sha256，用于增量索引：内容没变就不必重新花token向量化。
 */
function contentHash(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex')
}

module.exports = {
  chunkArticle,
  buildEmbeddingText,
  contentHash,
  splitBlocks,
  toSections,
  MAX_CHARS,
  MIN_CHARS,
  OVERLAP_CHARS
}
