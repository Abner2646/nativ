import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function SuperadminAuditPage() {
  await requireSuperadmin()

  const { data: logs } = await supabaseAdmin
    .from('superadmin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    activate:            { label: 'Activated',         color: 'text-sage' },
    deactivate:          { label: 'Deactivated',       color: 'text-red-400' },
    start_trial:         { label: 'Started trial',     color: 'text-gold' },
    extend_trial:        { label: 'Extended trial',    color: 'text-gold' },
    impersonate:         { label: 'Impersonated',      color: 'text-red-400' },
    broadcast:           { label: 'Broadcast email',   color: 'text-offwhite/60' },
    update_notes:        { label: 'Updated notes',     color: 'text-offwhite/60' },
    toggle_feature_flag: { label: 'Toggled flag',      color: 'text-offwhite/60' },
    toggle_superadmin:   { label: 'Toggled superadmin', color: 'text-red-400' },
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Audit Log</h1>
        <p className="text-sm text-offwhite/35 mt-1">Last 200 superadmin actions.</p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        {!logs || logs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-offwhite/30">No audit events recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <Th>When</Th>
                <Th>Admin</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => {
                const cfg = ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-offwhite/50' }
                return (
                  <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <Td>
                      <span className="text-offwhite/40 text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-offwhite/60 text-xs">{log.admin_email}</span>
                    </Td>
                    <Td>
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </Td>
                    <Td>
                      {log.target_name ? (
                        <span className="text-offwhite/70">{log.target_name}</span>
                      ) : (
                        <span className="text-offwhite/25">—</span>
                      )}
                    </Td>
                    <Td>
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <span className="text-offwhite/30 text-xs font-mono">
                          {JSON.stringify(log.metadata)}
                        </span>
                      ) : (
                        <span className="text-offwhite/20">—</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-6 py-3">{children}</td>
}
