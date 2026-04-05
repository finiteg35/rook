'use client'

import { create } from 'zustand'
import { authApi, User } from '@/lib/api'
import { getToken, setToken, removeToken } from '@/lib/auth'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await authApi.login(email, password)
      const token = res.data.access_token
      setToken(token)
      set({ token, isLoading: false })
      const meRes = await authApi.getMe()
      set({ user: meRes.data })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      await authApi.register(email, password)
      const loginRes = await authApi.login(email, password)
      const token = loginRes.data.access_token
      setToken(token)
      set({ token, isLoading: false })
      const meRes = await authApi.getMe()
      set({ user: meRes.data })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  logout: () => {
    removeToken()
    set({ user: null, token: null })
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },

  fetchUser: async () => {
    const token = getToken()
    if (!token) return
    set({ isLoading: true })
    try {
      const res = await authApi.getMe()
      set({ user: res.data, token, isLoading: false })
    } catch {
      removeToken()
      set({ user: null, token: null, isLoading: false })
    }
  },
}))
