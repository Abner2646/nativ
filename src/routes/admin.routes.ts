// src/routes/admin.routes.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { sendEmployeeInvite, sendCampaignEmail } from '@/lib/email'
import { ReservationStatus } from '@/lib/types'
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
    .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*)', { count: 'exact' })
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
    .eq('tenant_id', ctx.tenant.id).order('visit_count', { ascending: false })
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
