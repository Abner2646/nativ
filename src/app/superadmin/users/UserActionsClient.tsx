'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

export function UserActionsClient({ userId, isSuperadmin: initial }: { userId: string; isSuperadmin: boolean }) {
  const [isSuperadmin, setIsSuperadmin] = useState(initial)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    const token = await getToken()
    const res = await fetch(`/api/superadmin/user?id=${userId}&action=toggle_superadmin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setLoading(false)
    if (res.ok) {
      const data = await res.json()
      setIsSuperadmin(data.is_superadmin)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs text-offwhite/30 hover:text-offwhite/70 transition-colors disabled:opacity-40"
    >
      {loading ? '…' : isSuperadmin ? 'Revoke admin' : 'Make admin'}
    </button>
  )
}
