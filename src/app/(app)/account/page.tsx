import { requireUser, getUserTenants } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AccountClient } from '@/components/admin/AccountClient'

export default async function AccountPage() {
  const user    = await requireUser()
  const members = await getUserTenants(user.id)

  const tenants = members
    .map((m: any) => m.tenants)
    .filter(Boolean)
    .map((t: any) => ({ id: t.id, slug: t.slug, referral_code: t.referral_code ?? null }))

  const tenantIds = tenants.map((t: { id: string }) => t.id)

  const referrals = tenantIds.length > 0
    ? await (async () => {
        const filter = tenantIds
          .map((id: string) => `referrer_tenant_id.eq.${id},referred_tenant_id.eq.${id}`)
          .join(',')
        const { data } = await supabaseAdmin
          .from('referrals')
          .select('*, referrer:tenants!referrer_tenant_id(slug, referral_code), referred:tenants!referred_tenant_id(slug)')
          .or(filter)
          .order('created_at', { ascending: false })
        return data ?? []
      })()
    : []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const firstSlug = tenants[0]?.slug ?? null

  return (
    <div className="min-h-screen bg-midnight text-offwhite">
      {/* Top bar */}
      <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a
          href={firstSlug ? `/restaurant/${firstSlug}` : '/dashboard'}
          className="text-sm text-offwhite/40 hover:text-offwhite/80 transition-colors flex items-center gap-1.5"
        >
          ← {firstSlug ? 'Back to restaurant' : 'Dashboard'}
        </a>
        <span className="text-offwhite/15">|</span>
        <span className="text-sm font-semibold text-offwhite">My account</span>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="mb-10">
          <h1 className="font-satoshi font-bold text-[22px] text-offwhite">My account</h1>
          <p className="text-sm text-offwhite/40 mt-1">Profile and referrals</p>
        </div>
        <AccountClient
          userEmail={user.email ?? ''}
          tenants={tenants}
          referrals={referrals}
          appUrl={appUrl}
        />
      </div>
    </div>
  )
}
