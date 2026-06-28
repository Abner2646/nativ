// src/lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function createSubscription(customerId: string, couponId?: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: process.env.STRIPE_PRICE_ID! }],
    trial_end: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {})
  })
}

export async function createConnectAccountLink(tenantId: string, slug: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    metadata: { tenant_id: tenantId }
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${appUrl}/restaurant/${slug}/settings?stripe=refresh`,
    return_url: `${appUrl}/restaurant/${slug}/settings?stripe=success`,
    type: 'account_onboarding'
  })
  return { accountId: account.id, url: link.url }
}

export async function createDepositPaymentIntent(
  amount: number, stripeAccountId: string, reservationId: string
) {
  return stripe.paymentIntents.create(
    { amount, currency: 'usd', metadata: { reservation_id: reservationId } },
    { stripeAccount: stripeAccountId }
  )
}

export async function refundDeposit(paymentIntentId: string, stripeAccountId: string) {
  return stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { stripeAccount: stripeAccountId }
  )
}

export async function createReferralCoupon() {
  const coupon = await stripe.coupons.create({
    percent_off: 50,
    duration: 'repeating',
    duration_in_months: 3,
  })
  return coupon.id
}

export async function applyDiscountToSubscription(subscriptionId: string, couponId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    discounts: [{ coupon: couponId }],
  })
}

export async function createCheckoutSession(
  tenantId: string,
  slug: string,
  customerId?: string | null,
  couponId?: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${appUrl}/restaurant/${slug}/billing?success=true`,
    cancel_url: `${appUrl}/restaurant/${slug}/billing`,
    metadata: { tenant_id: tenantId },
    subscription_data: { metadata: { tenant_id: tenantId } },
    ...(customerId ? { customer: customerId } : {}),
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
  })
}

export async function createBillingPortalSession(customerId: string, slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/restaurant/${slug}/billing`,
  })
}
