import { NextRequest, NextResponse } from 'next/server'
import { getUser, getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Todos los endpoints de superadmin verifican is_superadmin en el servidor.
// No hay forma de bypassear esto desde el cliente.
async function verifySuperadmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_superadmin) return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tenantId = req.nextUrl.searchParams.get('id')
  const action = req.nextUrl.searchParams.get('action')

  if (!tenantId || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, status, trial_ends_at')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  switch (action) {
    case 'activate': {
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'active' })
        .eq('id', tenantId)
      if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
      return NextResponse.json({ status: 'active' })
    }

    case 'deactivate': {
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'inactive' })
        .eq('id', tenantId)
      if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
      return NextResponse.json({ status: 'inactive' })
    }

    case 'start_trial': {
      const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString()
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'trial', trial_ends_at: trialEndsAt })
        .eq('id', tenantId)
      if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
      return NextResponse.json({ status: 'trial', trial_ends_at: trialEndsAt })
    }

    case 'extend_trial': {
      const body = await req.json().catch(() => ({}))
      const days = Number(body.days) || 14
      if (days < 1 || days > 365) {
        return NextResponse.json({ error: 'days must be 1–365' }, { status: 400 })
      }
      // Extender desde hoy si ya venció, o desde la fecha actual de fin de trial
      const base = tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()
        ? new Date(tenant.trial_ends_at)
        : new Date()
      base.setDate(base.getDate() + days)
      const trialEndsAt = base.toISOString()
      const { error } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'trial', trial_ends_at: trialEndsAt })
        .eq('id', tenantId)
      if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
      return NextResponse.json({ status: 'trial', trial_ends_at: trialEndsAt })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
