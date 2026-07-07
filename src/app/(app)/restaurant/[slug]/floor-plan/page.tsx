import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { FloorPlanClient } from '@/components/admin/FloorPlanClient'

export default async function FloorPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  // Fase 1: solo editor, admin-only. En fase 3 la vista de servicio se abre a empleados.
  const access = await requireAdminForSlug(slug, user.id)
  const { tenant } = access

  const [{ data: areas }, { data: tables }] = await Promise.all([
    supabaseAdmin.from('seating_areas').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('position'),
    supabaseAdmin.from('restaurant_tables').select('*').eq('tenant_id', tenant.id).order('created_at'),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="font-satoshi font-bold text-[22px] text-offwhite">Floor Plan</h1>
        <p className="text-sm text-offwhite/40 mt-1">
          Draw your dining room. Drag tables to position them — changes save automatically.
        </p>
      </div>
      <FloorPlanClient initialTables={tables || []} areas={areas || []} slug={slug} />
    </div>
  )
}
