<template>
  <div class="ask-blog">
    <el-drawer
      title="问博客"
      :visible.sync="$askBlog.visible"
      :size="drawerSize"
      direction="rtl"
      :append-to-body="true"
      custom-class="ask-blog-drawer"
    >
      <div class="ask-blog-main">
        <div ref="body" class="ask-blog-body" @scroll.passive="handleBodyScroll">
          <!-- 空状态：给几个示例问题，降低第一次使用的门槛 -->
          <div v-if="messages.length === 0" class="ask-blog-hello">
            <p class="ask-blog-hello-title">可以这样问：</p>
            <p class="ask-blog-hello-note">
              回答会区分博客资料与通用技术补充；没有相关文章时也会继续给出技术说明。
            </p>
            <div
              v-for="item in examples"
              :key="item"
              class="ask-blog-example"
              @click="question = item"
            >
              {{ item }}
            </div>
          </div>

          <div
            v-for="(message, index) in messages"
            :key="index"
            class="ask-blog-msg"
            :class="'is-' + message.role"
          >
            <!-- 等到第一段文字之前，先给个明确的等待反馈 -->
            <div v-if="message.pending" class="ask-blog-bubble ask-blog-bubble--pending">
              <span class="ask-blog-dot" />
              <span class="ask-blog-dot" />
              <span class="ask-blog-dot" />
              <span class="ask-blog-typing-text">正在检索并生成…</span>
            </div>
            <!-- 模型的回答是 Markdown，要渲染出来，不能当纯文本显示 -->
            <div v-else-if="message.role === 'assistant'" class="ask-blog-answer">
              <div v-if="message.knowledgeMode" class="ask-blog-knowledge">
                <span class="ask-blog-knowledge-dot" />
                {{ knowledgeLabel(message) }}
              </div>
              <div
                class="ask-blog-bubble ask-blog-bubble--md"
                v-html="renderMarkdown(message.text)"
              />
              <div v-if="message.stopped" class="ask-blog-stopped">已停止生成</div>
            </div>
            <div v-else class="ask-blog-bubble">{{ message.text }}</div>

            <div v-if="message.citations && message.citations.length" class="ask-blog-citations">
              <a
                v-for="citation in message.citations"
                :key="citation.article_id"
                class="ask-blog-citation"
                :href="'/article/detail?id=' + citation.article_id"
                target="_blank"
              >
                <div class="ask-blog-citation-head">
                  <span class="ask-blog-citation-index">[{{ citation.index }}]</span>
                  <span class="ask-blog-citation-title">{{ citation.title }}</span>
                </div>
                <div class="ask-blog-citation-paths">
                  <span
                    v-for="(heading, headingIndex) in citation.headings.slice(0, 3)"
                    :key="headingIndex"
                    class="ask-blog-citation-path"
                  >
                    {{ heading }}
                  </span>
                  <span v-if="citation.headings.length > 3" class="ask-blog-citation-more">
                    等 {{ citation.headings.length }} 处
                  </span>
                </div>
              </a>
            </div>
          </div>
        </div>

        <button
          v-if="!followLatest"
          type="button"
          class="ask-blog-jump"
          aria-label="回到最新回答"
          @click="jumpToLatest"
        >
          <span>回答更新中，回到最新</span>
          <i class="el-icon-bottom" />
        </button>

        <form class="ask-blog-input" @submit.prevent="handleSubmit">
          <el-input
            v-model="question"
            placeholder="问点技术问题，或查找博客里的内容…"
            :disabled="loading"
            maxlength="200"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          />
          <button
            v-if="loading"
            type="button"
            class="ask-blog-stop"
            :class="{ 'is-stopping': stopping }"
            aria-label="停止生成"
            @click="stopAnswer"
          >
            <span class="ask-blog-stop-tip">停止</span>
            <span class="ask-blog-stop-square" />
          </button>
          <el-button
            v-else
            class="ask-blog-send"
            type="primary"
            native-type="submit"
            :disabled="!question.trim()"
          >
            发送
          </el-button>
        </form>
      </div>
    </el-drawer>
  </div>
</template>

<script>
import { askBlog, USE_MOCK } from '@/request/api/ai'

