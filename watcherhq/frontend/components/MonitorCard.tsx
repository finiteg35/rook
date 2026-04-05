'use client'

import { useRouter } from 'next/navigation'
import { Eye, Tag, Newspaper, Bell, TrendingUp, Briefcase, Home, Play, Trash2 } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Monitor, monitorsApi } from '@/lib/api'
import { useState } from 'react'

const MODULE_ICONS: Record<string, React.ElementType> = {
  pagespy:      Eye,
  pricehound:   Tag,
  digestbot:    Newspaper,
  mentionalert: Bell,
  rankwatch:    TrendingUp,
  jobradar:     Briefcase,
  leaseguard:   Home,
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface MonitorCardProps {
  monitor: Monitor
  onUpdate?: () => void
}

export default function MonitorCard({ monitor, onUpdate }: MonitorCardProps) {
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const Icon = MODULE_ICONS[monitor.module_type] ?? Eye

  const handleRunNow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRunning(true)
    try {
      await monitorsApi.run(monitor.id)
      onUpdate?.()
    } finally {
      setIsRunning(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete monitor "${monitor.name}"?`)) return
    setIsDeleting(true)
    try {
      await monitorsApi.delete(monitor.id)
      onUpdate?.()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      onClick={() => router.push(`/monitors/${monitor.id}`)}
      className="group bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 cursor-pointer
        hover:border-teal-500/50 transition-all hover:shadow-lg hover:shadow-teal-500/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center">
            <Icon className="w-4 h-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white text-sm truncate">{monitor.name}</p>
            <p className="text-xs text-gray-500 capitalize">{monitor.module_type}</p>
          </div>
        </div>
        <StatusBadge status={monitor.status} />
      </div>

      {/* Last checked */}
      {monitor.last_checked && (
        <p className="text-xs text-gray-500 mb-2">
          Checked {timeAgo(monitor.last_checked)}
        </p>
      )}

      {/* Last alert preview */}
      {monitor.last_alert_preview && (
        <p className="text-xs text-gray-400 truncate border-t border-[#2a2a2a] pt-2 mb-3">
          {monitor.last_alert_preview}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-[#2a2a2a]">
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
            text-gray-400 hover:text-teal-400 hover:bg-teal-500/10 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          {isRunning ? 'Running…' : 'Run now'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
            text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 ml-auto"
        >
          <Trash2 className="w-3 h-3" />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
