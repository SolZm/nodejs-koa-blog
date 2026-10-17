import request, { type ApiResponse } from './request'

export function list(params: Record<string, any>) {
  return request<ApiResponse<{ data: any[]; meta: { count: number } }>>({
    url: '/reply',
    method: 'get',
    params
  })
}

export function detail(params: { id: number | string }) {
  return request<ApiResponse<any>>({ url: `/reply/${params.id}`, method: 'get' })
}

export function update(data: Record<string, any>) {
  return request<ApiResponse>({ url: `/reply/${data.id}`, method: 'put', data })
}

export function remove(id: number | string) {
  return request<ApiResponse>({ url: `/reply/${id}`, method: 'delete' })
}
