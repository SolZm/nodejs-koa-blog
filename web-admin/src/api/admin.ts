import request from '@/utils/request'

export interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

export function login(data: { email: string; password: string }) {
  return request<ApiResponse<{ token: string }>>({
    url: '/admin/login',
    method: 'post',
    data
  })
}

export function getInfo() {
  return request<ApiResponse<{ id: number; nickname: string; email: string }>>({
    url: '/admin/auth',
    method: 'get'
  })
}
