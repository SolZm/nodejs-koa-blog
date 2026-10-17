const dotenv = require('dotenv')
const envConfig = dotenv.config({ path: `.env.${process.env.NODE_ENV}` }).parsed

export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    // 页面自己没设 title 时的兜底，别让英文的 frontend 漏到浏览器 tab 上
    title: '博客',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { name: 'format-detection', content: 'telephone=no' }
    ],
    link: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=2' },
      { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico?v=2' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=2' }
    ]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '@/assets/css/common.css',
    'element-ui/lib/theme-chalk/index.css',
    /*
     * theme.css 必须排在 element-ui 主题【之后】。
     * 它里面是覆盖 element-ui 默认蓝皮的规则，权重和官方主题相同，
     * 靠加载顺序决胜——写在前面会被官方主题盖掉（分页器会一直是蓝色）。
     */
    '@/assets/css/theme.css'
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '@/plugins/axios',
    '@/plugins/axios-ports',
    '@/plugins/md',
    '@/plugins/route',
    '@/plugins/ask-blog',
    { src: '@/plugins/scrollTo', mode: 'client' },
    '@/plugins/element-ui',
    // 原本在这里注册了 mavon-editor（一个 Markdown 编辑器）来展示文章，
    // 但它只在文章详情页用到，注册成全局插件会让首页也多下载约 1MB，
    // 而且它给容器设的 z-index: 1500 会盖住吸顶头部。现已改为直接渲染服务端返回的 HTML。
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    '@nuxtjs/axios',
    'cookie-universal-nuxt',
    ['cookie-universal-nuxt', { alias: 'cookiz' }],
  ],
  env: envConfig,
  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    transpile: [/^element-ui/],
  }
}
