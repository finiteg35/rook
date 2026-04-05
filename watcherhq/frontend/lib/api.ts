import axios from 'axios'
import { getToken, removeToken } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      removeToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  is_active: boolean
  notification_email?: string
  telegram_chat_id?: string
  plan?: string
}

export interface Monitor {
  id: number
  name: string
  module_type: string
  config: Record<string, unknown>
  status: 'ok' | 'alert' | 'error' | 'pending'
  last_checked?: string
  last_alert_preview?: string
  created_at: string
}

export interface Alert {
  id: number
  monitor_id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface Plan {
  id: string
  name: string
  price: number
  features: string[]
  stripe_price_id?: string
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) => {
    const body = new URLSearchParams()
    body.append('username', email)
    body.append('password', password)
    return api.post<{ access_token: string; token_type: string }>('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },

  register: (email: string, password: string) =>
    api.post<User>('/auth/register', { email, password }),

  getMe: () => api.get<User>('/auth/me'),

  updateMe: (data: Partial<Pick<User, 'notification_email' | 'telegram_chat_id'>>) =>
    api.patch<User>('/auth/me', data),
}

// ── Monitors ─────────────────────────────────────────────────────────────────

export const monitorsApi = {
  list: () => api.get<Monitor[]>('/monitors'),

  create: (data: { name: string; module_type: string; config: Record<string, unknown> }) =>
    api.post<Monitor>('/monitors', data),

  get: (id: number) => api.get<Monitor>(`/monitors/${id}`),

  update: (id: number, data: Partial<Monitor>) =>
    api.patch<Monitor>(`/monitors/${id}`, data),

  delete: (id: number) => api.delete(`/monitors/${id}`),

  run: (id: number) => api.post<Monitor>(`/monitors/${id}/run`),
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export const alertsApi = {
  list: (monitorId?: number) =>
    api.get<Alert[]>('/alerts', { params: monitorId ? { monitor_id: monitorId } : {} }),

  get: (id: number) => api.get<Alert>(`/alerts/${id}`),

  markRead: (id: number) => api.patch<Alert>(`/alerts/${id}`, { is_read: true }),

  delete: (id: number) => api.delete(`/alerts/${id}`),
}

// ── Billing ───────────────────────────────────────────────────────────────────

export const billingApi = {
  getPlans: () => api.get<Plan[]>('/billing/plans'),

  createCheckout: (priceId: string) =>
    api.post<{ url: string }>('/billing/checkout', { price_id: priceId }),

  createPortalSession: () =>
    api.post<{ url: string }>('/billing/portal'),
}
