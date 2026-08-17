import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { WaitlistClient } from '@/components/admin/WaitlistClient'

export default async function WaitlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const { data: entries } = await supabaseAdmin
    .from('waitlist_entries')
    .select('id, name, phone, party_size, quoted_minutes, created_at')
    .eq('tenant_id', tenant.id)
    .eq('status', 'waiting')
    .order('created_at')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="font-satoshi font-bold text-[22px] text-offwhite">Waitlist</h1>
        <p className="text-sm text-offwhite/35 mt-1">
          Walk-ins waiting for an available table. Add them here, then seat them when a spot opens.
        </p>
      </div>
      <WaitlistClient
        slug={slug}
        tenantId={tenant.id}
        initialEntries={entries || []}
      />
    </div>
  )
}
