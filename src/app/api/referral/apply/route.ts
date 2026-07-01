import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveTenantFromRequest } from '@/lib/tenant'

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

// POST /api/referral/apply?tenant=slug
// Applies a referral code for a tenant still in trial (grace period).
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

  if (ctx.tenant.status !== 'trial') {
    return NextResponse.json({ error: 'Referral codes can only be applied during the free trial' }, { status: 409 })
  }

  const { data: existingReferral } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referred_tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (existingReferral) {
    return NextResponse.json({ error: 'A referral code has already been applied to this account' }, { status: 409 })
  }

  const { code } = await req.json()
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid referral code format' }, { status: 400 })
  }

  const { data: referrer } = await supabaseAdmin
    .from('tenants')
    .select('id, stripe_subscription_id')
    .eq('referral_code', code)
    .maybeSingle()

  if (!referrer) return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
  if (referrer.id === ctx.tenant.id) return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })

  const { createReferralCoupon, applyDiscountToSubscription } = await import('@/lib/stripe')
  const [referrerCoupon, referredCoupon] = await Promise.all([createReferralCoupon(), createReferralCoupon()])

  await supabaseAdmin.from('referrals').insert({
    referrer_tenant_id: referrer.id,
    referred_tenant_id: ctx.tenant.id,
    referrer_coupon_id: referrerCoupon,
    referred_coupon_id: referredCoupon,
    referral_code_used: code,
  })

  if (referrer.stripe_subscription_id) {
    await applyDiscountToSubscription(referrer.stripe_subscription_id, referrerCoupon)
      .catch(e => console.error('[referral/apply] referrer coupon apply failed:', e))
  }

  return NextResponse.json({ success: true })
}
