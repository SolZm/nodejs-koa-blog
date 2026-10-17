import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getInfo, login as loginApi } from '@/api/admin'
import { getToken, removeToken, setToken } from '@/utils/token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const adminInfo = ref<any>(null)
  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => adminInfo.value?.nickname || adminInfo.value?.email?.split('@')[0] || '管理员')

  async function login(payload: { email: string; password: string }) {
    const res = await loginApi({ ...payload, email: payload.email.trim() })
    token.value = res.data.token
    setToken(res.data.token)
    await fetchInfo()
  }

  async function fetchInfo() {
    const res = await getInfo()
    adminInfo.value = res.data
    return res.data
  }

  function logout() {
    token.value = ''
    adminInfo.value = null
    removeToken()
  }

  return { token, adminInfo, isLoggedIn, displayName, login, fetchInfo, logout }
})
