'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const FLAGS = [
  {
    key: 'ai_campaigns_auto',
    label: 'AI Campaign Auto-Generation',
    description: 'Generates campaign suggestions automatically via AI (pending feature)',
  },
  {
    key: 'google_oauth',
    label: 'Google OAuth',
    description: 'Enable Google sign-in for restaurant owners',
  },
  {
    key: 'public_minisite',
    label: 'Public Mini-Site',
    description: 'Enable public /r/[slug] page for the restaurant',
  },
  {
    key: 'early_access',
    label: 'Early Access',
    description: 'Mark tenant as early access to test unreleased features',
  },
]

interface Props {
  tenantId: string
  tenantName: string
  initialFlags: Record<string, boolean>
}

export function FeatureFlagsClient({ tenantId, tenantName, initialFlags }: Props) {
  const [flags, setFlags]   = useState<Record<string, boolean>>(initialFlags)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]   = useState('')

  const toggle = async (flagKey: string, value: boolean) => {
    setLoading(flagKey)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/superadmin/feature-flags', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, flagKey, value, tenantName }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setError(data.error || 'Failed to update flag'); return }
    setFlags(data.flags ?? { ...flags, [flagKey]: value })
  }

  return (
    <div className="space-y-3">
      {FLAGS.map(flag => {
        const enabled = flags[flag.key] ?? false
        const isLoading = loading === flag.key
        return (
          <div key={flag.key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-offwhite/80">{flag.label}</p>
              <p className="text-xs text-offwhite/30 mt-0.5">{flag.description}</p>
            </div>
            <button
              onClick={() => toggle(flag.key, !enabled)}
              disabled={isLoading}
              className={`shrink-0 w-10 h-5 rounded-full border transition-all relative disabled:opacity-40 ${
                enabled
                  ? 'bg-sage/30 border-sage/50'
                  : 'bg-white/[0.06] border-white/[0.12]'
              }`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                enabled ? 'left-5 bg-sage' : 'left-0.5 bg-white/30'
              }`} />
            </button>
          </div>
        )
      })}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
