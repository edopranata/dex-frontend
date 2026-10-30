import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const checked = ref(false)

  async function fetchUser(): Promise<User | null> {
    try {
      const { data } = await api.get<{ data: User }>('/auth/me')
      user.value = data.data
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
    return user.value
  }

  /**
   * Returns true when the account has 2FA and a code is needed (see completeTwoFactor).
   */
  async function login(email: string, password: string, remember = true): Promise<boolean> {
    const { data } = await api.post<{ data: User } | { two_factor: true }>('/auth/login', { email, password, remember })
    if ('two_factor' in data) return true
    user.value = data.data
    return false
  }

  async function completeTwoFactor(payload: { code: string } | { recovery_code: string }): Promise<void> {
    const { data } = await api.post<{ data: User }>('/auth/two-factor-challenge', payload)
    user.value = data.data
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout')
    user.value = null
  }

  return { user, checked, fetchUser, login, completeTwoFactor, logout }
})
