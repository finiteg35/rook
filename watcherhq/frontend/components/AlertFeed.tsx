'use client'

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Alert, alertsApi } from '@/lib/api'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface AlertFeedProps {
  alerts: Alert[]
  onUpdate?: () => void
}

export default function AlertFeed({ alerts, onUpdate }: AlertFeedProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const handleMarkRead = async (id: number) => {
    setLoadingId(id)
    try {
      await alertsApi.markRead(id)
      onUpdate?.()
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setLoadingId(id)
    try {
      await alertsApi.delete(id)
      onUpdate?.()
    } finally {
      setLoadingId(null)
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">No alerts yet.</div>
    )
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`flex items-start gap-3 p-3 rounded-xl border transition-all
            ${alert.is_read
              ? 'border-[#2a2a2a] bg-[#1a1a1a]'
              : 'border-teal-500/30 bg-teal-500/5'
            }`}
        >
          {/* Unread dot */}
          <div className="mt-1.5 flex-shrink-0">
            <span className={`block w-2 h-2 rounded-full ${alert.is_read ? 'bg-gray-600' : 'bg-teal-400'}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${alert.is_read ? 'text-gray-400' : 'text-white'}`}>
              {alert.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.message}</p>
            <p className="text-xs text-gray-600 mt-1">{timeAgo(alert.created_at)}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            {!alert.is_read && (
              <button
                onClick={() => handleMarkRead(alert.id)}
                disabled={loadingId === alert.id}
                title="Mark as read"
                className="p-1.5 rounded-lg text-gray-500 hover:text-teal-400 hover:bg-teal-500/10 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleDelete(alert.id)}
              disabled={loadingId === alert.id}
              title="Delete alert"
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
