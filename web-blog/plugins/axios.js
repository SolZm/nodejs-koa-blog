import Vue from 'vue'
import { removeToken, encodeToken } from "@/lib/auth";

export default ({ $axios, store }) => {
  $axios.onRequest(config => {
    /*
     * 接口地址按运行环境分开取：
     *
     * 浏览器端 → 同源相对路径 /api/v1（BASE_URL）
     *   走 http 还是 https 自动就对了，切 HTTPS 不用改构建产物；
     *   同源也就不存在跨域；顺带把写死的服务器 IP 从 JS 里拿掉。
     *
     * 服务端渲染 → 绝对地址（API_INTERNAL_URL）
     *   SSR 在 Node 里跑，axios 给相对路径会直接报 Invalid URL。
     *   直连本机 Koa（127.0.0.1:3000），少绕一圈 nginx 和 TLS。
     *
     * 这里用 typeof window 判断而不是 process.server，
     * 是为了不依赖构建工具的常量替换，行为在任何打包方式下都确定。
     */
    const isServer = typeof window === 'undefined'
    config.baseURL = isServer
      ? process.env.API_INTERNAL_URL || 'http://127.0.0.1:3000/api/v1'
      : process.env.BASE_URL
    config.headers.Authorization = encodeToken()
  })

  $axios.onResponse(res => {
    if (res.status === 200 && res.data.code === 200) {
      return res
    } else {
      Vue.prototype.$message.error(res.data.msg || '获取失败')
      return Promise.reject(res)
    }
  })

  $axios.onError(err => {
    const { response } = err

    // 处理token过期无效情况，清除token，初始化store数据
    if ([401, 403].includes(response.status)) {
      removeToken()
      store.commit('user/SET_LOGIN_STATUS', false)
      store.commit('user/SET_USERINFO', null)
    }

    const msg = Array.isArray(response.data.msg) ? response.data.msg.join(',') : response.data.msg
    Vue.prototype.$message.error(msg || '获取失败')
    return Promise.reject(err)
  })
}
