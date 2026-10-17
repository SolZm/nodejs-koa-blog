import Vue from 'vue'

/**
 * 「问博客」的共享开关
 *
 * 入口按钮在 Header 里，抽屉在 AskBlog 组件里，两者是兄弟关系。
 * 用 Vue.observable 建一个极简共享状态把它们连起来，
 * 比再引入一层事件总线或 Vuex 模块都轻，也不会多出生命周期清理的坑。
 */
const askBlog = Vue.observable({ visible: false })

Vue.prototype.$askBlog = askBlog

export default () => {}
