import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { buildTheme } from '@/lib/theme'
import { ReserveClient } from './ReserveClient'

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>
}) {
  const [headersList, sp] = await Promise.all([headers(), searchParams])

  const slug =
    headersList.get('x-tenant-slug') ||
    sp.tenant ||
    null

  if (!slug) {
    return <ReserveClient slug="" theme={buildTheme({})} />
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return <ReserveClient slug={slug} theme={buildTheme({})} />
  }

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('background_color, primary_color, secondary_color, font_family, button_style')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const theme = buildTheme(settings ?? {})

  return <ReserveClient slug={slug} theme={theme} />
}
