import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  App as AntApp,
  Avatar,
  Breadcrumb,
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  Modal,
  Pagination,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Upload
} from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import 'md-editor-v3/lib/style.css'
import '@/styles/global.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ConfigProvider)
app.use(AntApp)
app.use(Menu)
app.use(Breadcrumb)
app.use(Dropdown)
app.use(Avatar)
app.use(Button)
app.use(Form)
app.use(Input)
app.use(Select)
app.use(Table)
app.use(Tag)
app.use(Pagination)
app.use(Spin)
app.use(Empty)
app.use(Upload)
app.use(InputNumber)
app.use(Radio)
app.use(Space)
app.use(Tooltip)
app.use(Modal)
app.mount('#app')
