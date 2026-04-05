'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Settings, CreditCard, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', Icon: Activity },
  { href: '/settings',  label: 'Settings',  Icon: Settings },
  { href: '/billing',   label: 'Billing',   Icon: CreditCard },
]

export default function Navbar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <nav className="sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur border-b border-[#2a2a2a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">
              Watcher<span className="text-teal-400">HQ</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, Icon }) => {
              const active = pathname?.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? 'text-teal-400 bg-teal-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:block text-xs text-gray-500 max-w-[160px] truncate">
                {user.email}
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400
                hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex gap-1 pb-3">
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const active = pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors
                  ${active
                    ? 'text-teal-400 bg-teal-500/10'
                    : 'text-gray-400 hover:text-white'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
