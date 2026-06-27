'use client'
import { useState } from 'react'

interface Referral {
  id: string
  referrer_tenant_id: string
  referred_tenant_id: string
  created_at: string
  referrer_coupon_id: string | null
  referred_coupon_id: string | null
  referrer: { slug: string } | null
  referred: { slug: string } | null
}

interface Props {
  initialReferrals: Referral[]
  tenantSlug: string
  tenantId: string
  appUrl: string
  slug: string
}

export function ReferralsClient({ initialReferrals, tenantSlug, tenantId, appUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const referralLink = `${appUrl}/register?ref=${tenantSlug}`

  const copy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const referred = initialReferrals.filter(r => r.referrer_tenant_id === tenantId)
  const referredBy = initialReferrals.find(r => r.referred_tenant_id === tenantId)

  return (
    <div className="max-w-2xl space-y-10">

      {/* Referral link */}
      <section>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
          Your referral link
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Share this link with other restaurant owners. When they subscribe, you both get 50% off for 3 months.
        </p>
        <div className="flex gap-3">
          <input
            readOnly
            value={referralLink}
            className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none font-mono"
          />
          <button
            onClick={copy}
            className="bg-white text-black font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </section>

      {/* Who referred you */}
      {referredBy && (
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
            Referred by
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
            <p className="text-sm text-white font-medium">{referredBy.referrer?.slug}.nativ.com</p>
            <p className="text-xs text-gray-500 mt-1">
              Joined {new Date(referredBy.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            {referredBy.referred_coupon_id && (
              <p className="text-xs text-green-400 mt-2">50% discount applied to your account for 3 months.</p>
            )}
          </div>
        </section>
      )}

      {/* Restaurants you referred */}
      <section>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
          Restaurants you referred ({referred.length})
        </h2>
        {referred.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">No referrals yet. Share your link to earn discounts!</p>
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
                {referred.map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-5 py-4 text-sm font-medium text-white">
                      {r.referred?.slug}.nativ.com
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      {r.referrer_coupon_id ? (
                        <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">50% for 3 months</span>
                      ) : (
                        <span className="text-xs text-gray-600">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <p className="text-sm text-gray-400">
          <strong className="text-white">How it works:</strong> When a restaurant signs up using your link and subscribes to Nativ, you both receive a 50% discount coupon applied automatically for 3 months.
        </p>
      </div>
    </div>
  )
}
