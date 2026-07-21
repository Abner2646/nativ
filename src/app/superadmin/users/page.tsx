import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { UserActionsClient } from './UserActionsClient'

export default async function SuperadminUsersPage() {
  await requireSuperadmin()

  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, is_superadmin, created_at')
    .order('created_at', { ascending: false })

  // Cantidad de tenants por usuario (una sola query)
  const { data: memberCounts } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id, tenants(id)')

  const countsByUser: Record<string, number> = {}
  for (const m of memberCounts ?? []) {
    countsByUser[m.user_id] = (countsByUser[m.user_id] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Users</h1>
        <p className="text-sm text-offwhite/35 mt-1">{(users ?? []).length} registered accounts</p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Restaurants</Th>
              <Th>Superadmin</Th>
              <Th>Joined</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <Td>
                  <span className="text-offwhite/80">{u.email}</span>
                </Td>
                <Td><span className="text-offwhite/50">{u.full_name || '—'}</span></Td>
                <Td><span className="text-offwhite/40">{countsByUser[u.id] ?? 0}</span></Td>
                <Td>
                  {u.is_superadmin ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sage/15 text-sage border-sage/30">
                      superadmin
                    </span>
                  ) : (
                    <span className="text-offwhite/20 text-xs">—</span>
                  )}
                </Td>
                <Td><span className="text-offwhite/30 text-xs">{new Date(u.created_at).toLocaleDateString()}</span></Td>
                <Td>
                  <UserActionsClient userId={u.id} isSuperadmin={u.is_superadmin} />
                </Td>
              </tr>
            ))}
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
