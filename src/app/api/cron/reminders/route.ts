import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderEmail } from '@/lib/email'
import { TenantSettings } from '@/lib/types'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = tomorrow.toISOString().split('T')[0]

  const { data: reservations, error } = await supabaseAdmin
    .from('reservations')
    .select('*, guest:guests(*)')
    .eq('date', date)
    .eq('status', 'confirmed')

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  if (!reservations?.length) return NextResponse.json({ sent: 0, date })

  const tenantIds = [...new Set(reservations.map(r => r.tenant_id))]
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, tenant_settings(*)')
    .in('id', tenantIds)

  const tenantMap = new Map<string, { slug: string; settings: TenantSettings }>()
  for (const t of tenants || []) {
    const settings = (t.tenant_settings as unknown as TenantSettings[])?.[0]
    if (settings) tenantMap.set(t.id, { slug: t.slug, settings })
  }

  let sent = 0
  await Promise.allSettled(
    reservations.map(async (r) => {
      const ctx = tenantMap.get(r.tenant_id)
      if (!ctx || !r.guest?.email) return
      await sendReminderEmail(r, ctx.settings, ctx.slug)
      sent++
    })
  )

  return NextResponse.json({ sent, date })
}