export default {
  name: 'AskBlog',
  data() {
    return {
      question: '',
      loading: false,
      stopping: false,
      messages: [],
      isNarrow: false,
      isComposing: false,
      compositionEndedAt: 0,
      followLatest: true,
      examples: [
        'JavaScript 是什么，和其他语言有什么区别？',
        'LangGraph 的测试有哪几种方式？',
        '怎么封装 axios 请求？',
        'MCP 是什么？',
        '组件之间怎么松耦合地通信？',
        'cookie、session 和 token 有什么区别？',
      ],
    }
  },
  computed: {
    // 窄屏时抽屉占满宽度，免得内容被挤得没法看
    drawerSize() {
      return this.isNarrow ? '100%' : '520px'
    },
    isMock() {
      return USE_MOCK
    },
  },
  created() {
    // AbortController 只用于控制当前请求，不需要参与响应式渲染
    this.abortController = null
  },
  mounted() {
    this.updateViewport()
    window.addEventListener('resize', this.updateViewport)
  },
  beforeDestroy() {
    this.stopAnswer()
    window.removeEventListener('resize', this.updateViewport)
  },
  methods: {
    updateViewport() {
      this.isNarrow = window.innerWidth < 560
    },
    knowledgeLabel(message) {
      return message.blogHit
        ? '博客资料 + 通用技术补充'
        : '通用技术说明 · 博客中没有直接相关内容'
    },
    handleBodyScroll() {
      const body = this.$refs.body
      if (!body) return

      // 留一点容差，避免用户只是轻微滚动、或者浏览器像素取整时
      // 把“仍在底部”误判成“已经离开底部”。
      const distanceToBottom = body.scrollHeight - body.scrollTop - body.clientHeight
      this.followLatest = distanceToBottom <= 48
    },
    jumpToLatest() {
      this.followLatest = true
      this.scrollToBottom(true)
    },
    stopAnswer() {
      if (!this.loading || !this.abortController) return
      if (this.abortController.signal.aborted) return

      this.stopping = true
      this.abortController.abort()
    },
    handleCompositionStart() {
      this.isComposing = true
    },
    handleCompositionEnd() {
      this.isComposing = false
      this.compositionEndedAt = Date.now()
    },
    handleSubmit() {
      // 部分浏览器会在 compositionend 之后才派发表单提交。
      // 给紧随组合结束的提交留一个短暂窗口，确保候选词先写入输入框。
      if (this.isComposing || Date.now() - this.compositionEndedAt < 100) return
      this.submit()
    },
    /**
     * 渲染模型返回的 Markdown。
     *
     * 顺带做了一件事：把正文里的引用编号 [1][2] 包成带样式的 span，让它显眼一点。
     *
     * 为什么不直接对渲染后的 HTML 做正则替换：那样会误伤代码里的 arr[1]、params[0]。
     * 正确做法是先解析成 token 再动手——只有 text 类型的 token 属于「正文」，
     * 代码块和行内代码分别在 fence / code_inline 里，天然不会被碰到。
     *
     * 安全性：这里用的是 v-html，所以必须确认渲染器会转义原始 HTML——
     * plugins/md.js 里的 markdown-it 没有开 html 选项（默认 false），
     * 源码中的 <script> 之类会被转义成文本，不会被执行。
     * 下面插入的 html_inline 是我们自己拼的固定标签，不含任何用户内容。
     */
    renderMarkdown(text) {
      const md = this.$md
      if (!md || !text) return text

      const tokens = md.parse(text, {})
      const CITE = /\[(\d{1,2})\]/g

      tokens.forEach((token) => {
        if (token.type !== 'inline' || !Array.isArray(token.children)) return

        const rebuilt = []
        token.children.forEach((child) => {
          if (child.type !== 'text') {
            rebuilt.push(child)
            return
          }

          let cursor = 0
          let match
          CITE.lastIndex = 0

          while ((match = CITE.exec(child.content)) !== null) {
            if (match.index > cursor) {
              rebuilt.push({
                type: 'text',
                content: child.content.slice(cursor, match.index),
                level: child.level,
              })
            }
            rebuilt.push({
              type: 'html_inline',
              content: `<span class="ask-cite">${match[0]}</span>`,
              level: child.level,
            })
            cursor = match.index + match[0].length
          }

          if (cursor < child.content.length) {
            rebuilt.push({
              type: 'text',
              content: child.content.slice(cursor),
              level: child.level,
            })
          }
        })

        token.children = rebuilt
      })

      return md.renderer.render(tokens, md.options, {})
    },
    async submit() {
      const question = this.question.trim()
      if (!question || this.loading) return

      const controller = new AbortController()
      this.abortController = controller
      this.loading = true
      this.stopping = false
      this.question = ''
      this.messages.push({ role: 'user', text: question })

      // 先把助手这条消息推进数组，后面的流式增量直接写在它身上
      // pending 为真时显示「正在检索并生成…」，收到第一段文字后关掉
      const answer = {
        role: 'assistant',
        text: '',
        citations: [],
        pending: true,
        stopped: false,
        knowledgeMode: '',
        blogHit: false,
      }
      this.messages.push(answer)
      // 新问题提交时明确跟随最新回答；用户随后向上滚动，会自动停止跟随。
      this.followLatest = true
      this.scrollToBottom(true)

      const [err] = await askBlog(
        question,
        {
          onMeta: (meta) => {
            answer.knowledgeMode = meta.knowledge_mode || 'hybrid'
            answer.blogHit = Boolean(meta.blog_hit)
            this.scrollToBottom()
          },
          onDelta: (text) => {
            answer.pending = false
            answer.text += text
            this.scrollToBottom()
          },
          onCitations: (citations) => {
            answer.pending = false
            answer.citations = citations
            if (!answer.knowledgeMode) {
              answer.knowledgeMode = 'hybrid'
              answer.blogHit = citations.length > 0
            }
            this.scrollToBottom()
          },
          onAbort: () => {
            answer.pending = false
            answer.stopped = true
            if (!answer.text) answer.text = '已停止生成。'
            this.scrollToBottom()
          },
          onError: (error) => {
            answer.pending = false
            // 已经吐了一部分内容就保留，只在完全没内容时换成错误提示
            if (!answer.text) {
              answer.knowledgeMode = ''
              answer.text = `出错了：${error.message}`
            }
          },
        },
        { signal: controller.signal }
      )

      answer.pending = false
      if (err && !answer.text) {
        answer.text = `出错了：${err.message}`
      }

      this.abortController = null
      this.loading = false
      this.stopping = false
      this.scrollToBottom()
    },
    scrollToBottom(force = false) {
      if (!force && !this.followLatest) return

      this.$nextTick(() => {
        const body = this.$refs.body
        if (!body) return
        if (!force && !this.followLatest) return

        body.scrollTop = body.scrollHeight
        this.followLatest = true
      })
    },
  },
}
</script>

