import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const tenant = searchParams.get('tenant')
  if (!email || !tenant) return NextResponse.json({ error: 'email and tenant required' }, { status: 400 })
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  await supabaseAdmin.from('guests')
    .update({ email_opt_out: true })
    .eq('email', email)
    .eq('tenant_id', ctx.tenant.id)
  return NextResponse.json({ success: true })
}
