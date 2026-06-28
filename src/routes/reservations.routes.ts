// src/routes/reservations.routes.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { sendConfirmationEmail, sendOwnerNotification, sendCancellationEmail } from '@/lib/email'
import { sendConfirmationSMS } from '@/lib/sms'
import { reservationLimiter, checkRateLimit } from '@/lib/ratelimit'

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

  const { data: shift } = await supabaseAdmin
    .from('shifts').select('*, shift_areas(*)')
    .eq('id', shift_id).eq('tenant_id', tenant.id).eq('is_active', true).maybeSingle()

  if (!shift) return NextResponse.json({ error: 'Invalid shift' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('reservations').select('party_size, seating_area_id')
    .eq('shift_id', shift_id).eq('tenant_id', tenant.id)
    .eq('date', date).eq('time', time).eq('status', 'confirmed')

  if (seating_area_id) {
    const sa = shift.shift_areas?.find((a: any) => a.seating_area_id === seating_area_id)
    if (!sa) return NextResponse.json({ error: 'Invalid seating area' }, { status: 400 })
    const used = (existing || []).filter(r => r.seating_area_id === seating_area_id).reduce((s, r) => s + r.party_size, 0)
    if (sa.capacity - used < party_size) return NextResponse.json({ error: 'Area no longer available' }, { status: 409 })
  } else {
    const hasAvail = shift.shift_areas?.some((sa: any) => {
      const used = (existing || []).filter(r => r.seating_area_id === sa.seating_area_id).reduce((s, r) => s + r.party_size, 0)
      return sa.capacity - used >= party_size
    })
    if (!hasAvail) return NextResponse.json({ error: 'No availability for this slot' }, { status: 409 })
  }

  // Upsert guest
  const { data: guest } = await supabaseAdmin
    .from('guests')
    .upsert({ tenant_id: tenant.id, email: guest_email, name: guest_name, phone: guest_phone || null, birthday: guest_birthday || null },
      { onConflict: 'tenant_id,email' })
    .select().single()

  if (!guest) return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 })

  const { data: reservation, error } = await supabaseAdmin
    .from('reservations')
    .insert({ tenant_id: tenant.id, shift_id, guest_id: guest.id, seating_area_id: seating_area_id || null,
      date, time, party_size, occasion: occasion || null, notes: notes || null, status: 'confirmed' })
    .select('*, guest:guests(*), seating_area:seating_areas(*), shift:shifts(*)')
    .single()

  if (error || !reservation) return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })

  Promise.all([
    sendConfirmationEmail(reservation, settings, tenant.slug),
    sendOwnerNotification(reservation, settings),
    sendConfirmationSMS(reservation, settings),
  ]).catch(e => console.error('Notification error:', e))

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
      const { data: ev } = await supabaseAdmin.from('special_events').select('refund_cutoff_hours').eq('tenant_id', reservation.tenant_id).eq('date', reservation.date).maybeSingle()
      const cutoff = ev?.refund_cutoff_hours ?? 24
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
  if (settings) sendCancellationEmail(reservation, settings).catch(console.error)

  return NextResponse.json({ success: true, refunded })
}
