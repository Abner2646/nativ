import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const tenantId = session.metadata?.tenant_id
    if (tenantId && session.subscription) {
      const subscriptionId = session.subscription as string

      await supabaseAdmin.from('tenants').update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        status: 'active',
      }).eq('id', tenantId)

      // If this tenant referred others while still in trial, apply their referrer coupon now.
      // (If they were already subscribed when the referral happened, it was applied in /api/register.)
      const { data: pendingReferral } = await supabaseAdmin
        .from('referrals')
        .select('referrer_coupon_id')
        .eq('referrer_tenant_id', tenantId)
        .not('referrer_coupon_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingReferral?.referrer_coupon_id) {
        await stripe.subscriptions.update(subscriptionId, {
          discounts: [{ coupon: pendingReferral.referrer_coupon_id }],
        }).catch(e => console.error('[webhook] referrer coupon apply failed:', e))
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const tenantId = sub.metadata?.tenant_id
    if (tenantId) {
      await supabaseAdmin.from('tenants').update({ status: 'inactive' }).eq('id', tenantId)
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const subId = (invoice as any).subscription as string | undefined
    if (subId) {
      await supabaseAdmin.from('tenants').update({ status: 'inactive' }).eq('stripe_subscription_id', subId)
    }
  }

  return NextResponse.json({ received: true })
}
