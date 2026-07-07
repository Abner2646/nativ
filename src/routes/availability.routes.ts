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

  const [{ data: existing }, { data: activeTables }, { data: dayAssignments }, { data: combos }] = await Promise.all([
    supabaseAdmin
      .from('reservations').select('shift_id, time, party_size, seating_area_id')
      .eq('tenant_id', tenant.id).eq('date', date).eq('status', 'confirmed'),
    supabaseAdmin
      .from('restaurant_tables').select('id, seating_area_id, min_covers, max_covers')
      .eq('tenant_id', tenant.id).eq('is_active', true),
    supabaseAdmin
      .from('table_assignments')
      .select('table_id, reservations!inner(time, status, date, shift_id, duration_minutes)')
      .eq('tenant_id', tenant.id)
      .eq('reservations.date', date)
      .eq('reservations.status', 'confirmed'),
    supabaseAdmin
      .from('table_combinations')
      .select('id, seating_area_id, min_covers, max_covers, table_combination_members(table_id)')
      .eq('tenant_id', tenant.id).eq('is_active', true),
  ])

  const { data: turnRules } = await supabaseAdmin
    .from('turn_time_rules').select('max_party, duration_minutes').eq('tenant_id', tenant.id)
  const sortedRules = (turnRules || []).sort((a, b) => a.max_party - b.max_party)
  const durationFor = (party: number, shiftDur: number) =>
    sortedRules.find(r => r.max_party >= party)?.duration_minutes ?? shiftDur

  // Áreas con mesas dibujadas usan disponibilidad por mesa;
  // áreas sin mesas siguen con covers (modo híbrido de migración).
  const tablesByArea = new Map<string, { id: string; min_covers: number; max_covers: number }[]>()
  for (const t of (activeTables || [])) {
    const list = tablesByArea.get(t.seating_area_id) || []
    list.push(t)
    tablesByArea.set(t.seating_area_id, list)
  }

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const shiftDuration = new Map((shifts || []).map(s => [s.id, s.duration_minutes]))

  // Ventanas ocupadas por mesa (en minutos del día), respetando la
  // duración propia de cada reserva si la tiene
  const busyByTable = new Map<string, { start: number; end: number }[]>()
  for (const a of (dayAssignments || []) as any[]) {
    const r = a.reservations
    const start = toMinutes(r.time)
    const dur = r.duration_minutes ?? shiftDuration.get(r.shift_id) ?? 90
    const list = busyByTable.get(a.table_id) || []
    list.push({ start, end: start + dur })
    busyByTable.set(a.table_id, list)
  }

  const combosByArea = new Map<string, { min_covers: number; max_covers: number; memberIds: string[] }[]>()
  for (const c of (combos || []) as any[]) {
    const list = combosByArea.get(c.seating_area_id) || []
    list.push({ min_covers: c.min_covers, max_covers: c.max_covers, memberIds: (c.table_combination_members || []).map((m: any) => m.table_id) })
    combosByArea.set(c.seating_area_id, list)
  }

  const tableIsFree = (tableId: string, slotStart: number, slotEnd: number) => {
    const busy = busyByTable.get(tableId) || []
    return !busy.some(b => b.start < slotEnd && b.end > slotStart)
  }

  const hasFreeTable = (areaId: string, slotStart: number, slotEnd: number) => {
    const tables = tablesByArea.get(areaId) || []
    const single = tables.some(t =>
      t.min_covers <= partySize && t.max_covers >= partySize && tableIsFree(t.id, slotStart, slotEnd)
    )
    if (single) return true
    // Sin mesa individual: probar combos con todos sus miembros libres
    const areaCombos = combosByArea.get(areaId) || []
    return areaCombos.some(c =>
      c.min_covers <= partySize && c.max_covers >= partySize &&
      c.memberIds.length >= 2 &&
      c.memberIds.every(id => tableIsFree(id, slotStart, slotEnd))
    )
  }

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
        const areaTables = tablesByArea.get(sa.seating_area_id)

        if (areaTables && areaTables.length > 0) {
          // ── Modo mesas: mesa individual libre o combo completo libre.
          // La ventana usa la duración del party solicitado (turn times).
          const requestedDur = durationFor(partySize, shift.duration_minutes)
          if (hasFreeTable(sa.seating_area_id, cur, cur + requestedDur)) {
            const slotEnd = cur + requestedDur
            const singles = areaTables.filter(t =>
              t.min_covers <= partySize && t.max_covers >= partySize && tableIsFree(t.id, cur, slotEnd)
            ).length
            const comboCount = (combosByArea.get(sa.seating_area_id) || []).filter(c =>
              c.min_covers <= partySize && c.max_covers >= partySize &&
              c.memberIds.length >= 2 && c.memberIds.every(id => tableIsFree(id, cur, slotEnd))
            ).length
            areas.push({ area_id: sa.seating_area_id, area_name: sa.seating_areas?.name || '', available_capacity: singles + comboCount })
          }
        } else {
          // ── Modo covers (sin mesas dibujadas): lógica original intacta
          const used = (existing || [])
            .filter(r => r.shift_id === shift.id && r.time.startsWith(timeStr) && r.seating_area_id === sa.seating_area_id)
            .reduce((s, r) => s + r.party_size, 0)
          const avail = sa.capacity - used
          if (avail >= partySize) {
            areas.push({ area_id: sa.seating_area_id, area_name: sa.seating_areas?.name || '', available_capacity: Math.max(0, avail) })
          }
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
