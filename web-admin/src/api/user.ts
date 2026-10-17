import request, { type ApiResponse } from './request'

export function getUserList(params: Record<string, any>) {
  return request<ApiResponse<{ data: any[]; meta: { count: number } }>>({
    url: '/user/list',
    method: 'get',
    params
  })
}

export function deleteUser(id: number | string) {
  return request<ApiResponse>({ url: `/user/delete/${id}`, method: 'delete' })
}

export function updateUser(data: Record<string, any>) {
  return request<ApiResponse>({ url: `/user/update/${data.id}`, method: 'put', data })
}

export function userInfo(params: { id: number | string }) {
  return request<ApiResponse<any>>({ url: `/user/detail/${params.id}`, method: 'get' })
}
