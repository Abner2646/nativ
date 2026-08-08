import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export default async function SuperadminUsagePage() {
  await requireSuperadmin()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: tenants },
    { data: reservations30d },
    { data: reservationsTotal },
    { data: guestCounts },
    { data: cancelledReservations },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('id, slug, status, tenant_settings(name)')
      .in('status', ['active', 'trial']),
    supabaseAdmin
      .from('reservations')
      .select('tenant_id')
      .gte('created_at', thirtyDaysAgo),
    supabaseAdmin
      .from('reservations')
      .select('tenant_id'),
    supabaseAdmin
      .from('guests')
      .select('tenant_id'),
    supabaseAdmin
      .from('reservations')
      .select('tenant_id')
      .eq('status', 'cancelled'),
  ])

  // Aggregate per tenant
  const countByTenant = (rows: any[] | null, field = 'tenant_id') => {
    const map: Record<string, number> = {}
    for (const r of rows ?? []) map[r[field]] = (map[r[field]] ?? 0) + 1
    return map
  }

  const res30dMap   = countByTenant(reservations30d)
  const resTotalMap = countByTenant(reservationsTotal)
  const guestMap    = countByTenant(guestCounts)
  const cancelMap   = countByTenant(cancelledReservations)

  const rows = (tenants ?? []).map((t: any) => {
    const id = t.id
    const total = resTotalMap[id] ?? 0
    const cancelled = cancelMap[id] ?? 0
    return {
      id,
      slug: t.slug,
      name: t.tenant_settings?.[0]?.name || t.slug,
      status: t.status,
      res30d: res30dMap[id] ?? 0,
      resTotal: total,
      guests: guestMap[id] ?? 0,
      cancelRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    }
  }).sort((a, b) => b.res30d - a.res30d)

  const totalRes30d = (reservations30d ?? []).length
  const totalGuests = (guestCounts ?? []).length
  const avgCancelRate = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.cancelRate, 0) / rows.length)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Usage & Activity</h1>
        <p className="text-sm text-offwhite/35 mt-1">Reservation volume and engagement per tenant.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Reservations (30d)" value={totalRes30d.toLocaleString()} sub="platform-wide" />
        <StatCard label="Total guests" value={totalGuests.toLocaleString()} sub="all tenants" />
        <StatCard label="Active tenants" value={(tenants ?? []).length} sub="incl. trial" />
        <StatCard label="Avg cancel rate" value={`${avgCancelRate}%`} sub="across tenants" />
      </div>

      {/* Per-tenant table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-offwhite">All tenants — sorted by 30d activity</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-offwhite/30">No active tenants found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <Th>Restaurant</Th>
                <Th>Status</Th>
                <Th>Reservations (30d)</Th>
                <Th>Total reservations</Th>
                <Th>Guests</Th>
                <Th>Cancel rate</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <Td>
                    <Link href={`/superadmin/tenants/${r.id}`} className="text-offwhite hover:text-offwhite/70 font-medium">
                      {r.name}
                    </Link>
                  </Td>
                  <Td>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      r.status === 'active' ? 'bg-sage/15 text-sage border-sage/30' : 'bg-gold/12 text-gold border-gold/25'
                    }`}>
                      {r.status}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-sage/60 rounded-full"
                          style={{ width: `${Math.min((r.res30d / Math.max(...rows.map(x => x.res30d), 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-offwhite/70">{r.res30d}</span>
                    </div>
                  </Td>
                  <Td><span className="text-offwhite/50">{r.resTotal}</span></Td>
                  <Td><span className="text-offwhite/50">{r.guests}</span></Td>
                  <Td>
                    <span className={r.cancelRate > 30 ? 'text-red-400' : r.cancelRate > 15 ? 'text-gold' : 'text-offwhite/50'}>
                      {r.cancelRate}%
                    </span>
                  </Td>
                  <Td>
                    <Link href={`/superadmin/tenants/${r.id}`} className="text-xs text-offwhite/30 hover:text-offwhite/70">
                      View →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-6 space-y-1">
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{label}</p>
      <p className="font-satoshi font-bold text-3xl text-offwhite">{value}</p>
      <p className="text-xs text-offwhite/30">{sub}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-6 py-3">{children}</td>
}
