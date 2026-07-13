// src/routes/admin.routes.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { sendEmployeeInvite, sendCampaignEmail } from '@/lib/email'
import { ReservationStatus } from '@/lib/types'
import { resolveDuration } from '@/lib/turn-times'
import { randomUUID } from 'crypto'

// Helper: resolver tenant + verificar sesión del usuario
async function getCtxAndUser(req: NextRequest) {
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) }

  // Auth via Bearer token de Supabase
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Verificar que pertenece al tenant (o es superadmin)
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_superadmin').eq('id', user.id).maybeSingle()
  if (!profile?.is_superadmin) {
    const { data: member } = await supabaseAdmin.from('tenant_members').select('role').eq('user_id', user.id).eq('tenant_id', ctx.tenant.id).maybeSingle()
    if (!member) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    return { ctx, user, role: member.role as 'admin' | 'employee' }
  }

  return { ctx, user, role: 'admin' as const }
}

function requireAdmin(role: string) {
  if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  return null
}

// ── RESERVATIONS ──────────────────────────────────────────────

export async function getReservations(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 50
  let q = supabaseAdmin.from('reservations')
    .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*), table_assignments(table:restaurant_tables(name))', { count: 'exact' })
    .eq('tenant_id', ctx.tenant.id)
    .order('date').order('time')
    .range((page - 1) * limit, page * limit - 1)
  if (date) q = q.eq('date', date)
  if (status) q = q.eq('status', status)
  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  return NextResponse.json({ reservations: data, total: count, page, limit })
}

export async function updateReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { status } = await req.json()
  const valid: ReservationStatus[] = ['confirmed', 'cancelled', 'completed']
  if (!valid.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const { data: res } = await supabaseAdmin.from('reservations').select('*, guest:guests(*)').eq('id', id).eq('tenant_id', ctx.tenant.id).maybeSingle()
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const update: any = { status }
  if (status === 'cancelled') update.cancelled_at = new Date().toISOString()
  if (status === 'completed') update.finished_at = new Date().toISOString()
  if (status === 'confirmed') update.finished_at = null
  const { data, error } = await supabaseAdmin.from('reservations').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (status === 'cancelled') {
    const { sendCancellationEmail } = await import('@/lib/email')
    sendCancellationEmail(res, ctx.settings).catch(console.error)
  }
  return NextResponse.json({ reservation: data })
}

// ── GUESTS ────────────────────────────────────────────────────

export async function getGuests(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 50
  let q = supabaseAdmin.from('guests').select('*, guest_tags(tag)', { count: 'exact' })
    .eq('tenant_id', ctx.tenant.id)
    // Excluir guests placeholder de walk-ins y waitlist
    .not('email', 'like', '%@nativ.local')
    .order('visit_count', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ guests: data, total: count, page, limit })
}

export async function updateGuest(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  const allowed = ['name', 'phone', 'birthday', 'notes']
  const updates: any = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]
  const { data, error } = await supabaseAdmin.from('guests').update(updates).eq('id', id).eq('tenant_id', ctx.tenant.id).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ guest: data })
}

export async function addGuestTag(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { searchParams } = new URL(req.url)
  const guestId = searchParams.get('guest_id')
  const { tag } = await req.json()
  if (!guestId || !tag) return NextResponse.json({ error: 'guest_id and tag required' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('guest_tags')
    .upsert({ tenant_id: ctx.tenant.id, guest_id: guestId, tag }, { onConflict: 'guest_id,tag' }).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ tag: data }, { status: 201 })
}

export async function removeGuestTag(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('guest_tags').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── SHIFTS ────────────────────────────────────────────────────

export async function getShifts(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('shifts')
    .select('*, shift_areas(*, seating_areas(id, name))').eq('tenant_id', ctx.tenant.id)
    .order('day_of_week').order('start_time')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ shifts: data })
}

