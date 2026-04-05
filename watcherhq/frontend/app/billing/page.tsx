'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Zap } from 'lucide-react'
import { isAuthenticated } from '@/lib/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { billingApi, Plan } from '@/lib/api'
import Navbar from '@/components/Navbar'

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    '3 monitors',
    'Daily checks',
    'Email notifications',
    '7-day alert history',
  ],
  pro: [
    '25 monitors',
    'Hourly checks',
    'Email + Telegram notifications',
    '30-day alert history',
    'Priority support',
  ],
  business: [
    'Unlimited monitors',
    'Real-time checks (15 min)',
    'All notification channels',
    '1-year alert history',
    'API access',
    'Dedicated support',
  ],
}

const PLAN_COLORS: Record<string, string> = {
  free:     'border-[#2a2a2a]',
  pro:      'border-teal-500',
  business: 'border-purple-500',
}

export default function BillingPage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentPlan = user?.plan ?? 'free'

  const load = useCallback(async () => {
    try {
      const res = await billingApi.getPlans()
      setPlans(res.data)
    } catch {
      // Fallback plans if API not available
      setPlans([
        { id: 'free',     name: 'Free',     price: 0,   features: PLAN_FEATURES.free },
        { id: 'pro',      name: 'Pro',      price: 12,  features: PLAN_FEATURES.pro,      stripe_price_id: 'price_pro' },
        { id: 'business', name: 'Business', price: 39,  features: PLAN_FEATURES.business, stripe_price_id: 'price_business' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return }
    fetchUser()
    load()
  }, [router, fetchUser, load])

  const handleUpgrade = async (priceId: string) => {
    setCheckoutLoading(priceId)
    setError(null)
    try {
      const res = await billingApi.createCheckout(priceId)
      window.location.href = res.data.url
    } catch {
      setError('Failed to start checkout. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setPortalLoading(true)
    setError(null)
    try {
      const res = await billingApi.createPortalSession()
      window.location.href = res.data.url
    } catch {
      setError('Failed to open billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Billing &amp; Plans</h1>
          <p className="text-gray-500 text-sm mt-1">
            Current plan:{' '}
            <span className="text-teal-400 font-medium capitalize">{currentPlan}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Manage billing button */}
        {currentPlan !== 'free' && (
          <div className="mb-8">
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-teal-500/50
                text-white font-medium rounded-lg px-4 py-2.5 transition-all disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? 'Opening…' : 'Manage Billing & Invoices'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan
              const features = PLAN_FEATURES[plan.id] ?? plan.features
              const borderClass = PLAN_COLORS[plan.id] ?? 'border-[#2a2a2a]'

              return (
                <div
                  key={plan.id}
                  className={`bg-[#1a1a1a] border rounded-xl p-6 flex flex-col relative ${borderClass}`}
                >
                  {plan.id === 'pro' && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-white capitalize">{plan.name}</h2>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-extrabold text-white">
                        ${plan.price}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-gray-500 text-sm">/month</span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="text-center py-2 text-sm font-medium text-teal-400 bg-teal-500/10 rounded-lg">
                      Current Plan
                    </div>
                  ) : plan.price === 0 ? null : (
                    <button
                      onClick={() => plan.stripe_price_id && handleUpgrade(plan.stripe_price_id)}
                      disabled={checkoutLoading === plan.stripe_price_id}
                      className="flex items-center justify-center gap-2 w-full bg-teal-500 hover:bg-teal-600
                        disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      {checkoutLoading === plan.stripe_price_id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
