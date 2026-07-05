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

  // Prevent creating a second subscription if one already exists
  if (ctx.tenant.status === 'active' && ctx.tenant.stripe_subscription_id) {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
  }

  // Only apply the referred coupon on the FIRST subscription ever.
  // If stripe_subscription_id is already set (cancelled and re-subscribing),
  // the coupon was already used — don't re-apply it.
  const isFirstSubscription = !ctx.tenant.stripe_subscription_id
  let couponId: string | undefined

  if (isFirstSubscription) {
    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('referred_coupon_id')
      .eq('referred_tenant_id', ctx.tenant.id)
      .maybeSingle()
    couponId = referral?.referred_coupon_id ?? undefined
  }

  const session = await createCheckoutSession(
    ctx.tenant.id,
    ctx.tenant.slug,
    ctx.tenant.stripe_customer_id,
    couponId,
  )
  return NextResponse.json({ url: session.url })
}
