// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createServerSupabase } from '@/lib/supabase'

// POST /api/register — crea un nuevo tenant para el usuario autenticado
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug } = await req.json()
  if (!name || !slug) return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })

  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const reserved = ['www', 'app', 'admin', 'api', 'mail', 'nativ', 'support', 'docs']
  if (reserved.includes(slug)) return NextResponse.json({ error: 'URL not available' }, { status: 409 })

  const { data: existing } = await supabaseAdmin.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: 'URL already taken' }, { status: 409 })

  // Crear tenant
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from('tenants').insert({ slug, status: 'trial' }).select().single()
  if (tenantErr || !tenant) return NextResponse.json({ error: 'Failed to create restaurant' }, { status: 500 })

  // Crear settings
  await supabaseAdmin.from('tenant_settings').insert({ tenant_id: tenant.id, name, notification_email: user.email! })

  // Crear birthday config por defecto
  await supabaseAdmin.from('birthday_campaign_config').insert({
    tenant_id: tenant.id, is_enabled: false, days_before: 7,
    email_subject: `Happy Birthday from ${name}!`,
    email_body: `<p>Hi {guest_name}, we'd love to celebrate your birthday at ${name}!</p><p><a href="{reserve_url}">Reserve a Table</a></p>`
  })

  // Agregar al usuario como admin del tenant
  await supabaseAdmin.from('tenant_members').insert({ tenant_id: tenant.id, user_id: user.id, role: 'admin' })

  // Verificar si tiene ref de referido
  const refCode = req.nextUrl.searchParams.get('ref')
  if (refCode) {
    const { data: referrer } = await supabaseAdmin.from('tenants').select('id').eq('slug', refCode).maybeSingle()
    if (referrer && referrer.id !== tenant.id) {
      const { createReferralCoupon } = await import('@/lib/stripe')
      const [referrerCoupon, referredCoupon] = await Promise.all([createReferralCoupon(), createReferralCoupon()])
      await supabaseAdmin.from('referrals').insert({
        referrer_tenant_id: referrer.id, referred_tenant_id: tenant.id,
        referrer_coupon_id: referrerCoupon, referred_coupon_id: referredCoupon
      })
    }
  }

  return NextResponse.json({ success: true, slug }, { status: 201 })
}

// POST /api/register/invite?token=xxx — acepta una invitación de empleado
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: invite } = await supabaseAdmin
    .from('employee_invites').select('*').eq('token', token).maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Invite already used' }, { status: 409 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // Agregar al usuario como empleado
  await supabaseAdmin.from('tenant_members').upsert(
    { tenant_id: invite.tenant_id, user_id: user.id, role: 'employee' },
    { onConflict: 'tenant_id,user_id' }
  )

  // Marcar invite como usada
  await supabaseAdmin.from('employee_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ success: true, tenant_id: invite.tenant_id })
}
