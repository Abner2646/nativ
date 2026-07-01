import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { BillingClient } from '@/components/admin/BillingClient'
import { Tenant } from '@/lib/types'

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ success?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const [{ data: tenant }, { data: referral }] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('id', access.tenant.id).single(),
    supabaseAdmin.from('referrals').select('id').eq('referred_tenant_id', access.tenant.id).maybeSingle(),
  ])

  if (!tenant) return notFound()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Billing</h1>
      <BillingClient
        tenant={tenant as Tenant}
        slug={slug}
        success={sp.success === 'true'}
        hasReferral={!!referral}
      />
    </div>
  )
}
