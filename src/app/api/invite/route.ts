import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, createServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data: invite } = await supabaseAdmin
    .from('employee_invites')
    .select('email, expires_at, tenant:tenants(slug, tenant_settings(name))')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }

  const tenant = invite.tenant as any
  const settings = tenant?.tenant_settings?.[0]
  return NextResponse.json({
    email: invite.email,
    restaurantName: settings?.name || tenant?.slug || 'Restaurant',
    slug: tenant?.slug,
  })
}

export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: invite } = await supabaseAdmin
    .from('employee_invites')
    .select('*, tenant:tenants(slug)')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 })
  }
  if (invite.email !== user.email) {
    return NextResponse.json({ error: 'This invite was sent to a different email address' }, { status: 403 })
  }

  await supabaseAdmin.from('tenant_members').upsert(
    { tenant_id: invite.tenant_id, user_id: user.id, role: 'employee' },
    { onConflict: 'tenant_id,user_id' }
  )

  await supabaseAdmin.from('employee_invites').delete().eq('token', token)

  const slug = (invite.tenant as any)?.slug
  return NextResponse.json({ slug })
}
