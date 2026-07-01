import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ReservationsClient } from '@/components/admin/ReservationsClient'

export default async function ReservationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access
  const today = new Date().toISOString().split('T')[0]

  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*)')
    .eq('tenant_id', tenant.id)
    .eq('date', today)
    .order('time')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Reservations</h1>
      <ReservationsClient
        initialReservations={reservations || []}
        slug={slug}
        defaultDate={today}
      />
    </div>
  )
}
