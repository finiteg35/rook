'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Bell, MessageSquare } from 'lucide-react'
import { isAuthenticated } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { authApi } from '@/lib/api'
import Navbar from '@/components/Navbar'

export default function SettingsPage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const [notifEmail, setNotifEmail] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    fetchUser()
  }, [router, fetchUser])

  useEffect(() => {
    if (user) {
      setNotifEmail(user.notification_email ?? '')
      setTelegramId(user.telegram_chat_id ?? '')
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccess(false)
    setError(null)
    try {
      await authApi.updateMe({
        notification_email: notifEmail || undefined,
        telegram_chat_id: telegramId || undefined,
      })
      await fetchUser()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your notification preferences.</p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          {success && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-4 py-3 text-teal-400 text-sm mb-4">
              Settings saved successfully!
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Account info */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Account</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Account Email</label>
                <input
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Notifications</h2>
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                    <Bell className="w-4 h-4 text-teal-400" />
                    Notification Email
                  </label>
                  <input
                    type="email"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder={user?.email ?? 'alerts@example.com'}
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white
                      placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                  <p className="text-xs text-gray-600 mt-1">Leave blank to use your account email.</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                    <MessageSquare className="w-4 h-4 text-teal-400" />
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="123456789"
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white
                      placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Get your chat ID from{' '}
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:underline"
                    >
                      @userinfobot
                    </a>{' '}
                    on Telegram.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50
                text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
