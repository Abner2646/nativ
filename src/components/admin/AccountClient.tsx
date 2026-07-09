'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'

interface TenantRow { id: string; slug: string; referral_code: string | null }
interface Referral {
  id: string; referrer_tenant_id: string; referred_tenant_id: string; created_at: string
  referral_code_used: string | null; referrer_coupon_id: string | null; referred_coupon_id: string | null
  referrer: { slug: string; referral_code?: string } | null; referred: { slug: string } | null
}
interface Props { userEmail: string; tenants: TenantRow[]; referrals: Referral[]; appUrl: string }

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold pb-3 mb-6"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {title}
    </h2>
  )
}

export function AccountClient({ userEmail, tenants, referrals, appUrl }: Props) {
  return (
    <div className="space-y-12">
      <ProfileSection userEmail={userEmail} />
      <SecuritySection />
      <ReferralsSection tenants={tenants} referrals={referrals} appUrl={appUrl} />
    </div>
  )
}

function SecuritySection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'

  const changePassword = async () => {
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords don\'t match'); return }
    setSaving(true)
    const { error } = await getBrowserSupabase().auth.updateUser({ password })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setPassword(''); setConfirm('')
    toast.success('Password updated')
  }

  return (
    <section>
      <SectionHeader title="Security" />
      <div className="px-5 py-5 rounded-2xl max-w-md space-y-3"
        style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-sm font-medium text-offwhite mb-1">Change password</p>
        <input type="password" placeholder="New password" value={password}
          onChange={e => setPassword(e.target.value)} className={inputCls} />
        <input type="password" placeholder="Confirm new password" value={confirm}
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && changePassword()}
          className={inputCls} />
        <button onClick={changePassword} disabled={saving || !password || !confirm}
          className="bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </section>
  )
}

function ProfileSection({ userEmail }: { userEmail: string }) {
  return (
    <section>
      <SectionHeader title="Profile" />
      <div className="flex items-center gap-4 px-5 py-4 rounded-2xl"
        style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-offwhite shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
          {userEmail?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-offwhite">{userEmail}</p>
          <p className="text-xs text-offwhite/35 mt-0.5">Account email</p>
        </div>
      </div>
    </section>
  )
}

function ReferralsSection({ tenants, referrals, appUrl }: { tenants: TenantRow[]; referrals: Referral[]; appUrl: string }) {
  const tenantIds = tenants.map(t => t.id)
  const allReferred   = referrals.filter(r => tenantIds.includes(r.referrer_tenant_id))
  const referredByRow = referrals.find(r => tenantIds.includes(r.referred_tenant_id))
  const primaryTenant = tenants[0]
  const referralCode  = primaryTenant?.referral_code || ''
  const registerUrl   = `${appUrl}/register?ref=${referralCode}`

  return (
    <section>
      <SectionHeader title="Referrals" />
      <p className="text-sm text-offwhite/50 mb-6">
        Share your code with other restaurant owners. When they sign up and subscribe, you both get{' '}
        <strong className="text-offwhite/80">50% off for 3 months</strong>.
      </p>

      {tenants.length === 0 ? (
        <div className="p-8 text-center rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm text-offwhite/35">Create your first restaurant to get a referral code.</p>
        </div>
      ) : (
        <>
          <ReferralCodeCard referralCode={referralCode} registerUrl={registerUrl} />

          {referredByRow && (
            <div className="mt-8">
              <h3 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold mb-3">Referred by</h3>
              <div className="px-5 py-4 rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm text-offwhite font-medium">{referredByRow.referrer?.slug ?? '—'}</p>
                <p className="text-xs text-offwhite/40 mt-1">
                  Code: <span className="font-mono text-offwhite/50">{referredByRow.referral_code_used ?? '—'}</span>
                  {' · '}Joined {new Date(referredByRow.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                {referredByRow.referred_coupon_id && (
                  <p className="text-xs text-sage mt-2">✓ 50% discount applied for 3 months</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold mb-3">
              Restaurants referred ({allReferred.length})
            </h3>
            {allReferred.length === 0 ? (
              <div className="p-8 text-center rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm text-offwhite/35">No referrals yet. Share your code to earn discounts!</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Restaurant', 'Joined', 'Discount'].map(h => (
                        <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allReferred.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="px-5 py-4 text-sm font-medium text-offwhite">{r.referred?.slug ?? '—'}</td>
                        <td className="px-5 py-4 text-sm text-offwhite/50">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          {r.referrer_coupon_id
                            ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage/15 text-sage border border-sage/30">50% for 3 months</span>
                            : <span className="text-xs text-offwhite/25">Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function ReferralCodeCard({ referralCode, registerUrl }: { referralCode: string; registerUrl: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const share = async () => {
    const text = `Use code ${referralCode} when signing up at ${registerUrl} to get 50% off Nativ for your first 3 months.`
    if (navigator.share) {
      await navigator.share({ title: 'Join Nativ', text, url: registerUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-xs text-offwhite/35 uppercase tracking-widest mb-2 font-semibold">Your referral code</p>
      <p className="font-mono font-bold text-offwhite tracking-[0.2em] mb-5" style={{ fontSize: '3rem', lineHeight: 1.1 }}>
        {referralCode || '···'}
      </p>
      <div className="flex justify-center gap-3">
        <button onClick={copy}
          className="flex items-center gap-2 bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors">
          {copied ? '✓ Copied' : 'Copy code'}
        </button>
        <button onClick={share}
          className="flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors text-offwhite/70 hover:text-offwhite"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
          Share
        </button>
      </div>
      <p className="text-xs text-offwhite/25 mt-4">
        Direct link:{' '}
        <a href={registerUrl} target="_blank" rel="noopener noreferrer"
          className="text-offwhite/40 underline hover:text-offwhite/70 transition-colors">{registerUrl}</a>
      </p>
    </div>
  )
}