export async function createShift(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { day_of_week, name, start_time, end_time, interval_minutes, duration_minutes, areas } = await req.json()
  if (day_of_week === undefined || !name || !start_time || !end_time) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { data: shift, error } = await supabaseAdmin.from('shifts')
    .insert({ tenant_id: ctx.tenant.id, day_of_week, name, start_time, end_time, interval_minutes: interval_minutes || 30, duration_minutes: duration_minutes || 90 })
    .select().single()
  if (error || !shift) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (areas?.length) await supabaseAdmin.from('shift_areas').insert(areas.map((a: any) => ({ tenant_id: ctx.tenant.id, shift_id: shift.id, seating_area_id: a.seating_area_id, capacity: a.capacity })))
  return NextResponse.json({ shift }, { status: 201 })
}

export async function updateShift(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { areas, ...shiftData } = await req.json()
  const { data, error } = await supabaseAdmin.from('shifts').update(shiftData).eq('id', id).eq('tenant_id', ctx.tenant.id).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  if (areas) {
    await supabaseAdmin.from('shift_areas').delete().eq('shift_id', id)
    if (areas.length) await supabaseAdmin.from('shift_areas').insert(areas.map((a: any) => ({ tenant_id: ctx.tenant.id, shift_id: id, seating_area_id: a.seating_area_id, capacity: a.capacity })))
  }
  return NextResponse.json({ shift: data })
}

export async function deleteShift(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('shifts').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── AREAS ─────────────────────────────────────────────────────

export async function getAreas(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('seating_areas').select('*').eq('tenant_id', ctx.tenant.id).order('position')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ areas: data })
}

export async function createArea(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { name, position } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('seating_areas').insert({ tenant_id: ctx.tenant.id, name, position: position || 0 }).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ area: data }, { status: 201 })
}

export async function updateArea(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('seating_areas').update(body).eq('id', id).eq('tenant_id', ctx.tenant.id).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ area: data })
}

export async function deleteArea(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('seating_areas').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── RESTAURANT TABLES (floor plan) ────────────────────────────

export async function getTables(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin
    .from('restaurant_tables')
    .select('*')
    .eq('tenant_id', ctx.tenant.id)
    .order('created_at')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ tables: data })
}