<style scoped lang="scss">
.ask-blog-main {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ask-blog-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px;
}

.ask-blog-jump {
  position: absolute;
  right: 22px;
  bottom: 68px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  color: var(--c-text-2);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;

  &:hover {
    border-color: var(--c-accent);
    color: var(--c-accent-deep);
  }
}

.ask-blog-hello {
  padding-top: 16px;
}

.ask-blog-hello-title {
  margin-bottom: 6px;
  color: var(--c-text-3);
  font-size: 13px;
}

.ask-blog-hello-note {
  margin-bottom: 12px;
  color: var(--c-text-3);
  font-size: 12px;
  line-height: 19px;
}

.ask-blog-example {
  display: inline-block;
  margin: 0 8px 8px 0;
  padding: 8px 16px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: var(--c-accent-soft);
    color: var(--c-accent-deep);
  }
}

.ask-blog-msg {
  margin-bottom: 16px;

  &.is-user {
    text-align: right;

    .ask-blog-bubble {
      display: inline-block;
      text-align: left;
      background: var(--c-ink);
      color: #fff;
    }
  }
}

.ask-blog-answer {
  text-align: left;
}

.ask-blog-knowledge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px 2px;
  color: var(--c-text-3);
  font-size: 11px;
  line-height: 16px;
}

.ask-blog-knowledge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-accent);
}

.ask-blog-stopped {
  margin-top: 6px;
  color: var(--c-text-3);
  font-size: 11px;
  line-height: 16px;
}

