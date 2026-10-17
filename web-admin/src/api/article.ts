import request, { type ApiResponse } from './request'

export function list(params: Record<string, any>) {
  return request<ApiResponse<{ data: any[]; meta: { count: number } }>>({
    url: '/article',
    method: 'get',
    params
  })
}

export function create(data: Record<string, any>) {
  return request<ApiResponse>({
    url: '/article',
    method: 'post',
    data,
    timeout: 30000
  })
}

export function detail(params: { id: number | string; is_markdown?: boolean }) {
  return request<ApiResponse<any>>({
    url: `/article/${params.id}`,
    method: 'get',
    params
  })
}

export function update(data: Record<string, any>) {
  return request<ApiResponse>({
    url: `/article/${data.id}`,
    method: 'put',
    data,
    timeout: 30000
  })
}

export function remove(id: number | string) {
  return request<ApiResponse>({
    url: `/article/${id}`,
    method: 'delete'
  })
}
