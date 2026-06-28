import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ReferralsClient } from '@/components/admin/ReferralsClient'

export default async function ReferralsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const [{ data: referrals }, { data: tenantRow }] = await Promise.all([
    supabaseAdmin
      .from('referrals')
      .select('*, referrer:tenants!referrer_tenant_id(slug, referral_code), referred:tenants!referred_tenant_id(slug)')
      .or(`referrer_tenant_id.eq.${tenant.id},referred_tenant_id.eq.${tenant.id}`)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('tenants').select('referral_code').eq('id', tenant.id).maybeSingle(),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Referrals</h1>
      <ReferralsClient
        initialReferrals={referrals || []}
        tenantSlug={tenant.slug}
        tenantId={tenant.id}
        referralCode={tenantRow?.referral_code || ''}
        appUrl={appUrl}
        slug={slug}
      />
    </div>
  )
}
