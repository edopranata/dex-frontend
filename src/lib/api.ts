import axios, { AxiosError } from 'axios'
import { useProgressStore } from '@/stores/progress'
import { useSyncStore } from '@/stores/sync'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

let csrfReady = false

/** Sanctum needs the XSRF-TOKEN cookie before the first state-changing request. */
export async function ensureCsrf(): Promise<void> {
  if (csrfReady) return
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
  csrfReady = true
}

/** Requests made while a page loads or the refresh button runs keep the top loading bar up. */
const tracked = new WeakSet<object>()

function settle(config: object | undefined) {
  if (config && tracked.has(config)) {
    tracked.delete(config)
    useProgressStore().requestFinished()
  }
}

api.interceptors.request.use(async (config) => {
  const progress = useProgressStore()
  if (progress.tracking()) {
    tracked.add(config)
    progress.requestStarted()
  }
  if (config.method && config.method.toLowerCase() !== 'get') await ensureCsrf()
  return config
})

api.interceptors.response.use(
  (response) => {
    settle(response.config)
    useSyncStore().succeeded()
    return response
  },
  (error: AxiosError) => {
    settle(error.config)
    if (error.response) useSyncStore().succeeded()
    else useSyncStore().failedWithoutResponse()
    return Promise.reject(error)
  },
)

api.interceptors.response.use(undefined, (error: AxiosError) => {
  if (error.response?.status === 419) csrfReady = false
  const code = (error.response?.data as { code?: string } | undefined)?.code
  if (error.response?.status === 403 && code === 'password_change_required' && location.pathname !== '/change-password') {
    location.href = '/change-password'
  }
  const isSessionCheck = error.config?.url === '/auth/me'
  if (error.response?.status === 401 && !isSessionCheck && !['/login', '/forgot-password', '/reset-password', '/reset-2fa'].includes(location.pathname)) {
    location.href = '/login'
  }
  return Promise.reject(error)
})

/** First validation message or a generic fallback. */
export function errorMessage(error: unknown): string {
  const response = (error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>).response
  const errors = response?.data?.errors
  if (errors) return Object.values(errors)[0]?.[0] ?? 'Terjadi kesalahan.'
  return response?.data?.message ?? 'Terjadi kesalahan. Coba lagi.'
}
