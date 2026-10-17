import Vue from 'vue'
import 'highlight.js/styles/github.css'

// 只引常用语言包（common），而不是整个 highlight.js。
// 全量版本会把一百多种语言都打进来，而文章里实际只用到十几种。
const hljs = require('highlight.js/lib/common')

// common 里没有 nginx，但文章里确实用到了，单独补上
hljs.registerLanguage('nginx', require('highlight.js/lib/languages/nginx'))

const md = require('markdown-it')({
  // 与后端的渲染配置保持一致：单换行保留为换行、纯文本 URL 自动成链接。
  // 前端这份用于评论区和「问博客」的回答。
  breaks: true,
  linkify: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, {
            language: lang,
            ignoreIllegals: true,
          }).value +
          '</code></pre>'
        )
      } catch (__) { }
    }

    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    )
  },
})

Vue.prototype.$md = md;
export default md;
