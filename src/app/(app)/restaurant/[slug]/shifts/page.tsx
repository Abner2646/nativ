import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ShiftsClient } from '@/components/admin/ShiftsClient'

export default async function ShiftsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const [{ data: shifts }, { data: areas }] = await Promise.all([
    supabaseAdmin
      .from('shifts')
      .select('*, shift_areas(*, seating_areas(id, name))')
      .eq('tenant_id', tenant.id)
      .order('day_of_week')
      .order('start_time'),
    supabaseAdmin
      .from('seating_areas')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('position'),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Shifts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure when your restaurant accepts reservations and how many covers each area can take.
        </p>
      </div>
      <ShiftsClient
        initialShifts={shifts || []}
        areas={areas || []}
        slug={slug}
      />
    </div>
  )
}
