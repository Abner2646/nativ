import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { EmbedClient } from '@/components/admin/EmbedClient'

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', access.tenant.id)
    .maybeSingle()

  return (
    <div className="p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-2">Embed & share</h1>
      <p className="text-sm text-offwhite/40 mb-8">Let guests book directly from your website or any link.</p>
      <EmbedClient slug={slug} settings={settings} />
    </div>
  )
}