.ask-blog-bubble {
  padding: 12px 16px;
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 等待模型返回时的三个跳动小点 */
.ask-blog-bubble--pending {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 回答是 Markdown 渲染出来的，把里面的排版收拾干净 */
.ask-blog-bubble--md {
  white-space: normal;

  ::v-deep p {
    margin: 0 0 8px;
  }

  ::v-deep > :last-child {
    margin-bottom: 0;
  }

  ::v-deep h1,
  ::v-deep h2,
  ::v-deep h3,
  ::v-deep h4 {
    margin: 14px 0 6px;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  ::v-deep > h1:first-child,
  ::v-deep > h2:first-child,
  ::v-deep > h3:first-child {
    margin-top: 0;
  }

  ::v-deep ul,
  ::v-deep ol {
    margin: 0 0 8px;
    padding-left: 20px;
  }

  ::v-deep li {
    margin-bottom: 3px;
  }

  ::v-deep hr {
    margin: 12px 0;
    border: none;
    border-top: 1px solid var(--c-line);
  }

  ::v-deep code {
    padding: 1px 6px;
    border-radius: 6px;
    /* 气泡本身是浅灰底，代码再用浅灰就看不出边界了，所以给白底 + 描边 */
    background: var(--c-bg);
    border: 1px solid var(--c-line);
    font-size: 12px;
  }

  ::v-deep pre {
    margin: 10px 0;
    padding: 12px 14px;
    border-radius: var(--r-sm);
    background: var(--c-bg);
    border: 1px solid var(--c-line);
    overflow-x: auto;
  }

  ::v-deep pre code {
    padding: 0;
    background: none;
  }

  ::v-deep blockquote {
    margin: 8px 0;
    padding: 2px 0 2px 10px;
    border-left: 2px solid var(--c-accent);
    color: var(--c-text-2);
  }

  ::v-deep table {
    margin: 8px 0;
    border-collapse: collapse;
    font-size: 12px;
  }

  /* 正文里的引用编号，做成小胶囊，跟头部的 AI 入口用同一套配色 */
  ::v-deep .ask-cite {
    display: inline-block;
    margin: 0 1px;
    padding: 0 5px;
    border-radius: 5px;
    background: var(--c-accent-soft);
    color: var(--c-accent-deep);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
  }

  ::v-deep th,
  ::v-deep td {
    padding: 4px 8px;
    border: 1px solid var(--c-line);
  }
}

.ask-blog-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-text-3);
  animation: ask-blog-blink 1.2s infinite ease-in-out both;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

.ask-blog-typing-text {
  margin-left: 6px;
  color: var(--c-text-3);
  font-size: 13px;
}

@keyframes ask-blog-blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }

  40% {
    opacity: 1;
  }
}

.ask-blog-citations {
  margin-top: 10px;
}

.ask-blog-citation {
  display: block;
  margin-bottom: 6px;
  padding: 10px 12px;
  border: 1px solid var(--c-line);
  border-left: 2px solid var(--c-accent);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  background: var(--c-bg);
  text-decoration: none;

  &:hover {
    background: var(--c-accent-soft);
  }
}

.ask-blog-citation-index {
  color: var(--c-accent-deep);
  font-size: 12px;
  white-space: nowrap;
}

.ask-blog-citation-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ask-blog-citation-title {
  color: var(--c-text);
  font-size: 13px;
}

.ask-blog-citation-paths {
  margin-top: 4px;
}

.ask-blog-citation-path {
  display: block;
  color: var(--c-text-3);
  font-size: 12px;
  line-height: 18px;
}

.ask-blog-citation-more {
  color: var(--c-text-3);
  font-size: 12px;
}

.ask-blog-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--c-line);
}

.ask-blog-send.is-disabled,
.ask-blog-send.is-disabled:hover,
.ask-blog-send.is-disabled:focus {
  border-color: var(--c-line);
  background: var(--c-surface);
  color: var(--c-text-3);
  opacity: 1;
  cursor: not-allowed;
}

.ask-blog-stop {
  position: relative;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--c-ink);
  cursor: pointer;
  transition: background 0.18s ease, opacity 0.18s ease, transform 0.18s ease;

  &:hover {
    background: var(--c-ink-hover);
  }

  &:active {
    transform: scale(0.96);
  }

  &.is-stopping {
    cursor: default;
    opacity: 0.72;
  }
}

.ask-blog-stop-square {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 13px;
  height: 13px;
  border: 2px solid #fff;
  border-radius: 2px;
  transform: translate(-50%, -50%);
}

.ask-blog-stop-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  z-index: 3;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--c-ink);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;

  &::after {
    position: absolute;
    top: 100%;
    left: 50%;
    width: 0;
    height: 0;
    border-top: 6px solid var(--c-ink);
    border-right: 5px solid transparent;
    border-left: 5px solid transparent;
    content: '';
    transform: translateX(-50%);
  }
}

.ask-blog-stop:hover .ask-blog-stop-tip,
.ask-blog-stop:focus-visible .ask-blog-stop-tip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

</style>

<style lang="scss">
/* el-drawer 挂到 body 上，抽屉内部的布局要用非 scoped 样式控制 */
.ask-blog-drawer {
  .el-drawer__body {
    overflow: hidden;
    padding: 0;
  }
}
</style>
