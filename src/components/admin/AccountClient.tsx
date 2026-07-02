'use client'
import { useState } from 'react'

interface TenantRow {
  id: string
  slug: string
  referral_code: string | null
}

interface Referral {
  id: string
  referrer_tenant_id: string
  referred_tenant_id: string
  created_at: string
  referral_code_used: string | null
  referrer_coupon_id: string | null
  referred_coupon_id: string | null
  referrer: { slug: string; referral_code?: string } | null
  referred: { slug: string } | null
}

interface Props {
  userEmail: string
  tenants: TenantRow[]
  referrals: Referral[]
  appUrl: string
}

export function AccountClient({ userEmail, tenants, referrals, appUrl }: Props) {
  return (
    <div className="space-y-12">
      <ProfileSection userEmail={userEmail} />
      <ReferralsSection tenants={tenants} referrals={referrals} appUrl={appUrl} />
    </div>
  )
}

function ProfileSection({ userEmail }: { userEmail: string }) {
  return (
    <section>
      <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-6">
        Profile
      </h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {userEmail?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{userEmail}</p>
          <p className="text-xs text-gray-500 mt-0.5">Account email</p>
        </div>
      </div>
    </section>
  )
}

function ReferralsSection({ tenants, referrals, appUrl }: { tenants: TenantRow[]; referrals: Referral[]; appUrl: string }) {
  const tenantIds = tenants.map(t => t.id)

  const allReferred   = referrals.filter(r => tenantIds.includes(r.referrer_tenant_id))
  const referredByRow = referrals.find(r => tenantIds.includes(r.referred_tenant_id))

  // Use first tenant's referral code (most users have one restaurant)
  const primaryTenant = tenants[0]
  const referralCode  = primaryTenant?.referral_code || ''
  const registerUrl   = `${appUrl}/register?ref=${referralCode}`

  return (
    <section>
      <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-6">
        Referrals
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Share your code with other restaurant owners. When they sign up and subscribe, you both get{' '}
        <strong className="text-white">50% off for 3 months</strong>.
      </p>

      {tenants.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Create your first restaurant to get a referral code.</p>
        </div>
      ) : (
        <>
          <ReferralCodeCard referralCode={referralCode} registerUrl={registerUrl} />

          {referredByRow && (
            <div className="mt-8">
              <h3 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Referred by</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <p className="text-sm text-white font-medium">{referredByRow.referrer?.slug ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Code: <span className="font-mono text-gray-400">{referredByRow.referral_code_used ?? '—'}</span>
                  {' · '}Joined {new Date(referredByRow.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                {referredByRow.referred_coupon_id && (
                  <p className="text-xs text-green-400 mt-2">✓ 50% discount applied for 3 months</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">
              Restaurants referred ({allReferred.length})
            </h3>
            {allReferred.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-500">No referrals yet. Share your code to earn discounts!</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Restaurant', 'Joined', 'Discount'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allReferred.map(r => (
                      <tr key={r.id} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-5 py-4 text-sm font-medium text-white">{r.referred?.slug ?? '—'}</td>
                        <td className="px-5 py-4 text-sm text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          {r.referrer_coupon_id
                            ? <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">50% for 3 months</span>
                            : <span className="text-xs text-gray-600">Pending</span>}
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
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const share = async () => {
    const text = `Use code ${referralCode} when signing up at ${registerUrl} to get 50% off Nativ for your first 3 months.`
    if (navigator.share) {
      await navigator.share({ title: 'Join Nativ', text, url: registerUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Your referral code</p>
      <p className="font-mono text-5xl font-bold text-white tracking-[0.2em] mb-5">
        {referralCode || '···'}
      </p>
      <div className="flex justify-center gap-3">
        <button onClick={copy}
          className="flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition">
          {copied ? '✓ Copied' : 'Copy code'}
        </button>
        <button onClick={share}
          className="flex items-center gap-2 bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-700 transition border border-gray-700">
          Share
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-4">
        Direct link: <a href={registerUrl} target="_blank" rel="noopener noreferrer"
          className="text-gray-400 underline hover:text-white transition">{registerUrl}</a>
      </p>
    </div>
  )
}
