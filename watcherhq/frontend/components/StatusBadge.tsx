'use client'

type Status = 'ok' | 'alert' | 'error' | 'pending'

const STATUS_STYLES: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  ok:      { bg: 'bg-green-500/10',  text: 'text-green-400',  dot: 'bg-green-400',  label: 'OK' },
  alert:   { bg: 'bg-amber-500/10',  text: 'text-amber-400',  dot: 'bg-amber-400',  label: 'Alert' },
  error:   { bg: 'bg-red-500/10',    text: 'text-red-400',    dot: 'bg-red-400',    label: 'Error' },
  pending: { bg: 'bg-gray-500/10',   text: 'text-gray-400',   dot: 'bg-gray-400',   label: 'Pending' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
