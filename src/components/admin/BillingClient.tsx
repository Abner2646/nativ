'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Tenant } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  tenant: Tenant
  slug: string
  success?: boolean
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trial: { label: 'Free trial', color: 'text-yellow-400' },
  active: { label: 'Active', color: 'text-green-400' },
  inactive: { label: 'Inactive', color: 'text-red-400' },
}

export function BillingClient({ tenant, slug, success }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const status = STATUS_LABELS[tenant.status] || STATUS_LABELS.inactive
  const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
    : 0

  const goToCheckout = async () => {
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch(`/api/billing/checkout?tenant=${slug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      setError(data.error || 'Could not start checkout')
      setLoading(false)
      return
    }
    window.location.href = data.url
  }

  const goToPortal = async () => {
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch(`/api/billing/portal?tenant=${slug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      setError(data.error || 'Could not open billing portal')
      setLoading(false)
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="max-w-lg space-y-6">
      {success && (
        <div className="px-4 py-3 bg-green-900/30 border border-green-800 rounded-xl text-sm text-green-400">
          Subscription activated! Your account is now active.
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current plan</p>
            <p className="text-white font-medium">Nativ {tenant.status === 'active' ? 'Pro' : 'Free Trial'}</p>
          </div>
          <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
        </div>

        {tenant.status === 'trial' && trialEnd && (
          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400">
              Your free trial ends on{' '}
              <span className="text-white">
                {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              {trialDaysLeft > 0 ? ` — ${trialDaysLeft} days left.` : ' — trial has ended.'}
            </p>
          </div>
        )}

        {tenant.status === 'active' && (
          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400">
              Subscription ID:{' '}
              <span className="text-white font-mono text-xs">{tenant.stripe_subscription_id || '—'}</span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {tenant.status !== 'active' && (
        <button
          onClick={goToCheckout}
          disabled={loading}
          className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
        >
          {loading ? 'Redirecting…' : 'Subscribe — $49 / month'}
        </button>
      )}

      {tenant.status === 'active' && tenant.stripe_customer_id && (
        <button
          onClick={goToPortal}
          disabled={loading}
          className="w-full bg-gray-800 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition disabled:opacity-40"
        >
          {loading ? 'Redirecting…' : 'Manage subscription'}
        </button>
      )}

      <p className="text-xs text-gray-600">
        Payments processed securely by Stripe. Cancel anytime.
      </p>
    </div>
  )
}
