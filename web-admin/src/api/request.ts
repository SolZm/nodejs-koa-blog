import request from '@/utils/request'

export interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

export default request
