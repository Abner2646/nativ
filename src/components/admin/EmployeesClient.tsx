'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Employee {
  id: string; user_id: string; role: 'admin' | 'employee'; created_at: string
  profiles: { id: string; email: string; full_name: string | null } | null
}
interface Invite { id: string; email: string; expires_at: string; created_at: string }
interface Props { initialEmployees: Employee[]; initialInvites: Invite[]; currentUserId: string; slug: string }

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold pb-3 mb-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {title}
    </h2>
  )
}

const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-gold/12 text-gold border border-gold/25',
  employee: 'text-offwhite/40',
}

export function EmployeesClient({ initialEmployees, initialInvites, currentUserId, slug }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{ userId: string; name: string } | null>(null)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteSent(false)
    const res = await adminFetch('resource=employees', { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim() }) })
    setInviting(false)
    const data = await res.json()
    if (res.ok) {
      setInviteEmail('')
      if (data.emailSent === false) {
        toast.error('Invite saved, but email failed. Verify nativ.business domain in Resend.')
      } else {
        toast.success('Invite sent!')
      }
    } else {
      toast.error(data.error || 'Failed to send invite')
    }
  }

  const doRemoveEmployee = async () => {
    if (!pendingRemove) return
    setRemoving(pendingRemove.userId)
    const res = await adminFetch(`resource=employees&id=${pendingRemove.userId}`, { method: 'DELETE' })
    setRemoving(null)
    if (res.ok) { setEmployees(prev => prev.filter(e => e.user_id !== pendingRemove.userId)); toast.success('Employee removed') }
    else toast.error('Failed to remove employee')
    setPendingRemove(null)
  }

  return (
    <div className="max-w-2xl space-y-10">
      <ConfirmModal
        open={!!pendingRemove}
        title={`Remove ${pendingRemove?.name}?`}
        message="They will lose access to this restaurant immediately."
        confirmLabel="Remove employee"
        loading={!!removing}
        onConfirm={doRemoveEmployee}
        onCancel={() => setPendingRemove(null)}
      />
      {/* Removed inline state - now use toast */}

      {/* Team */}
      <section>
        <SectionHeader title="Team members" />
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          {employees.length === 0 ? (
            <p className="text-sm text-offwhite/35 p-6">No team members yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Member', 'Role', 'Since', ''].map(h => (
                    <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(e => {
                  const profile = e.profiles
                  const isSelf = e.user_id === currentUserId
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-offwhite">{profile?.full_name || '—'}</p>
                        <p className="text-xs text-offwhite/40">{profile?.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_BADGE[e.role]}`}
                          style={e.role === 'employee' ? { backgroundColor: 'rgba(255,255,255,0.05)' } : undefined}>
                          {e.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-offwhite/40">
                        {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => setPendingRemove({ userId: e.user_id, name: profile?.full_name || profile?.email || 'this employee' })}
                            disabled={removing === e.user_id}
                            className="text-xs text-offwhite/25 hover:text-red-400 transition-colors disabled:opacity-40">
                            {removing === e.user_id ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                        {isSelf && <span className="text-xs text-offwhite/20">You</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Invite */}
      <section>
        <SectionHeader title="Invite employee" />
        <p className="text-sm text-offwhite/50 mb-1">They'll receive an email with a link to join your restaurant on Nativ.</p>
        <p className="text-xs text-offwhite/30 mb-4">The person must already have a Nativ account. If they don't, ask them to register at nativ.app/register first.</p>
        <div className="flex gap-3">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="employee@restaurant.com"
            className="flex-1 bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20" />
          <button onClick={sendInvite} disabled={inviting || !inviteEmail}
            className="bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {inviteError && <p className="text-red-400 text-xs mt-2">{inviteError}</p>}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section>
          <SectionHeader title="Pending invites" />
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p className="text-sm text-offwhite">{inv.email}</p>
                  <p className="text-xs text-offwhite/40">
                    Expires {new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/12 text-gold border border-gold/25">Pending</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
