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

  const [{ data: areas }, { data: tables }] = await Promise.all([
    supabaseAdmin.from('seating_areas').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('position'),
    supabaseAdmin.from('restaurant_tables').select('*').eq('tenant_id', tenant.id).order('created_at'),
  ])

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
      />
    </div>
  )
}