export async function createTable(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const { seating_area_id, name, shape, min_covers, max_covers, x, y, width, height, rotation } = await req.json()
  if (!seating_area_id || !name?.trim()) return NextResponse.json({ error: 'seating_area_id and name required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('restaurant_tables')
    .insert({
      tenant_id: ctx.tenant.id, seating_area_id, name: name.trim(),
      shape: shape || 'square',
      min_covers: min_covers ?? 1, max_covers: max_covers ?? 4,
      x: x ?? 40, y: y ?? 40, width: width ?? 10, height: height ?? 10,
      rotation: rotation ?? 0,
    })
    .select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A table with that name already exists in this area' }, { status: 409 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ table: data }, { status: 201 })
}

export async function updateTable(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  const allowed = ['name', 'shape', 'min_covers', 'max_covers', 'x', 'y', 'width', 'height', 'rotation', 'is_active', 'seating_area_id']
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabaseAdmin
    .from('restaurant_tables')
    .update(patch)
    .eq('id', id).eq('tenant_id', ctx.tenant.id)
    .select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A table with that name already exists in this area' }, { status: 409 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ table: data })
}

export async function deleteTable(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Bloquear si hay reservas futuras asignadas a esta mesa
  const today = new Date().toISOString().split('T')[0]
  const { data: future } = await supabaseAdmin
    .from('table_assignments')
    .select('id, reservations!inner(date, status)')
    .eq('table_id', id)
    .eq('reservations.status', 'confirmed')
    .gte('reservations.date', today)
    .limit(1)
  if (future && future.length > 0) {
    return NextResponse.json({ error: 'This table has upcoming reservations assigned. Reassign them first.' }, { status: 409 })
  }
  const { error } = await supabaseAdmin
    .from('restaurant_tables')
    .delete()
    .eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── TABLE COMBINATIONS ────────────────────────────────────────

export async function getCombos(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin
    .from('table_combinations')
    .select('*, table_combination_members(table_id)')
    .eq('tenant_id', ctx.tenant.id)
    .order('created_at')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ combos: data })
}

export async function createCombo(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const { seating_area_id, name, table_ids, min_covers, max_covers } = await req.json()
  if (!seating_area_id || !name?.trim() || !Array.isArray(table_ids) || table_ids.length < 2) {
    return NextResponse.json({ error: 'seating_area_id, name and at least 2 table_ids required' }, { status: 400 })
  }
  // Las mesas deben ser del área indicada
  const { data: tables } = await supabaseAdmin
    .from('restaurant_tables').select('id, seating_area_id')
    .eq('tenant_id', ctx.tenant.id).in('id', table_ids)
  if (!tables || tables.length !== table_ids.length || tables.some(t => t.seating_area_id !== seating_area_id)) {
    return NextResponse.json({ error: 'All tables must belong to the given area' }, { status: 400 })
  }
  const { data: combo, error } = await supabaseAdmin
    .from('table_combinations')
    .insert({ tenant_id: ctx.tenant.id, seating_area_id, name: name.trim(), min_covers: min_covers ?? 1, max_covers })
    .select().single()
  if (error || !combo) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  const { error: mErr } = await supabaseAdmin
    .from('table_combination_members')
    .insert(table_ids.map((tid: string) => ({ tenant_id: ctx.tenant.id, combination_id: combo.id, table_id: tid })))
  if (mErr) {
    await supabaseAdmin.from('table_combinations').delete().eq('id', combo.id)
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
  }
  return NextResponse.json({ combo: { ...combo, table_combination_members: table_ids.map((t: string) => ({ table_id: t })) } }, { status: 201 })
}

export async function deleteCombo(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin
    .from('table_combinations').delete()
    .eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── RESCHEDULE ────────────────────────────────────────────────
// Mover fecha/hora/party de una reserva. Staff-accessible: atender
// el teléfono y correr una reserva es tarea del host.

export async function rescheduleReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { reservation_id, shift_id, date, time, party_size, seating_area_id, occasion, notes } = await req.json()
  if (!reservation_id || !shift_id || !date || !time || !party_size) {
    return NextResponse.json({ error: 'reservation_id, shift_id, date, time and party_size required' }, { status: 400 })
  }

  const { data: shift } = await supabaseAdmin
    .from('shifts').select('id, duration_minutes, shift_areas(seating_area_id, capacity)')
    .eq('id', shift_id).eq('tenant_id', ctx.tenant.id).eq('is_active', true).maybeSingle()
  if (!shift) return NextResponse.json({ error: 'Invalid shift' }, { status: 400 })

  const targetArea = seating_area_id || null
  if (targetArea && !shift.shift_areas?.some((a: any) => a.seating_area_id === targetArea)) {
    return NextResponse.json({ error: 'Invalid seating area for that shift' }, { status: 400 })
  }

  const { data: turnRules } = await supabaseAdmin
    .from('turn_time_rules').select('max_party, duration_minutes').eq('tenant_id', ctx.tenant.id)
  const duration = resolveDuration(turnRules, party_size, shift.duration_minutes)

  // Área con mesas → el RPC re-asigna; área covers → mueve sin assignment
  const { count: tableCount } = await supabaseAdmin
    .from('restaurant_tables').select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenant.id).eq('seating_area_id', targetArea ?? '00000000-0000-0000-0000-000000000000')
    .eq('is_active', true)
  const useTables = !!targetArea && (tableCount ?? 0) > 0

  const { data, error } = await supabaseAdmin.rpc('reschedule_reservation', {
    p_tenant_id: ctx.tenant.id,
    p_reservation_id: reservation_id,
    p_shift_id: shift_id,
    p_area_id: targetArea,
    p_date: date,
    p_time: time,
    p_duration_minutes: duration,
    p_party_size: party_size,
    p_occasion: occasion || null,
    p_notes: notes || null,
    p_use_tables: useTables,
  })
  if (error) {
    if (error.message?.includes('no_table_available')) {
      return NextResponse.json({ error: 'No table available for that slot. Pick another time.' }, { status: 409 })
    }
    if (error.message?.includes('reservation_not_confirmed')) {
      return NextResponse.json({ error: 'Only confirmed reservations can be moved' }, { status: 409 })
    }
    console.error('reschedule_reservation error:', error)
    return NextResponse.json({ error: 'Failed to reschedule' }, { status: 500 })
  }

  // Avisar al guest con los datos nuevos
  const { data: full } = await supabaseAdmin
    .from('reservations')
    .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*), table_assignments(table:restaurant_tables(name))')
    .eq('id', reservation_id).single()
  if (full) {
    const { sendUpdateEmail } = await import('@/lib/email')
    sendUpdateEmail(full, ctx.settings, ctx.tenant.slug).catch(console.error)
  }

  return NextResponse.json({ success: true, reservation: full, ...(data as object) })
}

