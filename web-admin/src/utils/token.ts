import { Base64 } from 'js-base64'

const TOKEN_KEY = 'vue_admin_template_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function encodeToken() {
  return `Basic ${Base64.encode(`${getToken()}:`)}`
}
