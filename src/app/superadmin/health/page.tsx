import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export default async function SuperadminHealthPage() {
  await requireSuperadmin()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const now = new Date().toISOString()

  const [
    { data: allTenants },
    { data: tenantsWithShifts },
    { data: tenantsWithAreas },
    { data: activeReservations30d },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, slug, status, trial_ends_at, stripe_subscription_id, tenant_settings(name, stripe_account_id)')
      .in('status', ['active', 'trial']),
    supabaseAdmin
      .from('shifts')
      .select('tenant_id')
      .eq('is_active', true),
    supabaseAdmin
      .from('seating_areas')
      .select('tenant_id')
      .eq('is_active', true),
    supabaseAdmin
      .from('reservations')
      .select('tenant_id')
      .gte('created_at', thirtyDaysAgo),
  ])

  const tenants = allTenants ?? []
  const tenantIdsWithShifts = new Set((tenantsWithShifts ?? []).map(s => s.tenant_id))
  const tenantIdsWithAreas  = new Set((tenantsWithAreas ?? []).map(a => a.tenant_id))
  const tenantIdsWithReservations = new Set((activeReservations30d ?? []).map(r => r.tenant_id))

  // Health checks
  const expiredTrials = tenants.filter(t =>
    t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date()
  )
  const noShifts = tenants.filter(t => !tenantIdsWithShifts.has(t.id))
  const noAreas  = tenants.filter(t => !tenantIdsWithAreas.has(t.id))
  const dormant  = tenants.filter(t =>
    t.status === 'active' && !tenantIdsWithReservations.has(t.id)
  )
  const activeNoStripe = tenants.filter(t =>
    t.status === 'active' && !t.stripe_subscription_id
  )

  const totalIssues = expiredTrials.length + noShifts.length + noAreas.length + dormant.length + activeNoStripe.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Platform Health</h1>
        <p className="text-sm text-offwhite/35 mt-1">Configuration issues and dormant accounts.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HealthCard label="Expired trials" count={expiredTrials.length} severity="red" />
        <HealthCard label="No billing setup" count={activeNoStripe.length} severity="red" />
        <HealthCard label="No shifts" count={noShifts.length} severity="gold" />
        <HealthCard label="No seating areas" count={noAreas.length} severity="gold" />
        <HealthCard label="Dormant (30d)" count={dormant.length} severity="neutral" />
      </div>

      {totalIssues === 0 && (
        <div className="rounded-2xl border border-sage/20 bg-sage/5 p-6 text-center">
          <p className="text-sage font-semibold">All systems healthy</p>
          <p className="text-sm text-offwhite/40 mt-1">No configuration issues found.</p>
        </div>
      )}

      <HealthSection
        title="Expired trials — needs action"
        description="Status is still 'trial' but trial_ends_at has passed. Activate, deactivate, or extend."
        severity="red"
        tenants={expiredTrials}
        renderExtra={(t: any) => {
          const days = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
          return <span className="text-red-400 text-xs">{Math.abs(days)}d ago</span>
        }}
      />

      <HealthSection
        title="Active tenants without Stripe subscription"
        description="These tenants are marked 'active' but have no Stripe subscription ID. Billing may not be set up."
        severity="red"
        tenants={activeNoStripe}
      />

      <HealthSection
        title="No shifts configured"
        description="These tenants have no active shifts. They cannot receive reservations."
        severity="gold"
        tenants={noShifts}
      />

      <HealthSection
        title="No seating areas configured"
        description="These tenants have no active seating areas."
        severity="gold"
        tenants={noAreas}
      />

      <HealthSection
        title="Dormant active tenants (0 reservations in 30 days)"
        description="Paying tenants with no recent reservation activity. May need outreach."
        severity="neutral"
        tenants={dormant}
      />
    </div>
  )
}

function HealthCard({ label, count, severity }: {
  label: string; count: number; severity: 'red' | 'gold' | 'neutral'
}) {
  const color = severity === 'red' ? 'text-red-400' : severity === 'gold' ? 'text-gold' : 'text-offwhite/60'
  const bg    = severity === 'red' ? 'border-red-400/20' : severity === 'gold' ? 'border-gold/20' : 'border-white/[0.07]'
  return (
    <div className={`rounded-2xl border p-5 space-y-1 ${bg}`}>
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{label}</p>
      <p className={`font-satoshi font-bold text-3xl ${color}`}>{count}</p>
    </div>
  )
}

function HealthSection({ title, description, severity, tenants, renderExtra }: {
  title: string
  description: string
  severity: 'red' | 'gold' | 'neutral'
  tenants: any[]
  renderExtra?: (t: any) => React.ReactNode
}) {
  if (tenants.length === 0) return null
  const headerColor = severity === 'red' ? 'text-red-400' : severity === 'gold' ? 'text-gold' : 'text-offwhite/60'
  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className={`text-sm font-semibold ${headerColor}`}>{title} — {tenants.length}</p>
        <p className="text-xs text-offwhite/30 mt-0.5">{description}</p>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {tenants.map((t: any) => {
          const name = t.tenant_settings?.[0]?.name || t.slug
          return (
            <li key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02]">
              <Link href={`/superadmin/tenants/${t.id}`} className="text-sm text-offwhite hover:text-offwhite/70">
                {name}
                <span className="ml-2 font-mono text-xs text-offwhite/30">{t.slug}</span>
              </Link>
              <div className="flex items-center gap-3">
                {renderExtra?.(t)}
                <Link href={`/superadmin/tenants/${t.id}`} className="text-xs text-offwhite/30 hover:text-offwhite/70">
                  View →
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