// ── TURN TIME RULES ───────────────────────────────────────────

export async function getTurnTimes(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin
    .from('turn_time_rules').select('*')
    .eq('tenant_id', ctx.tenant.id).order('max_party')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ rules: data })
}

export async function saveTurnTimes(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const { rules } = await req.json()
  if (!Array.isArray(rules)) return NextResponse.json({ error: 'rules array required' }, { status: 400 })
  const clean = rules
    .filter((x: any) => x.max_party >= 1 && x.duration_minutes >= 15 && x.duration_minutes <= 480)
    .map((x: any) => ({ tenant_id: ctx.tenant.id, max_party: x.max_party, duration_minutes: x.duration_minutes }))
  // Reemplazo total: es una lista chica editada como un todo
  await supabaseAdmin.from('turn_time_rules').delete().eq('tenant_id', ctx.tenant.id)
  if (clean.length > 0) {
    const { error } = await supabaseAdmin.from('turn_time_rules').insert(clean)
    if (error) return NextResponse.json({ error: 'Failed to save rules' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// resolveDuration vive en @/lib/turn-times (pura, testeable)

// ── WAITLIST ──────────────────────────────────────────────────
// Staff-accessible, como todo el servicio.

export async function getWaitlist(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin
    .from('waitlist_entries').select('*')
    .eq('tenant_id', ctx.tenant.id).eq('status', 'waiting')
    .order('created_at')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ waitlist: data })
}

export async function addWaitlistEntry(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { name, phone, party_size, quoted_minutes } = await req.json()
  if (!name?.trim() || !party_size) return NextResponse.json({ error: 'name and party_size required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('waitlist_entries')
    .insert({
      tenant_id: ctx.tenant.id, name: name.trim(), phone: phone || null,
      party_size, quoted_minutes: quoted_minutes || null,
    })
    .select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ entry: data }, { status: 201 })
}

export async function removeWaitlistEntry(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({ status: 'removed' })
    .eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── SERVICE VIEW (floor plan en vivo) ─────────────────────────
// Sin requireAdmin: la operación del servicio es tarea del staff.

// Fecha y hora actuales en el timezone del restaurante
function tenantNow(timezone: string) {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)              // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now) // HH:MM
  return { date, time }
}

export async function getServiceState(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { date, time } = tenantNow(ctx.settings.timezone)

  // Confirmed + completed: el plano usa confirmed; el timeline muestra ambas
  const [{ data: tables }, { data: reservations }, { data: combos }, { data: waitlist }] = await Promise.all([
    supabaseAdmin.from('restaurant_tables').select('*')
      .eq('tenant_id', ctx.tenant.id).eq('is_active', true).order('created_at'),
    supabaseAdmin.from('reservations')
      .select('id, time, party_size, status, occasion, notes, seated_at, finished_at, source, seating_area_id, shift_id, duration_minutes, guest:guests(name, phone), table_assignments(table_id), shift:shifts(duration_minutes)')
      .eq('tenant_id', ctx.tenant.id).eq('date', date).in('status', ['confirmed', 'completed'])
      .order('time'),
    supabaseAdmin.from('table_combinations')
      .select('*, table_combination_members(table_id)')
      .eq('tenant_id', ctx.tenant.id).eq('is_active', true),
    supabaseAdmin.from('waitlist_entries').select('*')
      .eq('tenant_id', ctx.tenant.id).eq('status', 'waiting')
      .order('created_at'),
  ])

  return NextResponse.json({
    date,
    now: time, // hora actual en el timezone del restaurante — el cliente no debe usar la del dispositivo
    tables: tables || [],
    reservations: reservations || [],
    combos: combos || [],
    waitlist: waitlist || [],
  })
}

export async function unseatReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({ seated_at: null })
    .eq('id', reservation_id).eq('tenant_id', ctx.tenant.id).eq('status', 'confirmed')
    .select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Failed to unseat' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function unfinishReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })
  const { data: res, error } = await supabaseAdmin
    .from('reservations')
    .update({ status: 'confirmed', finished_at: null })
    .eq('id', reservation_id).eq('tenant_id', ctx.tenant.id).eq('status', 'completed')
    .select('id, guest_id').maybeSingle()
  if (error || !res) return NextResponse.json({ error: 'Failed to undo' }, { status: 500 })
  // Revertir la visita que sumó el trigger al completar
  const { data: guest } = await supabaseAdmin.from('guests').select('visit_count').eq('id', res.guest_id).single()
  if (guest && guest.visit_count > 0) {
    await supabaseAdmin.from('guests').update({ visit_count: guest.visit_count - 1 }).eq('id', res.guest_id)
  }
  return NextResponse.json({ success: true })
}

export async function seatReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({ seated_at: new Date().toISOString() })
    .eq('id', reservation_id).eq('tenant_id', ctx.tenant.id).eq('status', 'confirmed')
    .select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Failed to seat' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function finishReservation(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { reservation_id } = await req.json()
  if (!reservation_id) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })
  // status completed dispara el trigger de visit_count del guest
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update({ finished_at: new Date().toISOString(), status: 'completed' })
    .eq('id', reservation_id).eq('tenant_id', ctx.tenant.id).eq('status', 'confirmed')
    .select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Failed to finish' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function createWalkIn(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { table_id, party_size, guest_name, waitlist_entry_id } = await req.json()
  if (!table_id || !party_size) return NextResponse.json({ error: 'table_id and party_size required' }, { status: 400 })

  const { date, time } = tenantNow(ctx.settings.timezone)
  const dayOfWeek = new Date(date).getUTCDay()

  // Shift que cubre la hora actual; si no hay, el próximo de hoy; si no, el último
  const { data: shifts } = await supabaseAdmin
    .from('shifts').select('id, start_time, end_time, duration_minutes')
    .eq('tenant_id', ctx.tenant.id).eq('day_of_week', dayOfWeek).eq('is_active', true)
    .order('start_time')
  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ error: 'No shifts configured for today' }, { status: 400 })
  }
  const hhmm = (t: string) => t.slice(0, 5)
  const shift =
    shifts.find(s => hhmm(s.start_time) <= time && time < hhmm(s.end_time)) ||
    shifts.find(s => hhmm(s.start_time) > time) ||
    shifts[shifts.length - 1]

  const { data: turnRules } = await supabaseAdmin
    .from('turn_time_rules').select('max_party, duration_minutes').eq('tenant_id', ctx.tenant.id)
  const duration = resolveDuration(turnRules, party_size, shift.duration_minutes)

  // Guest: con nombre (waitlist) usa un placeholder por nombre; sin nombre, el genérico.
  // Ambos con dominio @nativ.local, excluido de la página Guests.
  const name = guest_name?.trim() || 'Walk-in'
  const email = guest_name?.trim()
    ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.waitlist@nativ.local`
    : 'walk-in@nativ.local'
  const { data: guest } = await supabaseAdmin
    .from('guests')
    .upsert({ tenant_id: ctx.tenant.id, email, name }, { onConflict: 'tenant_id,email' })
    .select('id').single()
  if (!guest) return NextResponse.json({ error: 'Failed to create walk-in guest' }, { status: 500 })

  const { data, error } = await supabaseAdmin.rpc('seat_walk_in', {
    p_tenant_id: ctx.tenant.id,
    p_table_id: table_id,
    p_guest_id: guest.id,
    p_shift_id: shift.id,
    p_date: date,
    p_time: time,
    p_duration_minutes: duration,
    p_party_size: party_size,
  })
  if (error) {
    if (error.message?.includes('table_occupied'))  return NextResponse.json({ error: 'That table is already occupied' }, { status: 409 })
    if (error.message?.includes('party_too_large')) return NextResponse.json({ error: 'Party is too large for that table' }, { status: 409 })
    console.error('seat_walk_in error:', error)
    return NextResponse.json({ error: 'Failed to seat walk-in' }, { status: 500 })
  }

  if (waitlist_entry_id) {
    await supabaseAdmin.from('waitlist_entries')
      .update({ status: 'seated', seated_at: new Date().toISOString() })
      .eq('id', waitlist_entry_id).eq('tenant_id', ctx.tenant.id)
  }

  return NextResponse.json({ success: true, ...( data as object) }, { status: 201 })
}

export async function assignTable(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const body = await req.json()
  const { reservation_id } = body
  // Acepta table_id (una) o table_ids (combo)
  const tableIds: string[] = Array.isArray(body.table_ids) ? body.table_ids : body.table_id ? [body.table_id] : []
  if (!reservation_id || tableIds.length === 0) return NextResponse.json({ error: 'reservation_id and table_id(s) required' }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('assign_reservation_tables', {
    p_tenant_id: ctx.tenant.id,
    p_reservation_id: reservation_id,
    p_table_ids: tableIds,
  })
  if (error) {
    if (error.message?.includes('table_occupied'))  return NextResponse.json({ error: 'That table is occupied during this reservation' }, { status: 409 })
    if (error.message?.includes('party_too_large')) return NextResponse.json({ error: 'Party is too large for that table' }, { status: 409 })
    console.error('assign_reservation_table error:', error)
    return NextResponse.json({ error: 'Failed to assign table' }, { status: 500 })
  }
  return NextResponse.json({ success: true, ...(data as object) })
}

export async function unassignTable(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const reservationId = new URL(req.url).searchParams.get('reservation_id')
  if (!reservationId) return NextResponse.json({ error: 'reservation_id required' }, { status: 400 })
  const { error } = await supabaseAdmin
    .from('table_assignments')
    .delete()
    .eq('reservation_id', reservationId).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── BLOCKED DATES ─────────────────────────────────────────────

export async function getBlockedDates(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('blocked_dates').select('*').eq('tenant_id', ctx.tenant.id).order('date')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ blocked_dates: data })
}

export async function createBlockedDate(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { date, reason } = await req.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('blocked_dates').insert({ tenant_id: ctx.tenant.id, date, reason: reason || null }).select().single()
  if (error) { if (error.code === '23505') return NextResponse.json({ error: 'Already blocked' }, { status: 409 }); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
  return NextResponse.json({ blocked_date: data }, { status: 201 })
}

export async function deleteBlockedDate(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('blocked_dates').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── SPECIAL EVENTS ────────────────────────────────────────────

export async function getSpecialEvents(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('special_events').select('*').eq('tenant_id', ctx.tenant.id).order('date')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ events: data })
}

export async function createSpecialEvent(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { name, date, deposit_amount, refund_cutoff_hours } = await req.json()
  if (!name || !date || !deposit_amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('special_events').insert({ tenant_id: ctx.tenant.id, name, date, deposit_amount, refund_cutoff_hours: refund_cutoff_hours || 24 }).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}

export async function deleteSpecialEvent(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('special_events').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── SETTINGS ──────────────────────────────────────────────────

export async function getSettings(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  return NextResponse.json({ settings: ctx.settings })
}

export async function updateSettings(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const body = await req.json()
  const allowed = ['name','description','address','phone','timezone','hours_text','website_url','instagram_url','facebook_url','tripadvisor_url','yelp_url','primary_color','secondary_color','background_color','font_family','button_style','notification_email','min_party_size','max_party_size','min_advance_hours']
  const updates: any = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]
  const { data, error } = await supabaseAdmin.from('tenant_settings').update(updates).eq('tenant_id', ctx.tenant.id).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ settings: data })
}

// ── STATS ─────────────────────────────────────────────────────

export async function getStats(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  const ws = weekStart.toISOString().split('T')[0]
  const lms = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lme = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const tid = ctx.tenant.id
  const [a, b, c] = await Promise.all([
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tid).eq('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tid).gte('date', ws).lte('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tid).gte('date', lms).lte('date', lme).neq('status', 'cancelled'),
  ])
  const sum = (d: any[] | null) => (d || []).reduce((s, r) => s + r.party_size, 0)
  return NextResponse.json({ today: a.data?.length ?? 0, today_covers: sum(a.data), week: b.data?.length ?? 0, week_covers: sum(b.data), last_month: c.data?.length ?? 0, last_month_covers: sum(c.data) })
}

// ── EMPLOYEES ─────────────────────────────────────────────────

export async function getEmployees(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const { data, error } = await supabaseAdmin.from('tenant_members')
    .select('*, profiles(id, email, full_name)')
    .eq('tenant_id', ctx.tenant.id).order('created_at')
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ employees: data })
}

export async function inviteEmployee(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, user, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // Verify the email belongs to a registered Nativ user
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'No Nativ account found for this email. They need to register first.' }, { status: 422 })

  const token = randomUUID()
  const { error } = await supabaseAdmin.from('employee_invites')
    .upsert({ tenant_id: ctx.tenant.id, email, token, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_by: user.id }, { onConflict: 'tenant_id,email' })
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  try {
    await sendEmployeeInvite(email, token, ctx.settings.name)
  } catch (emailErr) {
    console.error('[inviteEmployee] email send failed:', emailErr)
    return NextResponse.json({ success: true, emailSent: false }, { status: 201 })
  }
  return NextResponse.json({ success: true, emailSent: true }, { status: 201 })
}

export async function removeEmployee(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, user, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (id === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  const { error } = await supabaseAdmin.from('tenant_members').delete().eq('user_id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── CAMPAIGNS ─────────────────────────────────────────────────

export async function getCampaigns(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('ai_campaigns').select('*').eq('tenant_id', ctx.tenant.id).order('suggested_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

export async function updateCampaign(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx, role } = r as any
  const adminErr = requireAdmin(role); if (adminErr) return adminErr
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { action, subject, body, sms_body, channel } = await req.json()

  if (action === 'approve') {
    await supabaseAdmin.from('ai_campaigns').update({ status: 'approved', subject, body, sms_body, channel, approved_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', ctx.tenant.id)
    const { data: guests } = await supabaseAdmin.from('guests').select('email').eq('tenant_id', ctx.tenant.id).gt('visit_count', 0)
    if (guests?.length) {
      await Promise.allSettled(guests.map(g => sendCampaignEmail(g.email, ctx.settings, subject || '', body)))
    }
    await supabaseAdmin.from('ai_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'reject') {
    await supabaseAdmin.from('ai_campaigns').update({ status: 'rejected' }).eq('id', id).eq('tenant_id', ctx.tenant.id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// ── BIRTHDAY CONFIG ───────────────────────────────────────────

export async function getBirthdayConfig(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data } = await supabaseAdmin.from('birthday_campaign_config').select('*').eq('tenant_id', ctx.tenant.id).maybeSingle()
  return NextResponse.json({ config: data })
}

export async function updateBirthdayConfig(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('birthday_campaign_config')
    .upsert({ tenant_id: ctx.tenant.id, ...body }, { onConflict: 'tenant_id' }).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ config: data })
}

// ── DEPOSIT RULES ─────────────────────────────────────────────

export async function getDepositRules(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin
    .from('deposit_rules').select('*').eq('tenant_id', ctx.tenant.id).order('rule_type')
  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  return NextResponse.json({ rules: data })
}

export async function createDepositRule(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const notAdmin = requireAdmin((r as any).role); if (notAdmin) return notAdmin
  const { ctx } = r as any
  const { rule_type, day_of_week, specific_date, amount_cents, refund_cutoff_hours } = await req.json()

  if (!['all_days', 'day_of_week', 'specific_date'].includes(rule_type)) {
    return NextResponse.json({ error: 'Invalid rule_type' }, { status: 400 })
  }
  if (!amount_cents || amount_cents < 50) {
    return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })
  }
  if (rule_type === 'day_of_week' && day_of_week == null) {
    return NextResponse.json({ error: 'day_of_week required' }, { status: 400 })
  }
  if (rule_type === 'specific_date' && !specific_date) {
    return NextResponse.json({ error: 'specific_date required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('deposit_rules')
    .insert({
      tenant_id: ctx.tenant.id,
      rule_type,
      day_of_week: rule_type === 'day_of_week' ? day_of_week : null,
      specific_date: rule_type === 'specific_date' ? specific_date : null,
      amount_cents,
      refund_cutoff_hours: refund_cutoff_hours ?? 24,
    })
    .select().single()
  if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}

export async function deleteDepositRule(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const notAdmin = requireAdmin((r as any).role); if (notAdmin) return notAdmin
  const { ctx } = r as any
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin
    .from('deposit_rules').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── STRIPE CONNECT ─────────────────────────────────────────────

export async function getStripeConnectStatus(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const accountId = ctx.settings.stripe_account_id
  if (!accountId) return NextResponse.json({ connected: false, stripe_account_id: null })
  try {
    const { stripe } = await import('@/lib/stripe')
    const account = await stripe.accounts.retrieve(accountId)
    return NextResponse.json({ connected: account.charges_enabled, details_submitted: account.details_submitted, stripe_account_id: accountId })
  } catch {
    return NextResponse.json({ connected: false, stripe_account_id: accountId })
  }
}

export async function createStripeConnectLink(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const notAdmin = requireAdmin((r as any).role); if (notAdmin) return notAdmin
  const { ctx } = r as any

  try {
    const { stripe } = await import('@/lib/stripe')
    let accountId = ctx.settings.stripe_account_id
    if (!accountId) {
      const account = await stripe.accounts.create({ type: 'express', metadata: { tenant_id: ctx.tenant.id } })
      accountId = account.id
      await supabaseAdmin.from('tenant_settings').update({ stripe_account_id: accountId }).eq('tenant_id', ctx.tenant.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 })

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/restaurant/${ctx.tenant.slug}/deposits?stripe=refresh`,
      return_url:  `${appUrl}/restaurant/${ctx.tenant.slug}/deposits?stripe=success`,
      type: 'account_onboarding',
    })
    return NextResponse.json({ url: link.url })
  } catch (err: any) {
    console.error('[stripe-connect]', err)
    return NextResponse.json({ error: err?.message || 'Stripe error' }, { status: 500 })
  }
}

// ── REFERRALS ─────────────────────────────────────────────────

export async function getReferrals(req: NextRequest) {
  const r = await getCtxAndUser(req); if (r.error) return r.error
  const { ctx } = r as any
  const { data, error } = await supabaseAdmin.from('referrals')
    .select('*, referrer:tenants!referrer_tenant_id(slug), referred:tenants!referred_tenant_id(slug)')
    .or(`referrer_tenant_id.eq.${ctx.tenant.id},referred_tenant_id.eq.${ctx.tenant.id}`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ referrals: data })
}
