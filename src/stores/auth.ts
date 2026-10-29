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

  async function login(email: string, password: string, remember = true): Promise<void> {
    const { data } = await api.post<{ data: User }>('/auth/login', { email, password, remember })
    user.value = data.data
  }

  async function register(payload: { name: string; email: string; password: string; password_confirmation: string }): Promise<void> {
    const { data } = await api.post<{ data: User }>('/auth/register', payload)
    user.value = data.data
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout')
    user.value = null
  }

  return { user, checked, fetchUser, login, register, logout }
})
