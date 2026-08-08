import { NextRequest, NextResponse } from 'next/server'
import { getUser, getProfile } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAuditEvent } from '@/lib/audit'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const isDev = process.env.NODE_ENV === 'development'
const FROM_DEV = 'onboarding@resend.dev'

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

  const { subject, body, target } = await req.json()
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }
  if (!['all', 'active', 'trial'].includes(target)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }

  const query = supabaseAdmin
    .from('tenants')
    .select('id, status, tenant_settings(notification_email, name)')
  if (target !== 'all') query.eq('status', target)
  else query.in('status', ['active', 'trial'])

  const { data: tenants, error: fetchError } = await query
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const recipients = (tenants ?? [])
    .map((t: any) => ({
      email: t.tenant_settings?.[0]?.notification_email as string | undefined,
      name: t.tenant_settings?.[0]?.name as string | undefined,
    }))
    .filter((r): r is { email: string; name: string | undefined } => Boolean(r.email))

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No recipients found' })
  }

  const from = isDev
    ? FROM_DEV
    : `Nativ <noreply@nativ.com>`

  let sent = 0
  const errors: string[] = []

  for (const r of recipients) {
    const { error } = await resend.emails.send({
      from,
      to: isDev ? FROM_DEV : r.email,
      subject,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6">${body}</div>`,
    })
    if (error) errors.push(`${r.email}: ${error.message}`)
    else sent++
  }

  logAuditEvent({
    adminId: admin.id,
    adminEmail: admin.email!,
    action: 'broadcast',
    metadata: { subject, target, sent, errors: errors.length },
  })

  return NextResponse.json({ sent, errors, total: recipients.length })
}

// Preview recipients without sending
export async function GET(req: NextRequest) {
  const admin = await verifySuperadmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = req.nextUrl.searchParams.get('target') ?? 'all'

  const query = supabaseAdmin
    .from('tenants')
    .select('id, status, tenant_settings(notification_email, name)')
  if (target !== 'all') query.eq('status', target)
  else query.in('status', ['active', 'trial'])

  const { data: tenants, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recipients = (tenants ?? [])
    .map((t: any) => ({
      email: t.tenant_settings?.[0]?.notification_email as string | undefined,
      name: t.tenant_settings?.[0]?.name as string | undefined,
    }))
    .filter((r): r is { email: string; name: string | undefined } => Boolean(r.email))

  return NextResponse.json({ recipients })
}
