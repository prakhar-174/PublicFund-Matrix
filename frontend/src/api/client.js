import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || 'budget_access'
const REFRESH_KEY = import.meta.env.VITE_REFRESH_KEY || 'budget_refresh'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach bearer token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || TOKEN_KEY
    const token = localStorage.getItem(tokenKey)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: refresh token on 401, retry once, redirect on second 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && originalRequest) {
      const tokenKey = import.meta.env.VITE_TOKEN_KEY || TOKEN_KEY
      const refreshKey = import.meta.env.VITE_REFRESH_KEY || REFRESH_KEY

      // On second 401 (request already retried) or refresh endpoint failure
      if (originalRequest._retry || originalRequest.url?.includes('/auth/token/refresh/')) {
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(refreshKey)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      const refreshToken = localStorage.getItem(refreshKey)
      if (!refreshToken) {
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(refreshKey)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      originalRequest._retry = true

      try {
        const refreshResponse = await axios.post(`${baseURL}/auth/token/refresh/`, {
          refresh: refreshToken,
        })

        const newAccessToken = refreshResponse.data.access
        localStorage.setItem(tokenKey, newAccessToken)

        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        return apiClient(originalRequest)
      } catch (refreshError) {
        // Failed to refresh token: clear both tokens and redirect to /login
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(refreshKey)
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
