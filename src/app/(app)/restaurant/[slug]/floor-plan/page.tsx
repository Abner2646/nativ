import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { FloorPlanClient } from '@/components/admin/FloorPlanClient'

export default async function FloorPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  // Empleados acceden a la vista de servicio; el editor se gatea por rol en el cliente
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()
  const { tenant, role } = access

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings').select('timezone').eq('tenant_id', tenant.id).single()
  const tz = settings?.timezone || 'America/New_York'
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  // Estado de servicio completo en el server: FloorService arranca con data
  // real en vez de mostrar su propio "loading" después del skeleton.
  const [{ data: areas }, { data: tables }, { data: reservations }, { data: combos }, { data: waitlist }] = await Promise.all([
    supabaseAdmin.from('seating_areas').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('position'),
    supabaseAdmin.from('restaurant_tables').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at'),
    supabaseAdmin.from('reservations')
      .select('id, time, party_size, status, occasion, notes, seated_at, finished_at, source, seating_area_id, shift_id, duration_minutes, guest:guests(name, phone), table_assignments(table_id), shift:shifts(duration_minutes)')
      .eq('tenant_id', tenant.id).eq('date', date).in('status', ['confirmed', 'completed'])
      .order('time'),
    supabaseAdmin.from('table_combinations')
      .select('*, table_combination_members(table_id)')
      .eq('tenant_id', tenant.id).eq('is_active', true),
    supabaseAdmin.from('waitlist_entries').select('*')
      .eq('tenant_id', tenant.id).eq('status', 'waiting')
      .order('created_at'),
  ])

  const initialService = {
    date,
    now: time,
    tables: tables || [],
    reservations: reservations || [],
    combos: combos || [],
    waitlist: waitlist || [],
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="font-satoshi font-bold text-[22px] text-offwhite">Floor Plan</h1>
        <p className="text-sm text-offwhite/40 mt-1">
          Live view of your dining room — seat parties, track tables, take walk-ins.
        </p>
      </div>
      <FloorPlanClient
        initialTables={tables || []}
        areas={areas || []}
        slug={slug}
        role={role}
        tenantId={tenant.id}
        initialService={initialService as any}
      />
    </div>
  )
}
