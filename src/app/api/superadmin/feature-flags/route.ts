import { NextRequest, NextResponse } from 'next/server'
import { getUser, getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAuditEvent } from '@/lib/audit'

async function verifySuperadmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const user = await getUser()
  if (!user) return null
  const profile = await getProfile(user.id)
  if (!profile?.is_superadmin) return null
  return user
}

export async function PATCH(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tenantId, flagKey, value, tenantName } = await req.json()
  if (!tenantId || !flagKey) {
    return NextResponse.json({ error: 'Missing tenantId or flagKey' }, { status: 400 })
  }

  const { data: settings, error: fetchError } = await supabaseAdmin
    .from('tenant_settings')
    .select('feature_flags')
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const currentFlags = (settings?.feature_flags as Record<string, boolean>) ?? {}
  const newFlags = { ...currentFlags, [flagKey]: value }

  const { error } = await supabaseAdmin
    .from('tenant_settings')
    .update({ feature_flags: newFlags })
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditEvent({
    adminId: admin.id,
    adminEmail: admin.email!,
    action: 'toggle_feature_flag',
    targetType: 'tenant',
    targetId: tenantId,
    targetName: tenantName,
    metadata: { flagKey, value },
  })

  return NextResponse.json({ ok: true, flags: newFlags })
}
