import axios from 'axios'
import { message, Modal } from 'ant-design-vue'
import { encodeToken, getToken, removeToken } from './token'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000
})

service.interceptors.request.use((config) => {
  if (getToken()) {
    config.headers.Authorization = encodeToken()
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body?.code !== 200) {
      const errorMessage = Array.isArray(body?.msg) ? body.msg.join('，') : body?.msg || '请求失败'
      message.error(errorMessage)
      return Promise.reject(new Error(errorMessage))
    }
    return body
  },
  (error) => {
    const status = error.response?.status
    const errorMessage = error.response?.data?.msg
    if ([401, 403].includes(status)) {
      removeToken()
      Modal.confirm({
        title: '登录状态已失效',
        content: '请重新登录后继续操作。',
        okText: '重新登录',
        cancelText: '取消',
        onOk: () => {
          window.location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`
        }
      })
    } else {
      message.error(Array.isArray(errorMessage) ? errorMessage.join('，') : errorMessage || error.message || '网络请求失败')
    }
    return Promise.reject(error)
  }
)

export default service as <T = any>(config: Parameters<typeof service>[0]) => Promise<T>
