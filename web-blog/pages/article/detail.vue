<template>
  <div>
    <Header />

    <div class="article">
      <h1 class="title">
        {{ article.title }}
      </h1>
      <div class="description">
        {{ article.description }}
      </div>
      <div class="info">
        <el-avatar size="small" icon="el-icon-user-solid"></el-avatar>
        <span v-if="article.category_info" class="category">
          {{ article.category_info.name }}
        </span>
        <span class="created-at">{{ article.created_at }}</span>
        <span class="comment-count" @click="onShowComment">
          <i class="el-icon-chat-round">评论 {{ article.comment_count }}</i>
        </span>
      </div>
      <!--
        文章内容在服务端就已经用 markdown-it 渲染成 HTML 了（接口带 is_markdown: true），
        前端只需要显示 + 配样式，不需要一个 Markdown 编辑器。

        这里原本用的是 mavon-editor（一个完整的编辑器组件），代价有两个：
          1. 它被注册成全局插件，导致首页也要下载约 1MB 的编辑器代码
          2. 它给容器设了 z-index: 1500，比吸顶头部的 99 高，正文会盖住头部
      -->
      <div class="markdown-body" v-html="article.content" />
    </div>

    <div class="fixed-sidebar">
      <div class="fixed-comment">
        <i class="el-icon-chat-round" @click="onShowComment"></i>
      </div>
      <div class="fixed-scroll-top">
        <i class="el-icon-top" @click="scrollTop"></i>
      </div>
    </div>

    <div class="comment">
      <div class="comment-header">评论：</div>
      <div class="comment-textarea">
        <textarea
          ref="textarea"
          class="comment-content"
          placeholder="请输入内容，支持 Markdown 语法.."
          @focus="onCommentFocus"
        />
      </div>
    </div>

    <Comment ref="comment" />
    <Footer />

  </div>
</template>
<script>

import { getArticleDetail } from '@/request/api/article'

import Comment from '@/components/Comment'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default {
  name: 'ArticleDetail',
  components: {
    Comment,
    Header,
    Footer,
  },
  async asyncData(context) {
    const { id } = context.query
    const params = {
      id,
      is_markdown: true,
    }
    const [err, res] = await getArticleDetail(params)
    if (!err) {
      return {
        article: res.data.data
      }
    }
  },
  async fetch({ store }) {
    await store.dispatch('category/getCategoryData')
  },
  head() {
    const article = this.article || {}
    return {
      // 带上站点名，保持浏览器 tab 里始终能看到「博客」；
      // 文章名留在前面，多开几个 tab 时还能互相区分
      title: article.title ? `${article.title} - 博客` : '博客',
      meta: [
        { name: 'keywords', content: article.seo_keyword },
        { name: 'description', content: article.description },
      ],
    }
  },
  methods: {
    // 回到顶部
    scrollTop() {
      this.$scrollTo(0)
    },
    // 展开评论
    onCommentFocus() {
      this.$refs.textarea.blur()
      this.$nextTick(() => {
        this.onShowComment()
      })
    },
    // 点击展开评论
    onShowComment() {
      this.$refs.comment && this.$refs.comment.onShowComment()
    }
  }
}
</script>
<style>
/*
.mavonEditor ul li{
  list-style: disc;
} */
</style>
<style scoped lang="scss">
.article {
  /*
   * 阅读宽度 840 → 760。
   * 字号从 15 提到 16、行高提到 1.9 之后，840 一行会太长（每行字数过多，
   * 眼睛换行时容易串行），收窄一档反而更好读。
   */
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-read);
  margin: 0 auto;
  padding: 0 32px;
}

/*
 * 文章正文的排版。
 * 内容来自 v-html（没有 scoped 属性），所以要用 ::v-deep 才能作用到子元素。
 * 这些样式原本由 mavon-editor 提供，换成自己写之后少了一个约 1MB 的依赖。
 */
.markdown-body {
  margin-top: 40px;
  color: var(--c-text);
  font-size: 16px;
  /* 1.8 → 1.9：参考站那种大留白的气质，正文靠行高和段距撑着 */
  line-height: 1.9;
  word-break: break-word;

  ::v-deep h1,
  ::v-deep h2,
  ::v-deep h3,
  ::v-deep h4 {
    margin: 44px 0 16px;
    color: var(--c-text);
    /* 600 → 700，和列表页标题统一 */
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.4;
  }

  /*
   * h2 原来带一条 border-bottom。参考站的分区靠留白和字号差，
   * 一条条横线堆起来会让长文显得很碎，所以改成只拉开上边距。
   */
  ::v-deep h2 {
    font-size: 26px;
  }

  ::v-deep h3 {
    font-size: 20px;
  }

  ::v-deep h4 {
    font-size: 17px;
  }

  ::v-deep p {
    margin: 18px 0;
  }

  ::v-deep ul,
  ::v-deep ol {
    margin: 18px 0;
    padding-left: 26px;
  }

  ::v-deep ul {
    list-style: disc;
  }

  ::v-deep ol {
    list-style: decimal;
  }

  ::v-deep li {
    margin-bottom: 8px;
  }

  ::v-deep a {
    color: var(--c-accent-deep);
    text-decoration: none;
    border-bottom: 1px solid var(--c-accent-soft);

    &:hover {
      border-bottom-color: var(--c-accent);
    }
  }

  ::v-deep code {
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--c-surface);
    color: var(--c-text);
    font-size: 14px;
  }

  ::v-deep pre {
    margin: 24px 0;
    border-radius: var(--r-md);
    overflow-x: auto;
  }

  ::v-deep pre code {
    display: block;
    padding: 18px 20px;
    background: none;
    line-height: 1.7;
  }

  /*
   * 引用块：左边一条薄荷绿，底色用浅灰。
   * 这是正文里少数几处能出现强调色的地方，用来打断长段落很有效。
   */
  ::v-deep blockquote {
    margin: 24px 0;
    padding: 16px 20px;
    border-left: 3px solid var(--c-accent);
    border-radius: 0 var(--r-md) var(--r-md) 0;
    background: var(--c-surface);
    color: var(--c-text-2);
  }

  ::v-deep blockquote p {
    margin: 0;
  }

  ::v-deep table {
    margin: 24px 0;
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
    border-radius: var(--r-md);
    overflow: hidden;
  }

  ::v-deep th,
  ::v-deep td {
    padding: 10px 14px;
    border: 1px solid var(--c-line);
    text-align: left;
  }

  ::v-deep th {
    background: var(--c-surface);
    font-weight: 600;
    color: var(--c-text);
  }

  ::v-deep img {
    max-width: 100%;
    border-radius: var(--r-md);
  }

  ::v-deep hr {
    margin: 40px 0;
    border: none;
    border-top: 1px solid var(--c-line);
  }
}

