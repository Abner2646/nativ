import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { AreasClient } from '@/components/admin/AreasClient'

export default async function AreasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)

  const { tenant } = access

  const { data: areas } = await supabaseAdmin
    .from('seating_areas')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('position')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="font-satoshi font-bold text-[22px] text-offwhite">Seating Areas</h1>
        <p className="text-sm text-offwhite/40 mt-1">
          Define the zones guests can choose from (Terrace, Main room, Bar…). Assign capacities per area in Shifts.
        </p>
      </div>
      <AreasClient initialAreas={areas || []} slug={slug} />
    </div>
  )
}
