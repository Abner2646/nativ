import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { CampaignsClient } from '@/components/admin/CampaignsClient'

export default async function CampaignsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)

  const { tenant } = access

  const [{ data: campaigns }, { data: birthdayConfig }] = await Promise.all([
    supabaseAdmin
      .from('ai_campaigns')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('suggested_at', { ascending: false }),
    supabaseAdmin
      .from('birthday_campaign_config')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">AI Campaigns</h1>
      <CampaignsClient
        initialCampaigns={campaigns || []}
        initialBirthdayConfig={birthdayConfig}
        slug={slug}
      />
    </div>
  )
}
