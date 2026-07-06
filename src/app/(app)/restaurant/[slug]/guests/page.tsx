import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { GuestsClient } from '@/components/admin/GuestsClient'

export default async function GuestsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const { data: guests, count } = await supabaseAdmin
    .from('guests')
    .select('*, guest_tags(id, tag)', { count: 'exact' })
    .eq('tenant_id', tenant.id)
    .order('visit_count', { ascending: false })
    .limit(50)

  return (
    <div className="p-4 md:p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-6 md:mb-8">Guests</h1>
      <GuestsClient
        initialGuests={guests || []}
        slug={slug}
        total={count || 0}
      />
    </div>
  )
}
