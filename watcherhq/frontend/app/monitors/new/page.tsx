'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { monitorsApi } from '@/lib/api'
import Navbar from '@/components/Navbar'
import ModulePicker, { ModuleType } from '@/components/ModulePicker'
import AddMonitorForm from '@/components/AddMonitorForm'

export default function NewMonitorPage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<ModuleType | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [router])

  const handleSubmit = async (name: string, config: Record<string, unknown>) => {
    if (!selectedType) return
    setIsLoading(true)
    try {
      await monitorsApi.create({ name, module_type: selectedType, config })
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Add New Monitor</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a monitor type and configure it.</p>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-8">
          <ModulePicker selected={selectedType} onSelect={setSelectedType} />

          {selectedType && (
            <div className="border-t border-[#2a2a2a] pt-6">
              <h2 className="text-lg font-semibold text-white mb-4">Configure Monitor</h2>
              <AddMonitorForm
                moduleType={selectedType}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
