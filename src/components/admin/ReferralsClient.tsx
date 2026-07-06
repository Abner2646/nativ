'use client'
import { useState } from 'react'
import { getTenantDomain } from '@/lib/domain'

interface Referral {
  id: string
  referrer_tenant_id: string
  referred_tenant_id: string
  created_at: string
  referrer_coupon_id: string | null
  referred_coupon_id: string | null
  referral_code_used: string | null
  referrer: { slug: string; referral_code?: string } | null
  referred: { slug: string } | null
}

interface Props {
  initialReferrals: Referral[]
  tenantSlug: string
  tenantId: string
  referralCode: string
  appUrl: string
  slug: string
}

const cardBg = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

export function ReferralsClient({ initialReferrals, tenantId, referralCode, appUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const referred   = initialReferrals.filter(r => r.referrer_tenant_id === tenantId)
  const referredBy = initialReferrals.find(r => r.referred_tenant_id === tenantId)

  const shareText = `Use code ${referralCode} when signing up at ${appUrl}/register to get 50% off Nativ for your first 3 months.`
  const registerUrl = `${appUrl}/register?ref=${referralCode}`

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareCode = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join Nativ', text: shareText, url: registerUrl }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sectionTitle = (t: string) => (
    <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold pb-3 mb-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {t}
    </h2>
  )

  return (
    <div className="max-w-2xl space-y-10">

      {/* ── Your referral code ── */}
      <section>
        {sectionTitle('Your referral code')}
        <p className="text-sm text-offwhite/50 mb-5">
          Share this code with other restaurant owners. When they sign up and subscribe, you both get{' '}
          <strong className="text-offwhite">50% off for 3 months</strong>.
        </p>

        <div className="rounded-2xl p-6 mb-4 text-center" style={cardBg}>
          <p className="text-xs text-offwhite/35 uppercase tracking-widest mb-2">Your code</p>
          <p className="font-satoshi font-bold text-5xl text-offwhite tracking-[0.2em] mb-5">
            {referralCode || '···'}
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={copyCode}
              className="flex items-center gap-2 bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition"
            >
              {copied ? <><span>✓</span> Copied</> : <><CopyIcon /> Copy code</>}
            </button>
            <button
              onClick={shareCode}
              className="flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl text-sm transition text-offwhite/70 hover:text-offwhite"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <ShareIcon /> Share
            </button>
          </div>
        </div>

        <p className="text-xs text-offwhite/25 text-center">
          Recipients enter code <span className="font-mono text-offwhite/40">{referralCode}</span> at signup
          {' · '}
          <a href={registerUrl} target="_blank" rel="noopener noreferrer"
            className="text-offwhite/40 underline hover:text-offwhite transition break-all">
            {registerUrl}
          </a>
        </p>
      </section>

      {/* ── Referred by ── */}
      {referredBy && (
        <section>
          {sectionTitle('Referred by')}
          <div className="rounded-xl px-4 py-4" style={cardBg}>
            <p className="text-sm text-offwhite font-medium">
              {referredBy.referrer?.slug ? getTenantDomain(referredBy.referrer.slug) : '—'}
            </p>
            <p className="text-xs text-offwhite/40 mt-1">
              Code used: <span className="font-mono text-offwhite/50">{referredBy.referral_code_used || referredBy.referrer?.referral_code || '—'}</span>
              {' · '}Joined {new Date(referredBy.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            {referredBy.referred_coupon_id && (
              <p className="text-xs text-sage mt-2">✓ 50% discount applied for 3 months</p>
            )}
          </div>
        </section>
      )}

      {/* ── Restaurants you referred ── */}
      <section>
        {sectionTitle(`Restaurants you referred (${referred.length})`)}
        {referred.length === 0 ? (
          <div className="p-10 text-center rounded-2xl" style={cardBg}>
            <p className="text-sm text-offwhite/35">No referrals yet. Share your code to earn discounts!</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {referred.map(r => (
                <div key={r.id} className="rounded-2xl px-4 py-3.5" style={cardBg}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-offwhite truncate">
                      {r.referred?.slug ? getTenantDomain(r.referred.slug) : '—'}
                    </p>
                    {r.referrer_coupon_id ? (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: 'rgba(111,143,123,0.15)', color: '#6F8F7B', border: '1px solid rgba(111,143,123,0.25)' }}>
                        50% off
                      </span>
                    ) : (
                      <span className="text-xs text-offwhite/30 shrink-0">Pending</span>
                    )}
                  </div>
                  <p className="text-xs text-offwhite/40 mt-1">
                    Joined {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={cardBg}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Restaurant', 'Joined', 'Discount'].map(h => (
                      <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referred.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-4 text-sm font-medium text-offwhite">
                        {r.referred?.slug ? getTenantDomain(r.referred.slug) : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-offwhite/40">
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        {r.referrer_coupon_id ? (
                          <span className="text-xs px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: 'rgba(111,143,123,0.15)', color: '#6F8F7B', border: '1px solid rgba(111,143,123,0.25)' }}>
                            50% for 3 months
                          </span>
                        ) : (
                          <span className="text-xs text-offwhite/30">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="rounded-xl p-4" style={cardBg}>
        <p className="text-sm text-offwhite/50">
          <strong className="text-offwhite">How it works:</strong> Share your 6-digit code. When a restaurant signs up using it and subscribes, you both receive 50% off for 3 months — applied automatically.
        </p>
      </div>
    </div>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}
