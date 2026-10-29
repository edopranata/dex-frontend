import axios, { AxiosError } from 'axios'

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

api.interceptors.request.use(async (config) => {
  if (config.method && config.method.toLowerCase() !== 'get') await ensureCsrf()
  return config
})

api.interceptors.response.use(undefined, (error: AxiosError) => {
  if (error.response?.status === 419) csrfReady = false
  const isSessionCheck = error.config?.url === '/auth/me'
  if (error.response?.status === 401 && !isSessionCheck && !['/login', '/register'].includes(location.pathname)) {
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
