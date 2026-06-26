// tests/api.test.ts
// Correr: npx vitest run
// Con auth: ACCESS_TOKEN=xxx TENANT=offthehook npx vitest run

import { describe, it, expect } from 'vitest'

const BASE = 'http://localhost:3000'
const TENANT = process.env.TENANT || 'offthehook'
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''

const get = (path: string, token?: string) =>
  fetch(`${BASE}${path}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })

const post = (path: string, body: unknown, token?: string) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })

const patch = (path: string, body: unknown, token?: string) =>
  fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })

const del = (path: string, token?: string) =>
  fetch(`${BASE}${path}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} })

// Agrega ?tenant= para simular subdominio en dev
const t = (path: string) => `${path}${path.includes('?') ? '&' : '?'}tenant=${TENANT}`

let shiftId: string
let areaId: string
let reservationId: string
let cancellationToken: string
let guestId: string

// ── AVAILABILITY ──────────────────────────────────────────────
describe('GET /api/availability', () => {
  it('404 sin tenant', async () => {
    const res = await get('/api/availability?date=2026-08-01&party_size=2')
    expect(res.status).toBe(404)
  })

  it('400 sin parámetros', async () => {
    const res = await get(t('/api/availability'))
    expect(res.status).toBe(400)
  })

  it('400 fecha inválida', async () => {
    const res = await get(t('/api/availability?date=invalid&party_size=2'))
    expect(res.status).toBe(400)
  })

  it('400 party_size inválido', async () => {
    const res = await get(t('/api/availability?date=2026-08-01&party_size=abc'))
    expect(res.status).toBe(400)
  })

  it('cerrado en fecha bloqueada', async () => {
    const res = await get(t('/api/availability?date=2025-12-25&party_size=2'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.available).toBe(false)
    expect(data.reason).toBe('closed')
  })

  it('cerrado el lunes', async () => {
    const res = await get(t('/api/availability?date=2026-06-22&party_size=2'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.available).toBe(false)
  })

  it('retorna slots con áreas para viernes válido', async () => {
    const res = await get(t('/api/availability?date=2026-07-03&party_size=2'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.slots)).toBe(true)
    if (data.slots.length > 0) {
      expect(data.slots[0]).toHaveProperty('areas')
      shiftId = data.slots[0].shift_id
      areaId = data.slots[0].areas[0]?.area_id
    }
  })

  it('400 party_size fuera de rango', async () => {
    const res = await get(t('/api/availability?date=2026-07-03&party_size=999'))
    expect(res.status).toBe(400)
  })
})

// ── RESERVATIONS ──────────────────────────────────────────────
describe('POST /api/reservations', () => {
  it('404 sin tenant', async () => {
    const res = await post('/api/reservations', {})
    expect(res.status).toBe(404)
  })

  it('400 campos faltantes', async () => {
    const res = await post(t('/api/reservations'), { guest_name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('crea reserva correctamente', async () => {
    if (!shiftId) return
    const res = await post(t('/api/reservations'), {
      shift_id: shiftId,
      date: '2026-08-07',
      time: '19:00',
      party_size: 2,
      seating_area_id: areaId || null,
      guest_name: 'Test User',
      guest_email: `test.${Date.now()}@example.com`,
      guest_phone: '6461234567',
      guest_birthday: '1990-06-15',
      occasion: 'birthday',
      notes: 'Test reservation'
    })
    expect([201, 409]).toContain(res.status)
    if (res.status === 201) {
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.reservation).toHaveProperty('id')
      reservationId = data.reservation.id
      cancellationToken = data.reservation.cancellation_token
      guestId = data.reservation.guest_id
    }
  })
})

// ── CANCEL ────────────────────────────────────────────────────
describe('POST /api/reservations?action=cancel', () => {
  it('400 sin token', async () => {
    const res = await post(t('/api/reservations?action=cancel'), {})
    expect(res.status).toBe(400)
  })

  it('404 token inválido', async () => {
    const res = await post(t('/api/reservations?action=cancel'), { token: 'invalid' })
    expect(res.status).toBe(404)
  })

  it('cancela con token válido', async () => {
    if (!cancellationToken) return
    const res = await post(t('/api/reservations?action=cancel'), { token: cancellationToken })
    expect([200, 409]).toContain(res.status)
  })
})

// ── ADMIN SIN AUTH ────────────────────────────────────────────
describe('Admin — sin token', () => {
  const resources = ['reservations', 'guests', 'shifts', 'areas', 'blocked-dates', 'settings', 'stats', 'employees']
  for (const r of resources) {
    it(`GET /api/admin?resource=${r} → 401`, async () => {
      const res = await get(t(`/api/admin?resource=${r}`))
      expect(res.status).toBe(401)
    })
  }
})

// ── ADMIN AUTENTICADO ─────────────────────────────────────────
// Para correr estos tests:
// 1. Loguéate en la app y copiá el access_token de Supabase (localStorage o devtools)
// 2. ACCESS_TOKEN=ese_token TENANT=offthehook npx vitest run

describe('Admin — autenticado', () => {
  it('GET stats', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=stats'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('today')
    expect(data).toHaveProperty('week')
    expect(data).toHaveProperty('last_month')
  })

  it('GET settings', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=settings'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.settings).toHaveProperty('notification_email')
    expect(data.settings).toHaveProperty('primary_color')
  })

  it('PATCH settings', async () => {
    if (!ACCESS_TOKEN) return
    const res = await patch(t('/api/admin?resource=settings'), { notification_email: 'test@test.com' }, ACCESS_TOKEN)
    expect(res.status).toBe(200)
    await patch(t('/api/admin?resource=settings'), { notification_email: 'owner@offthehooknyc.com' }, ACCESS_TOKEN)
  })

  it('GET areas', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=areas'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.areas)).toBe(true)
  })

  it('POST area → PATCH → DELETE', async () => {
    if (!ACCESS_TOKEN) return
    const create = await post(t('/api/admin?resource=areas'), { name: 'Test Area', position: 99 }, ACCESS_TOKEN)
    expect(create.status).toBe(201)
    const { area } = await create.json()

    const update = await patch(t(`/api/admin?resource=areas&id=${area.id}`), { name: 'Updated Area' }, ACCESS_TOKEN)
    expect(update.status).toBe(200)

    const remove = await del(t(`/api/admin?resource=areas&id=${area.id}`), ACCESS_TOKEN)
    expect(remove.status).toBe(200)
  })

  it('GET shifts', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=shifts'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.shifts)).toBe(true)
  })

  it('POST shift → PATCH → DELETE', async () => {
    if (!ACCESS_TOKEN) return
    const create = await post(t('/api/admin?resource=shifts'), {
      day_of_week: 1, name: 'Test Shift',
      start_time: '12:00', end_time: '15:00',
      interval_minutes: 30, duration_minutes: 90, areas: []
    }, ACCESS_TOKEN)
    expect(create.status).toBe(201)
    const { shift } = await create.json()

    await patch(t(`/api/admin?resource=shifts&id=${shift.id}`), { name: 'Updated Shift' }, ACCESS_TOKEN)
    const remove = await del(t(`/api/admin?resource=shifts&id=${shift.id}`), ACCESS_TOKEN)
    expect(remove.status).toBe(200)
  })

  it('POST blocked-date → DELETE', async () => {
    if (!ACCESS_TOKEN) return
    const create = await post(t('/api/admin?resource=blocked-dates'), { date: '2026-10-01', reason: 'Test' }, ACCESS_TOKEN)
    expect([201, 409]).toContain(create.status)
    if (create.status === 201) {
      const { blocked_date } = await create.json()
      const remove = await del(t(`/api/admin?resource=blocked-dates&id=${blocked_date.id}`), ACCESS_TOKEN)
      expect(remove.status).toBe(200)
    }
  })

  it('POST special event → DELETE', async () => {
    if (!ACCESS_TOKEN) return
    const create = await post(t('/api/admin?resource=events'), {
      name: "Valentine's Day", date: '2027-02-14',
      deposit_amount: 2500, refund_cutoff_hours: 48
    }, ACCESS_TOKEN)
    expect(create.status).toBe(201)
    const { event } = await create.json()
    const remove = await del(t(`/api/admin?resource=events&id=${event.id}`), ACCESS_TOKEN)
    expect(remove.status).toBe(200)
  })

  it('GET reservations', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=reservations'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.reservations)).toBe(true)
  })

  it('GET guests', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=guests'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.guests)).toBe(true)
  })

  it('GET guests con search', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=guests&search=test'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
  })

  it('POST guest tag → DELETE', async () => {
    if (!ACCESS_TOKEN || !guestId) return
    const create = await post(t(`/api/admin?resource=guest-tag&guest_id=${guestId}`), { tag: 'VIP' }, ACCESS_TOKEN)
    expect(create.status).toBe(201)
    const { tag } = await create.json()
    const remove = await del(t(`/api/admin?resource=guest-tag&id=${tag.id}`), ACCESS_TOKEN)
    expect(remove.status).toBe(200)
  })

  it('GET employees', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=employees'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.employees)).toBe(true)
  })

  it('POST invite employee', async () => {
    if (!ACCESS_TOKEN) return
    const res = await post(t('/api/admin?resource=employees'), { email: `emp.${Date.now()}@test.com` }, ACCESS_TOKEN)
    expect(res.status).toBe(201)
  })

  it('GET campaigns', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=campaigns'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.campaigns)).toBe(true)
  })

  it('GET birthday config', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=birthday-config'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
  })

  it('PATCH birthday config', async () => {
    if (!ACCESS_TOKEN) return
    const res = await patch(t('/api/admin?resource=birthday-config'), {
      is_enabled: false, days_before: 7,
      email_subject: 'Happy Birthday!', email_body: 'Hi {guest_name}!'
    }, ACCESS_TOKEN)
    expect(res.status).toBe(200)
  })

  it('GET referrals', async () => {
    if (!ACCESS_TOKEN) return
    const res = await get(t('/api/admin?resource=referrals'), ACCESS_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.referrals)).toBe(true)
  })

  it('PATCH reservation → completed', async () => {
    if (!ACCESS_TOKEN || !reservationId) return
    const res = await patch(t(`/api/admin?resource=reservations&id=${reservationId}`), { status: 'completed' }, ACCESS_TOKEN)
    expect(res.status).toBe(200)
  })
})
