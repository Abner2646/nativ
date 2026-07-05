'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Tenant } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props { tenant: Tenant; slug: string; success?: boolean; hasReferral?: boolean }

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  trial:    { label: 'Free trial',  badge: 'bg-gold/12 text-gold border border-gold/25' },
  active:   { label: 'Active',      badge: 'bg-sage/15 text-sage border border-sage/30' },
  inactive: { label: 'Inactive',    badge: 'bg-red-400/10 text-red-400 border border-red-400/20' },
}

export function BillingClient({ tenant, slug, success, hasReferral }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refCode, setRefCode] = useState('')
  const [refLoading, setRefLoading] = useState(false)
  const [refError, setRefError] = useState('')
  const [refApplied, setRefApplied] = useState(false)

  const status = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.inactive
  const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0
  const showReferralInput = tenant.status === 'trial' && !hasReferral && !refApplied

  const applyRefCode = async () => {
    if (!/^\d{6}$/.test(refCode.trim())) { setRefError('Enter a valid 6-digit referral code'); return }
    setRefLoading(true); setRefError('')
    const token = await getToken()
    const res = await fetch(`/api/referral/apply?tenant=${slug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: refCode.trim() }),
    })
    const data = await res.json()
    setRefLoading(false)
    if (!res.ok) { setRefError(data.error || 'Could not apply referral code'); return }
    setRefApplied(true); setRefCode('')
  }

  const goToCheckout = async () => {
    setLoading(true); setError('')
    const token = await getToken()
    const res = await fetch(`/api/billing/checkout?tenant=${slug}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok || !data.url) { setError(data.error || 'Could not start checkout'); setLoading(false); return }
    window.location.href = data.url
  }

  const goToPortal = async () => {
    setLoading(true); setError('')
    const token = await getToken()
    const res = await fetch(`/api/billing/portal?tenant=${slug}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok || !data.url) { setError(data.error || 'Could not open billing portal'); setLoading(false); return }
    window.location.href = data.url
  }

  const cardStyle = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="max-w-lg space-y-5">
      {success && (
        <div className="px-4 py-3 rounded-xl text-sm text-sage" style={{ backgroundColor: 'rgba(111,143,123,0.10)', border: '1px solid rgba(111,143,123,0.25)' }}>
          Subscription activated! Your account is now active.
        </div>
      )}

      <div className="rounded-2xl p-6 space-y-4" style={cardStyle}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-offwhite/35 uppercase tracking-widest mb-1 font-semibold">Current plan</p>
            <p className="text-offwhite font-medium">Nativ {tenant.status === 'active' ? 'Pro' : 'Free Trial'}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.badge}`}>{status.label}</span>
        </div>
        {tenant.status === 'trial' && trialEnd && (
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm text-offwhite/50">
              Your free trial ends on{' '}
              <span className="text-offwhite">
                {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              {trialDaysLeft > 0 ? ` — ${trialDaysLeft} days left.` : ' — trial has ended.'}
            </p>
          </div>
        )}
        {tenant.status === 'active' && (
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm text-offwhite/50">
              Subscription ID:{' '}
              <span className="text-offwhite font-mono text-xs">{tenant.stripe_subscription_id || '—'}</span>
            </p>
          </div>
        )}
      </div>

      {showReferralInput && (
        <div className="rounded-2xl p-6 space-y-3" style={cardStyle}>
          <p className="text-sm font-medium text-offwhite">Have a referral code?</p>
          <p className="text-xs text-offwhite/40">
            Enter the 6-digit code you received — you'll get 50% off for 3 months when you subscribe.
          </p>
          <div className="flex gap-2">
            <input type="text" maxLength={6} placeholder="123456" value={refCode}
              onChange={e => setRefCode(e.target.value.replace(/\D/g, ''))}
              className="flex-1 text-offwhite text-sm placeholder-offwhite/20 font-mono tracking-widest rounded-xl px-3 py-2 focus:outline-none focus:border-white/25"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }} />
            <button onClick={applyRefCode} disabled={refLoading || refCode.length !== 6}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 text-offwhite"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {refLoading ? '…' : 'Apply'}
            </button>
          </div>
          {refError && <p className="text-xs text-red-400">{refError}</p>}
        </div>
      )}

      {refApplied && (
        <div className="px-4 py-3 rounded-xl text-sm text-sage" style={{ backgroundColor: 'rgba(111,143,123,0.10)', border: '1px solid rgba(111,143,123,0.25)' }}>
          Referral code applied! You'll get 50% off for 3 months on your subscription.
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {tenant.status !== 'active' && (
        <button onClick={goToCheckout} disabled={loading}
          className="w-full bg-offwhite text-midnight font-semibold py-3 rounded-xl hover:bg-offwhite/90 transition-colors disabled:opacity-40">
          {loading ? 'Redirecting…' : 'Subscribe — $49 / month'}
        </button>
      )}

      {tenant.status === 'active' && tenant.stripe_customer_id && (
        <button onClick={goToPortal} disabled={loading}
          className="w-full font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 text-offwhite/70 hover:text-offwhite"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {loading ? 'Redirecting…' : 'Manage subscription'}
        </button>
      )}

      <p className="text-xs text-offwhite/25">Payments processed securely by Stripe. Cancel anytime. <span className="italic">Really, anytime.</span></p>
    </div>
  )
}
