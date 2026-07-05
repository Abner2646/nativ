import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { SettingsClient } from '@/components/admin/SettingsClient'
import { TenantSettings } from '@/lib/types'

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single()

  if (!settings) return notFound()

  return (
    <div className="p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-8">Settings</h1>
      <SettingsClient settings={settings as TenantSettings} slug={slug} />
    </div>
  )
}
