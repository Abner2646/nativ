import { NextRequest, NextResponse } from 'next/server'
import { getUser, getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function verifySuperadmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_superadmin) return null
  return user
}

const TABLES = [
  'profiles',
  'tenants',
  'tenant_members',
  'tenant_settings',
  'tenant_photos',
  'employee_invites',
  'seating_areas',
  'shifts',
  'shift_areas',
  'blocked_dates',
  'special_events',
  'restaurant_tables',
  'table_combinations',
  'table_combination_members',
  'table_assignments',
  'turn_time_rules',
  'guests',
  'guest_tags',
  'reservations',
  'waitlist_entries',
  'birthday_campaign_config',
  'ai_campaigns',
  'referrals',
] as const

export async function GET(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(100000)
      return { table, data: error ? [] : (data ?? []), error: error?.message }
    })
  )

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    exported_by: admin.email,
  }
  for (const { table, data } of results) {
    payload[table] = data
  }

  const filename = `nativ-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
