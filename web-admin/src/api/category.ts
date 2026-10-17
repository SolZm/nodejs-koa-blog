import request, { type ApiResponse } from './request'

export function list(params: Record<string, any> = {}) {
  return request<ApiResponse<{ data: any[]; meta: { count: number } }>>({
    url: '/category',
    method: 'get',
    params
  })
}

export function create(data: Record<string, any>) {
  return request<ApiResponse>({ url: '/category', method: 'post', data })
}

export function detail(params: { id: number | string }) {
  return request<ApiResponse<any>>({ url: `/category/${params.id}`, method: 'get' })
}

export function update(data: Record<string, any>) {
  return request<ApiResponse>({ url: `/category/${data.id}`, method: 'put', data })
}

export function remove(id: number | string) {
  return request<ApiResponse>({ url: `/category/${id}`, method: 'delete' })
}
