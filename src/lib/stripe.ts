// src/lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
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
