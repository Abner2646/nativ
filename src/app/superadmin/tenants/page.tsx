import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { StatusBadge } from '../page'
import Link from 'next/link'

export default async function SuperadminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  await requireSuperadmin()

  const { filter, q } = await searchParams

  let query = supabaseAdmin
    .from('tenants')
    .select('*, tenant_settings(name), tenant_members(count)')
    .order('created_at', { ascending: false })

  if (filter && filter !== 'all') query = query.eq('status', filter)

  const { data: tenants } = await query

  const filtered = (tenants ?? []).filter((t: any) => {
    if (!q) return true
    const name = (t.tenant_settings?.[0]?.name || '').toLowerCase()
    return name.includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="font-satoshi font-bold text-2xl text-offwhite">Tenants</h1>
          <p className="text-sm text-offwhite/35 mt-1">{filtered.length} restaurants</p>
        </div>
        <form className="sm:ml-auto flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or slug…"
            className="h-9 px-3 rounded-lg bg-white/[0.05] border border-white/[0.10] text-sm text-offwhite placeholder:text-offwhite/25 focus:outline-none focus:border-white/25 w-52"
          />
          <input type="hidden" name="filter" value={filter || 'all'} />
          <button className="h-9 px-4 rounded-lg bg-white/[0.07] text-sm text-offwhite/70 hover:bg-white/[0.12] transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {['all', 'active', 'trial', 'inactive'].map((f) => (
          <Link
            key={f}
            href={`/superadmin/tenants?filter=${f}${q ? `&q=${q}` : ''}`}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
              (filter || 'all') === f
                ? 'bg-white/[0.10] text-offwhite font-semibold'
                : 'text-offwhite/40 hover:text-offwhite hover:bg-white/[0.05]'
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <Th>Restaurant</Th>
              <Th>Slug</Th>
              <Th>Status</Th>
              <Th>Members</Th>
              <Th>Trial ends</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-offwhite/25">No tenants found.</td>
              </tr>
            )}
            {filtered.map((t: any) => {
              const name = t.tenant_settings?.[0]?.name || t.slug
              const memberCount = t.tenant_members?.length ?? '—'
              const trialEnd = t.trial_ends_at ? new Date(t.trial_ends_at) : null
              const daysLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null

              return (
                <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <Td>
                    <Link href={`/superadmin/tenants/${t.id}`} className="text-offwhite hover:text-offwhite/70 font-medium transition-colors">
                      {name}
                    </Link>
                  </Td>
                  <Td><span className="text-offwhite/40 font-mono text-xs">{t.slug}</span></Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td><span className="text-offwhite/50">{memberCount}</span></Td>
                  <Td>
                    {trialEnd ? (
                      <span className={daysLeft !== null && daysLeft <= 3 ? 'text-red-400' : daysLeft !== null && daysLeft <= 7 ? 'text-gold' : 'text-offwhite/40'}>
                        {daysLeft !== null && daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'today' : 'expired'}{' '}
                        <span className="text-offwhite/25 text-xs">({trialEnd.toLocaleDateString()})</span>
                      </span>
                    ) : (
                      <span className="text-offwhite/20">—</span>
                    )}
                  </Td>
                  <Td><span className="text-offwhite/40">{new Date(t.created_at).toLocaleDateString()}</span></Td>
                  <Td>
                    <Link
                      href={`/restaurant/${t.slug}`}
                      className="text-xs text-offwhite/30 hover:text-offwhite/70 transition-colors"
                      target="_blank"
                    >
                      Open ↗
                    </Link>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-6 py-3">{children}</td>
}
