'use client'

import { useState } from 'react'
import { ModuleType } from './ModulePicker'

interface AddMonitorFormProps {
  moduleType: ModuleType
  initialValues?: Record<string, unknown>
  onSubmit: (name: string, config: Record<string, unknown>) => Promise<void>
  isLoading?: boolean
}

type FieldDef =
  | { type: 'text' | 'number'; name: string; label: string; placeholder?: string }
  | { type: 'checkbox'; name: string; label: string }
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[] }
  | { type: 'checkboxGroup'; name: string; label: string; options: { value: string; label: string }[] }

const MODULE_FIELDS: Record<ModuleType, FieldDef[]> = {
  pagespy: [
    { type: 'text', name: 'url', label: 'URL to Monitor', placeholder: 'https://example.com' },
  ],
  pricehound: [
    { type: 'text',   name: 'url',          label: 'Product URL',   placeholder: 'https://shop.com/product' },
    { type: 'text',   name: 'product_name', label: 'Product Name',  placeholder: 'MacBook Pro 14"' },
    { type: 'number', name: 'target_price', label: 'Target Price ($)', placeholder: '999' },
  ],
  digestbot: [
    { type: 'text',   name: 'topics',   label: 'Topics (comma-separated)', placeholder: 'AI, crypto, climate' },
    { type: 'select', name: 'delivery', label: 'Delivery Channel',
      options: [{ value: 'email', label: 'Email' }, { value: 'telegram', label: 'Telegram' }] },
  ],
  mentionalert: [
    { type: 'text', name: 'keyword', label: 'Keyword / Brand', placeholder: 'your brand name' },
    {
      type: 'checkboxGroup',
      name: 'sources',
      label: 'Sources',
      options: [
        { value: 'web',    label: 'Web' },
        { value: 'reddit', label: 'Reddit' },
        { value: 'news',   label: 'News' },
      ],
    },
  ],
  rankwatch: [
    { type: 'text', name: 'domain',  label: 'Domain',  placeholder: 'example.com' },
    { type: 'text', name: 'keyword', label: 'Keyword', placeholder: 'best coffee maker' },
  ],
  jobradar: [
    { type: 'text',     name: 'keywords',  label: 'Keywords',  placeholder: 'python, backend, senior' },
    { type: 'text',     name: 'location',  label: 'Location',  placeholder: 'San Francisco, CA' },
    { type: 'text',     name: 'job_title', label: 'Job Title', placeholder: 'Software Engineer' },
    { type: 'checkbox', name: 'remote',    label: 'Remote only' },
  ],
  leaseguard: [
    { type: 'text',   name: 'location',     label: 'Location',        placeholder: 'Austin, TX' },
    { type: 'number', name: 'max_price',    label: 'Max Price ($/mo)', placeholder: '2000' },
    { type: 'number', name: 'min_bedrooms', label: 'Min Bedrooms',    placeholder: '2' },
    { type: 'text',   name: 'keywords',     label: 'Keywords',        placeholder: 'parking, pets' },
  ],
}

export default function AddMonitorForm({
  moduleType,
  initialValues = {},
  onSubmit,
  isLoading = false,
}: AddMonitorFormProps) {
  const [name, setName] = useState((initialValues.name as string) || '')
  const [fields, setFields] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    MODULE_FIELDS[moduleType].forEach((f) => {
      init[f.name] = initialValues[f.name] ?? (f.type === 'checkbox' ? false : f.type === 'checkboxGroup' ? [] : '')
    })
    return init
  })
  const [error, setError] = useState<string | null>(null)

  const handleField = (name: string, value: unknown) => {
    setFields((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxGroup = (fieldName: string, value: string, checked: boolean) => {
    setFields((prev) => {
      const current = (prev[fieldName] as string[]) || []
      return {
        ...prev,
        [fieldName]: checked ? [...current, value] : current.filter((v) => v !== value),
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Monitor name is required'); return }
    try {
      // Normalise field values before submission
      const config: Record<string, unknown> = {}
      MODULE_FIELDS[moduleType].forEach((f) => {
        const val = fields[f.name]
        if (f.name === 'topics' || (f.name === 'keywords' && f.type === 'text')) {
          // Split comma-separated text into array
          config[f.name] = typeof val === 'string'
            ? val.split(',').map((s) => s.trim()).filter(Boolean)
            : val
        } else if (f.type === 'number') {
          // Convert empty string to null for optional number fields
          config[f.name] = val === '' ? null : val
        } else {
          config[f.name] = val
        }
      })
      await onSubmit(name.trim(), config)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save monitor')
    }
  }

  const fieldDefs = MODULE_FIELDS[moduleType]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Monitor Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My monitor"
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
        />
      </div>

      {/* Module-specific fields */}
      {fieldDefs.map((field) => {
        if (field.type === 'text' || field.type === 'number') {
          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-300 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={fields[field.name] as string}
                onChange={(e) => {
                  const raw = e.target.value
                  handleField(field.name, field.type === 'number' ? (raw === '' ? '' : parseFloat(raw)) : raw)
                }}
                placeholder={field.placeholder}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          )
        }
        if (field.type === 'select') {
          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-300 mb-1">{field.label}</label>
              <select
                value={fields[field.name] as string}
                onChange={(e) => handleField(field.name, e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )
        }
        if (field.type === 'checkbox') {
          return (
            <label key={field.name} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fields[field.name] as boolean}
                onChange={(e) => handleField(field.name, e.target.checked)}
                className="w-4 h-4 accent-teal-500"
              />
              <span className="text-sm text-gray-300">{field.label}</span>
            </label>
          )
        }
        if (field.type === 'checkboxGroup') {
          const selected = (fields[field.name] as string[]) || []
          return (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-300 mb-2">{field.label}</label>
              <div className="flex gap-4">
                {field.options.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={(e) => handleCheckboxGroup(field.name, opt.value, e.target.checked)}
                      className="w-4 h-4 accent-teal-500"
                    />
                    <span className="text-sm text-gray-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        }
        return null
      })}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 transition-colors"
      >
        {isLoading ? 'Saving…' : 'Save Monitor'}
      </button>
    </form>
  )
}
