import Vue from 'vue'

/*
 * Element UI 按需引入。
 *
 * 【为什么要逐个引到 lib 下的具体文件，而不是从 'element-ui' 具名导入】
 *
 * 看 node_modules/element-ui/package.json 就知道了 —— 它只有 main
 * （指向 lib/element-ui.common.js），既没有 module 字段、也没有 sideEffects 声明。
 * 这意味着两件事：
 *   1. 整个包是 CommonJS，webpack 的 tree-shaking 对 CJS 无效
 *   2. 没有 sideEffects: false，webpack 更不敢删任何东西
 *
 * 结果就是：哪怕只写 `import { Button } from 'element-ui'`，也会把
 * lib 目录那 6.1M 全都打进 bundle。
 * 实测线上产物印证了这一点：单个 chunk d440b0c.js 有 1.3M，主要就是它。
 *
 * 【lib/<component>.js 是什么】
 * element-ui 发布时把每个组件单独用 webpack 打包成了一个文件，
 * 导出形态是 { __esModule: true, default: 组件对象 }，
 * 所以 `import Button from 'element-ui/lib/button'` 拿到的就是组件本身，
 * component.name 也还在（ElButton / ElIcon / ...）。
 * 这也正是官方 babel-plugin-component 插件会自动生成的写法，
 * 这里手写只是为了让依赖关系显式可见 —— 不用多引入一份 babel 配置，
 * 也就不用担心它和 Nuxt 自带的 babel preset 相互影响。
 *
 * 【样式为什么仍然全量引入】
 * 见 nuxt.config.js 的 css 数组（element-ui/lib/theme-chalk/index.css）。
 * 这里刻意不做样式按需拆分：element-ui 的组件之间有样式依赖
 * （Dialog 依赖 overlay、各类 transition 动画等），手写一份组件-CSS
 * 映射表，漏掉一个不会报错、只会静默错版，排查成本远高于收益。
 * 而 CSS 本身经 gzip 后体积很小，又走 nginx 的一年缓存，
 * 留在全量是更划算的选择。
 *
 * 【一个顺带发现的待办，本次没动】
 * 下面引入的是英文语言包（locale/lang/en），但这是中文站点 ——
 * 分页器、MessageBox 的按钮文案都会是英文。
 * 换 zh-CN 只改这一行，但会改变现有 UI 文案，所以单独提出来。
 */
import Icon from 'element-ui/lib/icon'
import Drawer from 'element-ui/lib/drawer'
import Dialog from 'element-ui/lib/dialog'
import Button from 'element-ui/lib/button'
import Input from 'element-ui/lib/input'
import Avatar from 'element-ui/lib/avatar'
import Dropdown from 'element-ui/lib/dropdown'
import DropdownMenu from 'element-ui/lib/dropdown-menu'
import DropdownItem from 'element-ui/lib/dropdown-item'
import Pagination from 'element-ui/lib/pagination'
import Loading from 'element-ui/lib/loading'
import MessageBox from 'element-ui/lib/message-box'
import Message from 'element-ui/lib/message'

import locale from 'element-ui/lib/locale/lang/en'

const components = [
  Icon,
  Button,
  Avatar,
  Dialog,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Pagination,
  Input,
  Drawer
]

const Element = {
  install(Vue) {
    components.forEach(component => {
      Vue.component(component.name, component)
    })
  }
}

Vue.use(Loading.directive)
Vue.prototype.$loading = Loading.service
Vue.prototype.$msgbox = MessageBox
Vue.prototype.$alert = MessageBox.alert
Vue.prototype.$confirm = MessageBox.confirm
Vue.prototype.$prompt = MessageBox.prompt
Vue.prototype.$message = Message

Vue.use(Element, { locale })
