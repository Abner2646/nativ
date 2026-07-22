import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { BackupButton } from '@/app/superadmin/BackupButton'

const PLAN_PRICE = 49

export default async function SuperadminOverviewPage() {
  await requireSuperadmin()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString()

  const [
    { data: tenants },
    { data: recentSignups },
    { data: expiringTrials },
    { count: totalReservations30d },
  ] = await Promise.all([
    supabaseAdmin.from('tenants').select('status'),
    supabaseAdmin
      .from('tenants')
      .select('id, slug, status, created_at, tenant_settings(name)')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('tenants')
      .select('id, slug, trial_ends_at, tenant_settings(name)')
      .eq('status', 'trial')
      .lte('trial_ends_at', sevenDaysFromNow)
      .gt('trial_ends_at', new Date().toISOString())
      .order('trial_ends_at'),
    supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),
  ])

  const counts = { active: 0, trial: 0, inactive: 0 }
  for (const t of tenants ?? []) counts[t.status as keyof typeof counts]++
  const mrr = counts.active * PLAN_PRICE

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-satoshi font-bold text-2xl text-offwhite">Overview</h1>
          <p className="text-sm text-offwhite/35 mt-1">Platform health at a glance.</p>
        </div>
        <BackupButton />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} sub={`${counts.active} paying`} accent="sage" />
        <StatCard label="Active" value={counts.active} sub="paying tenants" accent="sage" />
        <StatCard label="Trial" value={counts.trial} sub="14-day trial" accent="gold" />
        <StatCard label="Inactive" value={counts.inactive} sub="churned / expired" accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR potencial */}
        <div className="rounded-2xl border border-white/[0.07] p-6 space-y-3">
          <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">Potential MRR</p>
          <div className="space-y-2">
            <MetricRow label="Current MRR" value={`$${mrr}`} />
            <MetricRow label="If all trials convert" value={`$${(counts.active + counts.trial) * PLAN_PRICE}`} />
            <MetricRow label="Reservations (last 30d)" value={(totalReservations30d ?? 0).toLocaleString()} />
          </div>
        </div>

        {/* Trials expiring soon */}
        <div className="rounded-2xl border border-white/[0.07] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">Trials expiring in 7 days</p>
            <Link href="/superadmin/tenants?filter=trial" className="text-xs text-offwhite/40 hover:text-offwhite/70 transition-colors">
              See all →
            </Link>
          </div>
          {(expiringTrials ?? []).length === 0 ? (
            <p className="text-sm text-offwhite/25">None expiring soon.</p>
          ) : (
            <ul className="space-y-2">
              {(expiringTrials ?? []).map((t: any) => {
                const name = t.tenant_settings?.[0]?.name || t.slug
                const daysLeft = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
                return (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <Link href={`/superadmin/tenants/${t.id}`} className="text-offwhite hover:text-offwhite/70 transition-colors truncate">
                      {name}
                    </Link>
                    <span className="text-gold text-xs shrink-0 ml-4">{daysLeft}d left</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent signups */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-offwhite">Recent signups (last 30 days)</p>
          <Link href="/superadmin/tenants" className="text-xs text-offwhite/40 hover:text-offwhite/70 transition-colors">
            See all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <Th>Restaurant</Th>
              <Th>Slug</Th>
              <Th>Status</Th>
              <Th>Signed up</Th>
            </tr>
          </thead>
          <tbody>
            {(recentSignups ?? []).map((t: any) => (
              <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <Td>
                  <Link href={`/superadmin/tenants/${t.id}`} className="text-offwhite hover:text-offwhite/70 transition-colors font-medium">
                    {t.tenant_settings?.[0]?.name || t.slug}
                  </Link>
                </Td>
                <Td><span className="text-offwhite/40 font-mono text-xs">{t.slug}</span></Td>
                <Td><StatusBadge status={t.status} /></Td>
                <Td><span className="text-offwhite/40">{new Date(t.created_at).toLocaleDateString()}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent: 'sage' | 'gold' | 'red' }) {
  const color = accent === 'sage' ? 'text-sage' : accent === 'gold' ? 'text-gold' : 'text-red-400'
  return (
    <div className="rounded-2xl border border-white/[0.07] p-6 space-y-1">
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{label}</p>
      <p className={`font-satoshi font-bold text-3xl ${color}`}>{value}</p>
      <p className="text-xs text-offwhite/30">{sub}</p>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-offwhite/50">{label}</span>
      <span className="text-offwhite font-medium">{value}</span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-6 py-3">{children}</td>
}

export function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:   'bg-sage/15 text-sage border-sage/30',
    trial:    'bg-gold/12 text-gold border-gold/25',
    inactive: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg[status] ?? cfg.inactive}`}>
      {status}
    </span>
  )
}
