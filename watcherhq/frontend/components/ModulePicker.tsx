'use client'

import { Eye, Tag, Newspaper, Bell, TrendingUp, Briefcase, Home } from 'lucide-react'

export type ModuleType =
  | 'pagespy'
  | 'pricehound'
  | 'digestbot'
  | 'mentionalert'
  | 'rankwatch'
  | 'jobradar'
  | 'leaseguard'

export const MODULE_META: Record<
  ModuleType,
  { label: string; description: string; Icon: React.ElementType }
> = {
  pagespy:      { label: 'PageSpy',      description: 'Monitor any URL for changes',    Icon: Eye },
  pricehound:   { label: 'PriceHound',   description: 'Track product prices',            Icon: Tag },
  digestbot:    { label: 'DigestBot',    description: 'Daily topic briefings',           Icon: Newspaper },
  mentionalert: { label: 'MentionAlert', description: 'Brand & keyword monitoring',      Icon: Bell },
  rankwatch:    { label: 'RankWatch',    description: 'Keyword ranking tracker',         Icon: TrendingUp },
  jobradar:     { label: 'JobRadar',     description: 'Job board monitor',               Icon: Briefcase },
  leaseguard:   { label: 'LeaseGuard',   description: 'Rental listing alerts',           Icon: Home },
}

interface ModulePickerProps {
  selected: ModuleType | null
  onSelect: (type: ModuleType) => void
}

export default function ModulePicker({ selected, onSelect }: ModulePickerProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Choose Monitor Type</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(Object.entries(MODULE_META) as [ModuleType, typeof MODULE_META[ModuleType]][]).map(
          ([type, meta]) => {
            const isSelected = selected === type
            const { Icon } = meta
            return (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                    : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 hover:border-teal-500/50 hover:text-white'
                  }`}
              >
                <Icon className="w-6 h-6" />
                <span className="font-medium text-sm">{meta.label}</span>
                <span className="text-xs text-gray-500 text-center leading-tight">{meta.description}</span>
              </button>
            )
          }
        )}
      </div>
    </div>
  )
}
