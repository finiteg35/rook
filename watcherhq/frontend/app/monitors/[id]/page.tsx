'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Play, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { monitorsApi, alertsApi, Monitor, Alert } from '@/lib/api'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'
import AddMonitorForm from '@/components/AddMonitorForm'
import AlertFeed from '@/components/AlertFeed'
import { ModuleType } from '@/components/ModulePicker'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function MonitorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params?.id)

  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [monRes, alertRes] = await Promise.all([
        monitorsApi.get(id),
        alertsApi.list(id),
      ])
      setMonitor(monRes.data)
      setAlerts(alertRes.data)
    } catch {
      setError('Failed to load monitor.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    if (id) load()
  }, [router, id, load])

  const handleRunNow = async () => {
    if (!monitor) return
    setIsRunning(true)
    try {
      await monitorsApi.run(monitor.id)
      await load()
    } finally {
      setIsRunning(false)
    }
  }

  const handleUpdate = async (name: string, config: Record<string, unknown>) => {
    if (!monitor) return
    setIsSaving(true)
    try {
      await monitorsApi.update(monitor.id, { name, config })
      await load()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !monitor) {
    return (
      <div className="min-h-screen bg-[#0f0f0f]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-red-400 mb-4">{error ?? 'Monitor not found.'}</p>
          <Link href="/dashboard" className="text-teal-400 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">{monitor.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-500 capitalize">{monitor.module_type}</span>
              <StatusBadge status={monitor.status} />
            </div>
            {monitor.last_checked && (
              <p className="text-xs text-gray-600 mt-1">
                Last checked {timeAgo(monitor.last_checked)}
              </p>
            )}
          </div>
          <button
            onClick={handleRunNow}
            disabled={isRunning}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50
              text-white font-medium rounded-lg px-4 py-2 transition-colors text-sm"
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running…' : 'Run Now'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Edit form */}
          <div className="lg:col-span-3">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Monitor Settings</h2>
              <AddMonitorForm
                moduleType={monitor.module_type as ModuleType}
                initialValues={{ name: monitor.name, ...monitor.config }}
                onSubmit={handleUpdate}
                isLoading={isSaving}
              />
            </div>
          </div>

          {/* Alert history */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Alert History</h2>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <AlertFeed alerts={alerts} onUpdate={load} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
