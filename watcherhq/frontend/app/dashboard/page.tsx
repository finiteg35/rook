'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Bell, Activity } from 'lucide-react'
import { isAuthenticated } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { monitorsApi, alertsApi, Monitor, Alert } from '@/lib/api'
import Navbar from '@/components/Navbar'
import MonitorCard from '@/components/MonitorCard'
import AlertFeed from '@/components/AlertFeed'

export default function DashboardPage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [monitorsRes, alertsRes] = await Promise.all([
        monitorsApi.list(),
        alertsApi.list(),
      ])
      setMonitors(monitorsRes.data)
      setAlerts(alertsRes.data.slice(0, 20))
    } catch {
      setError('Failed to load data. Please refresh.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    fetchUser()
    load()
  }, [router, fetchUser, load])

  const unreadCount = alerts.filter((a) => !a.is_read).length
  const activeAlertMonitors = monitors.filter((m) => m.status === 'alert').length

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user ? `Hey, ${user.email.split('@')[0]} 👋` : 'Dashboard'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s being watched</p>
          </div>
          <Link
            href="/monitors/new"
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg px-4 py-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Monitor
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Monitors</span>
            </div>
            <p className="text-2xl font-bold text-white">{monitors.length}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Active Alerts</span>
            </div>
            <p className="text-2xl font-bold text-white">{activeAlertMonitors}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Unread</span>
            </div>
            <p className="text-2xl font-bold text-white">{unreadCount}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Monitors grid */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-white mb-4">Your Monitors</h2>
              {monitors.length === 0 ? (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center">
                  <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">No monitors yet.</p>
                  <Link
                    href="/monitors/new"
                    className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add your first monitor
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {monitors.map((m) => (
                    <MonitorCard key={m.id} monitor={m} onUpdate={load} />
                  ))}
                </div>
              )}
            </div>

            {/* Alert feed */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Recent Alerts</h2>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                <AlertFeed alerts={alerts} onUpdate={load} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
