import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { StatusBadge } from '@/app/superadmin/page'

const PLAN_PRICE = 49

export default async function SuperadminBillingPage() {
  await requireSuperadmin()

  const { data: allTenants } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, status, created_at, trial_ends_at, stripe_subscription_id, tenant_settings(name, notification_email)')
    .order('created_at', { ascending: false })

  const tenants = allTenants ?? []

  const active   = tenants.filter(t => t.status === 'active')
  const trial    = tenants.filter(t => t.status === 'trial')
  const inactive = tenants.filter(t => t.status === 'inactive')

  const mrr         = active.length * PLAN_PRICE
  const potentialMrr = (active.length + trial.length) * PLAN_PRICE

  // Monthly signup trend (last 6 months)
  const months: { label: string; key: string; signups: number; active: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' })
    const monthTenants = tenants.filter(t => t.created_at.startsWith(key))
    months.push({
      label,
      key,
      signups: monthTenants.length,
      active: monthTenants.filter(t => t.status === 'active').length,
    })
  }
  const maxSignups = Math.max(...months.map(m => m.signups), 1)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Billing & Revenue</h1>
        <p className="text-sm text-offwhite/35 mt-1">MRR, churn, and subscription health.</p>
      </div>

      {/* MRR summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} sub={`${active.length} paying`} accent="sage" />
        <StatCard label="Potential MRR" value={`$${potentialMrr.toLocaleString()}`} sub="if all trials convert" accent="gold" />
        <StatCard label="Churned" value={inactive.length} sub="inactive tenants" accent="red" />
        <StatCard label="Plan price" value="$49" sub="per tenant / month" accent="neutral" />
      </div>

      {/* Signup trend */}
      <div className="rounded-2xl border border-white/[0.07] p-6 space-y-4">
        <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">Signup trend — last 6 months</p>
        <div className="space-y-2.5">
          {months.map(m => (
            <div key={m.key} className="flex items-center gap-3 text-sm">
              <span className="text-offwhite/40 w-12 shrink-0 text-xs">{m.label}</span>
              <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-sage/60 rounded-full"
                  style={{ width: `${(m.signups / maxSignups) * 100}%` }}
                />
              </div>
              <span className="text-offwhite/70 w-6 text-right text-xs">{m.signups}</span>
              {m.active > 0 && (
                <span className="text-sage text-xs w-20 shrink-0">({m.active} active)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active tenants */}
      <TenantTable
        title={`Active tenants — $${mrr}/mo MRR`}
        tenants={active}
        showTrial={false}
      />

      {/* Trial pipeline */}
      <TenantTable
        title={`Trial pipeline — ${trial.length} tenants`}
        tenants={trial}
        showTrial
      />

      {/* Churn list */}
      {inactive.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-red-400">Churned tenants — {inactive.length}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <Th>Restaurant</Th>
                <Th>Signed up</Th>
                <Th>Trial ended</Th>
                <Th>Had subscription</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {inactive.map((t: any) => {
                const name = t.tenant_settings?.[0]?.name || t.slug
                return (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <Td><span className="text-offwhite/70">{name}</span></Td>
                    <Td><span className="text-offwhite/40">{new Date(t.created_at).toLocaleDateString()}</span></Td>
                    <Td>
                      <span className="text-offwhite/40">
                        {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className={t.stripe_subscription_id ? 'text-sage text-xs' : 'text-offwhite/25 text-xs'}>
                        {t.stripe_subscription_id ? 'Yes' : 'No'}
                      </span>
                    </Td>
                    <Td>
                      <Link href={`/superadmin/tenants/${t.id}`} className="text-xs text-offwhite/30 hover:text-offwhite/70">
                        View →
                      </Link>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TenantTable({ title, tenants, showTrial }: {
  title: string
  tenants: any[]
  showTrial: boolean
}) {
  if (tenants.length === 0) return null
  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-sm font-semibold text-offwhite">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.05]">
            <Th>Restaurant</Th>
            <Th>Status</Th>
            {showTrial && <Th>Trial ends</Th>}
            <Th>Stripe subscription</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t: any) => {
            const name = t.tenant_settings?.[0]?.name || t.slug
            const daysLeft = t.trial_ends_at
              ? Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
              : null
            return (
              <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <Td>
                  <Link href={`/superadmin/tenants/${t.id}`} className="text-offwhite hover:text-offwhite/70 font-medium">
                    {name}
                  </Link>
                </Td>
                <Td><StatusBadge status={t.status} /></Td>
                {showTrial && (
                  <Td>
                    {t.trial_ends_at ? (
                      <span className={daysLeft !== null && daysLeft <= 3 ? 'text-red-400 text-xs' : daysLeft !== null && daysLeft <= 7 ? 'text-gold text-xs' : 'text-offwhite/40 text-xs'}>
                        {new Date(t.trial_ends_at).toLocaleDateString()}{daysLeft !== null ? ` (${daysLeft}d)` : ''}
                      </span>
                    ) : '—'}
                  </Td>
                )}
                <Td>
                  <span className="font-mono text-xs text-offwhite/30">
                    {t.stripe_subscription_id || '—'}
                  </span>
                </Td>
                <Td>
                  <Link href={`/superadmin/tenants/${t.id}`} className="text-xs text-offwhite/30 hover:text-offwhite/70">
                    View →
                  </Link>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub: string
  accent: 'sage' | 'gold' | 'red' | 'neutral'
}) {
  const color = accent === 'sage' ? 'text-sage' : accent === 'gold' ? 'text-gold' : accent === 'red' ? 'text-red-400' : 'text-offwhite'
  return (
    <div className="rounded-2xl border border-white/[0.07] p-6 space-y-1">
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{label}</p>
      <p className={`font-satoshi font-bold text-3xl ${color}`}>{value}</p>
      <p className="text-xs text-offwhite/30">{sub}</p>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-6 py-3">{children}</td>
}
