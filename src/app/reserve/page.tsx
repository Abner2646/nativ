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

  const threeMonthsOut = new Date()
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3)

  const [{ data: settings }, { data: shiftsData }, { data: blockedDatesData }] = await Promise.all([
    supabaseAdmin
      .from('tenant_settings')
      .select('background_color, primary_color, secondary_color, font_family, button_style, min_party_size, max_party_size')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    supabaseAdmin.from('shifts').select('day_of_week').eq('tenant_id', tenant.id).eq('is_active', true),
    supabaseAdmin.from('blocked_dates').select('date')
      .eq('tenant_id', tenant.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .lte('date', threeMonthsOut.toISOString().split('T')[0]),
  ])

  const availableDaysOfWeek = [...new Set((shiftsData || []).map((s: { day_of_week: number }) => s.day_of_week))]
  const blockedDates = (blockedDatesData || []).map((b: { date: string }) => b.date)

  const theme = buildTheme(settings ?? {})

  return (
    <ReserveClient
      slug={slug}
      theme={theme}
      minPartySize={settings?.min_party_size ?? 1}
      maxPartySize={settings?.max_party_size ?? 10}
      availableDaysOfWeek={availableDaysOfWeek}
      blockedDates={blockedDates}
    />
  )
}
