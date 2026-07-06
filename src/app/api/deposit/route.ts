import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantFromRequest } from '@/lib/tenant'
import { createDepositPaymentIntent } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const ctx = await resolveTenantFromRequest(req)
  if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { settings } = ctx
  if (!settings.stripe_account_id) {
    return NextResponse.json({ error: 'Restaurant has not set up payments yet' }, { status: 400 })
  }

  const body = await req.json()
  const { amount_cents } = body
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 50) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const pi = await createDepositPaymentIntent(amount_cents, settings.stripe_account_id, 'pending')
  return NextResponse.json({ client_secret: pi.client_secret, stripe_account_id: settings.stripe_account_id })
}
