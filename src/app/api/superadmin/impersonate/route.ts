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

export async function POST(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tenantId, tenantName } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 })

  // Find the first admin member of this tenant
  const { data: member, error: memberError } = await supabaseAdmin
    .from('tenant_members')
    .select('profiles(email)')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin')
    .order('created_at')
    .limit(1)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'No admin found for this tenant' }, { status: 404 })
  }

  const targetEmail = (member as any).profiles?.email
  if (!targetEmail) {
    return NextResponse.json({ error: 'Admin email not found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
    options: { redirectTo: `${appUrl}/dashboard` },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditEvent({
    adminId: admin.id,
    adminEmail: admin.email!,
    action: 'impersonate',
    targetType: 'tenant',
    targetId: tenantId,
    targetName: tenantName,
    metadata: { targetEmail },
  })

  return NextResponse.json({ link: data.properties.action_link, targetEmail })
}
