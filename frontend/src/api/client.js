// src/api/client.js
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
let refreshing = false
let queue = []

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then(() => api(original)).catch((e) => Promise.reject(e))
      }
      original._retry = true
      refreshing = true
      try {
        const { data } = await axios.post(`${BASE}/api/auth/refresh`, {}, { withCredentials: true })
        localStorage.setItem('accessToken', data.accessToken)
        queue.forEach(({ resolve }) => resolve())
        queue = []
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (refreshErr) {
        queue.forEach(({ reject }) => reject(refreshErr))
        queue = []
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default api
