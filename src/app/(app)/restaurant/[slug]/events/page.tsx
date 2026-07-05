import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { EventsClient } from '@/components/admin/EventsClient'

export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)

  const { tenant } = access

  const [{ data: events }, { data: blocked }] = await Promise.all([
    supabaseAdmin
      .from('special_events')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('date'),
    supabaseAdmin
      .from('blocked_dates')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('date'),
  ])

  return (
    <div className="p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-8">Events & Availability</h1>
      <EventsClient
        initialEvents={events || []}
        initialBlocked={blocked || []}
        slug={slug}
      />
    </div>
  )
}
