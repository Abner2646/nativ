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

  const { tenantId, notes, tenantName } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('tenant_settings')
    .update({ internal_notes: notes ?? null })
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditEvent({
    adminId: admin.id,
    adminEmail: admin.email!,
    action: 'update_notes',
    targetType: 'tenant',
    targetId: tenantId,
    targetName: tenantName,
  })

  return NextResponse.json({ ok: true })
}
