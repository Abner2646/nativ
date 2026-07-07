// src/routes/reservations.routes.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { sendConfirmationEmail, sendOwnerNotification, sendCancellationEmail } from '@/lib/email'
import { sendConfirmationSMS } from '@/lib/sms'
import { reservationLimiter, checkRateLimit } from '@/lib/ratelimit'
import { resolveDuration } from '@/routes/admin.routes'

export async function createReservation(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { limited, headers } = await checkRateLimit(reservationLimiter, ip)
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers })

  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { tenant, settings } = ctx
  const body = await req.json()
  const { shift_id, date, time, party_size, seating_area_id, occasion, notes,
    guest_name, guest_email, guest_phone, guest_birthday } = body

  if (!shift_id || !date || !time || !party_size || !guest_name || !guest_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { stripe_payment_intent_id } = body

  const { data: shift } = await supabaseAdmin
    .from('shifts').select('*, shift_areas(*)')
    .eq('id', shift_id).eq('tenant_id', tenant.id).eq('is_active', true).maybeSingle()

  if (!shift) return NextResponse.json({ error: 'Invalid shift' }, { status: 400 })

  // Áreas con mesas dibujadas se validan y asignan atómicamente en el RPC;
  // áreas sin mesas siguen el chequeo por covers de siempre.
  const { data: tenantTables } = await supabaseAdmin
    .from('restaurant_tables').select('seating_area_id, min_covers, max_covers')
    .eq('tenant_id', tenant.id).eq('is_active', true)
  const tableAreaIds = new Set((tenantTables || []).map(t => t.seating_area_id))

  const { data: existing } = await supabaseAdmin
    .from('reservations').select('party_size, seating_area_id')
    .eq('shift_id', shift_id).eq('tenant_id', tenant.id)
    .eq('date', date).eq('time', time).eq('status', 'confirmed')

  let targetAreaId: string | null = seating_area_id || null

  if (targetAreaId) {
    const sa = shift.shift_areas?.find((a: any) => a.seating_area_id === targetAreaId)
    if (!sa) return NextResponse.json({ error: 'Invalid seating area' }, { status: 400 })
    if (!tableAreaIds.has(targetAreaId)) {
      const used = (existing || []).filter(r => r.seating_area_id === targetAreaId).reduce((s, r) => s + r.party_size, 0)
      if (sa.capacity - used < party_size) return NextResponse.json({ error: 'Area no longer available' }, { status: 409 })
    }
    // Área con mesas: el RPC verifica y asigna con lock — sin pre-check acá.
  } else {
    // Sin área elegida: buscar la primera con lugar. Covers primero (chequeo
    // exacto barato); si no, un área con mesas donde estáticamente calce el
    // party (el RPC confirma atómicamente).
    const coversArea = shift.shift_areas?.find((sa: any) => {
      if (tableAreaIds.has(sa.seating_area_id)) return false
      const used = (existing || []).filter(r => r.seating_area_id === sa.seating_area_id).reduce((s, r) => s + r.party_size, 0)
      return sa.capacity - used >= party_size
    })
    if (coversArea) {
      targetAreaId = null // covers path inserta sin área, como siempre
    } else {
      const tableArea = shift.shift_areas?.find((sa: any) =>
        tableAreaIds.has(sa.seating_area_id) &&
        (tenantTables || []).some(t => t.seating_area_id === sa.seating_area_id && t.min_covers <= party_size && t.max_covers >= party_size)
      )
      if (tableArea) {
        targetAreaId = tableArea.seating_area_id
      } else {
        return NextResponse.json({ error: 'No availability for this slot' }, { status: 409 })
      }
    }
  }

  const useTableBooking = !!targetAreaId && tableAreaIds.has(targetAreaId)

  // Duración según turn time rules del tenant (fallback: duración del shift)
  const { data: turnRules } = await supabaseAdmin
    .from('turn_time_rules').select('max_party, duration_minutes').eq('tenant_id', tenant.id)
  const resolvedDuration = resolveDuration(turnRules, party_size, shift.duration_minutes)

  // Check deposit rules
  const { data: depositRules } = await supabaseAdmin
    .from('deposit_rules').select('*').eq('tenant_id', tenant.id)

  let applicableRule: any = null
  if (depositRules && depositRules.length > 0) {
    const dayOfWeek = new Date(date + 'T12:00:00').getUTCDay()
    const specific = depositRules.find((r: any) => r.rule_type === 'specific_date' && r.specific_date === date)
    const dayRule  = depositRules.find((r: any) => r.rule_type === 'day_of_week' && r.day_of_week === dayOfWeek)
    const allDays  = depositRules.find((r: any) => r.rule_type === 'all_days')
    applicableRule = specific || dayRule || allDays || null
  }

  if (applicableRule) {
    if (!stripe_payment_intent_id) {
      return NextResponse.json({ error: 'Payment required for this date', requires_payment: true, amount_cents: applicableRule.amount_cents }, { status: 402 })
    }
    if (!settings.stripe_account_id) {
      return NextResponse.json({ error: 'Restaurant payment not configured' }, { status: 500 })
    }
    const { stripe } = await import('@/lib/stripe')
    const pi = await stripe.paymentIntents.retrieve(stripe_payment_intent_id, { stripeAccount: settings.stripe_account_id })
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }
    const { data: existingWithPi } = await supabaseAdmin
      .from('reservations').select('id').eq('stripe_payment_intent', stripe_payment_intent_id).maybeSingle()
    if (existingWithPi) {
      return NextResponse.json({ error: 'Payment already used for another reservation' }, { status: 400 })
    }
  }

  // Upsert guest
  const { data: guest } = await supabaseAdmin
    .from('guests')
    .upsert({ tenant_id: tenant.id, email: guest_email, name: guest_name, phone: guest_phone || null, birthday: guest_birthday || null },
      { onConflict: 'tenant_id,email' })
    .select().single()

  if (!guest) return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 })

  const source = body.source === 'manual' ? 'manual' : 'online'
  let reservation: any = null

  if (useTableBooking) {
    // Asignación atómica de mesa (best-fit + advisory lock por área+fecha)
    const { data: booked, error: rpcError } = await supabaseAdmin.rpc('book_reservation_with_table', {
      p_tenant_id: tenant.id,
      p_shift_id: shift_id,
      p_guest_id: guest.id,
      p_area_id: targetAreaId,
      p_date: date,
      p_time: time,
      p_duration_minutes: resolvedDuration,
      p_party_size: party_size,
      p_occasion: occasion || null,
      p_notes: notes || null,
      p_source: source,
      p_deposit_amount: applicableRule ? applicableRule.amount_cents / 100 : null,
      p_stripe_payment_intent: applicableRule ? stripe_payment_intent_id : null,
    })
    if (rpcError) {
      if (rpcError.message?.includes('no_table_available')) {
        return NextResponse.json({ error: 'This slot was just taken. Please pick another time.' }, { status: 409 })
      }
      console.error('book_reservation_with_table error:', rpcError)
      return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
    }
    const { data: full } = await supabaseAdmin
      .from('reservations')
      .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*)')
      .eq('id', (booked as any).reservation_id)
      .single()
    reservation = full
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        tenant_id: tenant.id, shift_id, guest_id: guest.id, seating_area_id: targetAreaId,
        date, time, party_size, occasion: occasion || null, notes: notes || null, status: 'confirmed', source,
        duration_minutes: resolvedDuration,
        ...(applicableRule ? { deposit_amount: applicableRule.amount_cents / 100, stripe_payment_intent: stripe_payment_intent_id } : {}),
      })
      .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*)')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
    reservation = inserted
  }

  if (!reservation) return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })

  await Promise.allSettled([
    sendConfirmationEmail(reservation, settings, tenant.slug, applicableRule?.refund_cutoff_hours),
    sendOwnerNotification(reservation, settings, tenant.slug),
    sendConfirmationSMS(reservation, settings),
  ]).then(results => {
    results.forEach(r => { if (r.status === 'rejected') console.error('Notification error:', r.reason) })
  })

  return NextResponse.json({ success: true, reservation }, { status: 201 })
}

