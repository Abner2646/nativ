import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { DepositRulesClient } from '@/components/admin/DepositRulesClient'
import type { DepositRule } from '@/lib/types'

export default async function DepositsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)
  const { tenant } = access

  const [{ data: rules }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('deposit_rules').select('*').eq('tenant_id', tenant.id).order('rule_type'),
    supabaseAdmin.from('tenant_settings').select('stripe_account_id').eq('tenant_id', tenant.id).single(),
  ])

  if (!settings) return notFound()

  let stripeConnected = false
  const accountId = settings.stripe_account_id || null
  if (accountId) {
    try {
      const { stripe } = await import('@/lib/stripe')
      const account = await stripe.accounts.retrieve(accountId)
      stripeConnected = account.charges_enabled
    } catch { /* account fetch failed — treat as not connected */ }
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-2">Deposits & Payments</h1>
      <p className="text-sm text-offwhite/40 mb-6 md:mb-8">Require a deposit to confirm reservations on specific days.</p>
      <DepositRulesClient
        initialRules={(rules || []) as DepositRule[]}
        stripeAccountId={accountId}
        stripeConnected={stripeConnected}
        slug={slug}
      />
    </div>
  )
}
