import request, { type ApiResponse } from './request'

export function list(params: Record<string, any>) {
  return request<ApiResponse<{ data: any[]; meta: { count: number } }>>({
    url: '/comment',
    method: 'get',
    params
  })
}

export function detail(params: { id: number | string }) {
  return request<ApiResponse<any>>({ url: `/comment/${params.id}`, method: 'get' })
}

export function update(data: Record<string, any>) {
  return request<ApiResponse>({ url: `/comment/${data.id}`, method: 'put', data })
}

export function remove(id: number | string) {
  return request<ApiResponse>({ url: `/comment/${id}`, method: 'delete' })
}