export async function cancelReservation(req: NextRequest) {
  const body = await req.json()
  const { token } = body
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

  const { data: reservation } = await supabaseAdmin
    .from('reservations').select('*, guest:guests(*)')
    .eq('cancellation_token', token).maybeSingle()

  if (!reservation) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (reservation.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 409 })
  if (reservation.status === 'completed') return NextResponse.json({ error: 'Cannot cancel completed reservation' }, { status: 409 })

  let refunded = false
  if (reservation.deposit_amount && reservation.stripe_payment_intent) {
    const { data: s } = await supabaseAdmin.from('tenant_settings').select('stripe_account_id').eq('tenant_id', reservation.tenant_id).single()
    if (s?.stripe_account_id) {
      const { data: depositRules } = await supabaseAdmin.from('deposit_rules').select('*').eq('tenant_id', reservation.tenant_id)
      let cutoff = 24
      if (depositRules && depositRules.length > 0) {
        const resDay = new Date(reservation.date + 'T12:00:00').getUTCDay()
        const specific = depositRules.find((r: any) => r.rule_type === 'specific_date' && r.specific_date === reservation.date)
        const dayRule  = depositRules.find((r: any) => r.rule_type === 'day_of_week' && r.day_of_week === resDay)
        const allDays  = depositRules.find((r: any) => r.rule_type === 'all_days')
        const rule = specific || dayRule || allDays
        if (rule) cutoff = rule.refund_cutoff_hours
      }
      const hoursUntil = (new Date(`${reservation.date}T${reservation.time}`).getTime() - Date.now()) / 3600000
      if (hoursUntil >= cutoff) {
        const { refundDeposit } = await import('@/lib/stripe')
        await refundDeposit(reservation.stripe_payment_intent, s.stripe_account_id)
        refunded = true
      }
    }
  }

  await supabaseAdmin.from('reservations').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), ...(refunded ? { deposit_refunded: true } : {}) }).eq('id', reservation.id)

  const { data: settings } = await supabaseAdmin.from('tenant_settings').select('*').eq('tenant_id', reservation.tenant_id).single()
  if (settings) sendCancellationEmail(reservation, settings, refunded).catch(console.error)

  return NextResponse.json({ success: true, refunded })
}
