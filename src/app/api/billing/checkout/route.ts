import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { createCheckoutSession } from '@/lib/stripe'

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

export async function POST(req: NextRequest) {
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // If this tenant was referred, include their discount coupon in the checkout session
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('referred_coupon_id')
    .eq('referred_tenant_id', ctx.tenant.id)
    .maybeSingle()

  const session = await createCheckoutSession(
    ctx.tenant.id,
    ctx.tenant.slug,
    ctx.tenant.stripe_customer_id,
    referral?.referred_coupon_id ?? undefined
  )
  return NextResponse.json({ url: session.url })
}