.title {
  /* 46 → 42 但字重 600 → 800 并收紧字距：更接近参考站那种「一块黑」的标题 */
  font-weight: 800;
  font-size: 42px;
  letter-spacing: -1.5px;
  line-height: 1.2;
  color: var(--c-text);
  margin: 64px 0 0;
}

.description {
  color: var(--c-text-2);
  margin: 18px 0 0;
  font-size: 18px;
  line-height: 1.7;
}

.info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 28px 0 0;
  padding-bottom: 28px;
  /* 用一条浅线把「元信息」和「正文」分开，替代原来靠间距硬隔 */
  border-bottom: 1px solid var(--c-line);
}

.info span {
  color: var(--c-text-3);
  font-size: 14px;
  display: inline-block;
}

/* 分类做成薄荷绿胶囊，和首页卡片上的分类是同一个样式 */
.info .category {
  padding: 3px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--c-accent-deep);
  background: var(--c-accent-soft);
}

.comment-count {
  cursor: pointer;
  &:hover {
    color: var(--c-accent-deep);
  }
}

/*
 * 右下角两个浮动按钮：做成圆形描边按钮。
 * 点击事件挂在里面的 <i> 上，所以让 <i> 撑满整个圆，
 * 否则可点区域只有十几像素，手指根本点不准。
 */
.fixed-sidebar {
  position: fixed;
  bottom: 32px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fixed-comment,
.fixed-scroll-top {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--c-bg);
  border: 1px solid var(--c-line-strong);
  color: var(--c-text-2);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;

  i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 17px;
    cursor: pointer;
  }

  &:hover {
    background: var(--c-ink);
    border-color: var(--c-ink);
    color: #fff;
  }
}

.comment {
  box-sizing: border-box;
  padding: 40px 0;
  width: 100%;
  max-width: var(--w-read);
  margin: 0 auto;

  &-header {
    padding-bottom: 20px;
    font-size: 20px;
    color: var(--c-text);
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  &-content {
    resize: none;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    border-radius: var(--r-md);
    padding: 16px 18px;
    font-size: 14px;
    font-family: var(--font-sans);
    color: var(--c-text);
    /* 浅灰底 + 无强边框，聚焦才出现薄荷绿描边（原来是聚焦加投影） */
    background: var(--c-surface);
    border: 1px solid transparent;
    transition: 0.2s all ease-in;

    &::placeholder {
      color: var(--c-text-3);
    }

    &:focus {
      background: var(--c-bg);
      border-color: var(--c-accent);
    }
  }
}

@media (max-width: 768px) {
  /* ===== 手机端文章详情（L2）===== */
  .article {
    padding: 0 16px;
  }

  /*
   * 标题 42px 在 375px 屏幕上只能放下 6 个字，一篇文章标题要占满一整屏，
   * 手机上压到 28px；描述同理。
   */
  .title {
    font-size: 28px;
    letter-spacing: -0.8px;
    line-height: 1.3;
    margin: 32px 0 0;
  }

  .description {
    font-size: 16px;
    margin: 14px 0 0;
  }

  .info {
    margin: 20px 0 0;
    padding-bottom: 20px;
  }

  .markdown-body {
    font-size: 15px;
    margin-top: 28px;

    ::v-deep h2 {
      font-size: 21px;
    }

    /* 宽表格自己横向滚动，不要把整个页面撑宽 */
    ::v-deep table {
      display: block;
      width: 100%;
      overflow-x: auto;
      white-space: nowrap;
    }

    ::v-deep pre {
      -webkit-overflow-scrolling: touch;
    }

    ::v-deep h1 {
      font-size: 22px;
    }
  }

  .comment {
    padding: 24px 16px;
  }

  .fixed-sidebar {
    bottom: 20px;
    right: 16px;
    gap: 8px;
  }

  .fixed-comment,
  .fixed-scroll-top {
    width: 42px;
    height: 42px;
  }
}
</style>
