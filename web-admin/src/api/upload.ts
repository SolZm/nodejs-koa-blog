import request, { type ApiResponse } from './request'

export function getUploadToken() {
  return request<ApiResponse<{ token: string }>>({
    url: '/upload/token',
    method: 'post'
  })
}
