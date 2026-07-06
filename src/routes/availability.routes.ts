// src/routes/availability.routes.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { availabilityLimiter, checkRateLimit } from '@/lib/ratelimit'

export async function getAvailability(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { limited, headers } = await checkRateLimit(availabilityLimiter, ip)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers })

  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { tenant, settings } = ctx
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const partySizeParam = searchParams.get('party_size')

  if (!date || !partySizeParam) {
    return NextResponse.json({ error: 'date and party_size are required' }, { status: 400 })
  }

  const partySize = parseInt(partySizeParam)
  if (isNaN(partySize) || partySize < 1) {
    return NextResponse.json({ error: 'party_size must be a positive number' }, { status: 400 })
  }

  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  if (partySize < settings.min_party_size || partySize > settings.max_party_size) {
    return NextResponse.json({
      available: false, reason: 'party_size_out_of_range',
      min: settings.min_party_size, max: settings.max_party_size, slots: []
    }, { status: 400 })
  }

  const { data: blocked } = await supabaseAdmin
    .from('blocked_dates').select('id')
    .eq('tenant_id', tenant.id).eq('date', date).maybeSingle()

  if (blocked) return NextResponse.json({ available: false, reason: 'closed', slots: [] })

  const dayOfWeek = dateObj.getUTCDay()
  const { data: shifts } = await supabaseAdmin
    .from('shifts')
    .select('*, shift_areas(*, seating_areas(id, name, position))')
    .eq('tenant_id', tenant.id).eq('day_of_week', dayOfWeek).eq('is_active', true)

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ available: false, reason: 'closed', slots: [] })
  }

  const { data: existing } = await supabaseAdmin
    .from('reservations').select('shift_id, time, party_size, seating_area_id')
    .eq('tenant_id', tenant.id).eq('date', date).eq('status', 'confirmed')

  const now = new Date()
  const minAdvanceMs = settings.min_advance_hours * 60 * 60 * 1000
  const slots = []

  for (const shift of shifts) {
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    let cur = sh * 60 + sm
    const end = eh * 60 + em

    while (cur < end) {
      const h = String(Math.floor(cur / 60)).padStart(2, '0')
      const m = String(cur % 60).padStart(2, '0')
      const timeStr = `${h}:${m}`

      if (new Date(`${date}T${timeStr}:00`).getTime() - now.getTime() < minAdvanceMs) {
        cur += shift.interval_minutes; continue
      }

      const areas = []
      for (const sa of (shift.shift_areas || [])) {
        const used = (existing || [])
          .filter(r => r.shift_id === shift.id && r.time.startsWith(timeStr) && r.seating_area_id === sa.seating_area_id)
          .reduce((s, r) => s + r.party_size, 0)
        const avail = sa.capacity - used
        if (avail >= partySize) {
          areas.push({ area_id: sa.seating_area_id, area_name: sa.seating_areas?.name || '', available_capacity: Math.max(0, avail) })
        }
      }

      if (areas.length > 0) slots.push({ shift_id: shift.id, shift_name: shift.name, time: timeStr, areas })
      cur += shift.interval_minutes
    }
  }

  const { data: specialEvent } = await supabaseAdmin
    .from('special_events').select('*')
    .eq('tenant_id', tenant.id).eq('date', date).maybeSingle()

  const { data: depositRules } = await supabaseAdmin
    .from('deposit_rules').select('*').eq('tenant_id', tenant.id)

  let depositRule = null
  if (depositRules && depositRules.length > 0) {
    const specific = depositRules.find((r: any) => r.rule_type === 'specific_date' && r.specific_date === date)
    const dayRule  = depositRules.find((r: any) => r.rule_type === 'day_of_week' && r.day_of_week === dayOfWeek)
    const allDays  = depositRules.find((r: any) => r.rule_type === 'all_days')
    const match = specific || dayRule || allDays || null
    if (match) depositRule = { id: match.id, amount_cents: match.amount_cents, refund_cutoff_hours: match.refund_cutoff_hours }
  }

  return NextResponse.json({ available: slots.length > 0, date, party_size: partySize, slots, special_event: specialEvent || null, deposit_rule: depositRule })
}
