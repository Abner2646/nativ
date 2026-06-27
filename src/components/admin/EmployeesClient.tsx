'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Employee {
  id: string
  user_id: string
  role: 'admin' | 'employee'
  created_at: string
  profiles: { id: string; email: string; full_name: string | null } | null
}

interface Invite {
  id: string
  email: string
  expires_at: string
  created_at: string
}

interface Props {
  initialEmployees: Employee[]
  initialInvites: Invite[]
  currentUserId: string
  slug: string
}

export function EmployeesClient({ initialEmployees, initialInvites, currentUserId, slug }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [invites, setInvites] = useState<Invite[]>(initialInvites)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    setInviteSent(false)
    const res = await adminFetch('resource=employees', {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    setInviting(false)
    if (res.ok) {
      setInviteSent(true)
      setInviteEmail('')
      setTimeout(() => setInviteSent(false), 3000)
    } else {
      const data = await res.json()
      setInviteError(data.error || 'Failed to send invite')
    }
  }

  const removeEmployee = async (userId: string) => {
    if (!confirm('Remove this employee?')) return
    setRemoving(userId)
    const res = await adminFetch(`resource=employees&id=${userId}`, { method: 'DELETE' })
    setRemoving(null)
    if (res.ok) setEmployees(prev => prev.filter(e => e.user_id !== userId))
  }

  const ROLE_COLORS = {
    admin: 'bg-blue-900/40 text-blue-400',
    employee: 'bg-gray-800 text-gray-400',
  }

  return (
    <div className="max-w-2xl space-y-10">
      {/* Current team */}
      <section>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
          Team members
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {employees.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No team members yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Member', 'Role', 'Since', ''].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(e => {
                  const profile = e.profiles
                  const isSelf = e.user_id === currentUserId
                  return (
                    <tr key={e.id} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-white">{profile?.full_name || '—'}</p>
                        <p className="text-xs text-gray-500">{profile?.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[e.role]}`}>
                          {e.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => removeEmployee(e.user_id)}
                            disabled={removing === e.user_id}
                            className="text-xs text-gray-600 hover:text-red-400 transition disabled:opacity-40"
                          >
                            {removing === e.user_id ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                        {isSelf && <span className="text-xs text-gray-700">You</span>}
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
        <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
          Invite employee
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          They'll receive an email with a link to join your restaurant on Nativ.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="employee@restaurant.com"
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
          />
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail}
            className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
          >
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {inviteError && <p className="text-red-400 text-sm mt-2">{inviteError}</p>}
        {inviteSent && <p className="text-green-400 text-sm mt-2">Invite sent!</p>}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pb-3 border-b border-gray-800 mb-4">
            Pending invites
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50 last:border-0">
                <div>
                  <p className="text-sm text-white">{inv.email}</p>
                  <p className="text-xs text-gray-500">
                    Expires {new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2.5 py-1 rounded-full">Pending</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
