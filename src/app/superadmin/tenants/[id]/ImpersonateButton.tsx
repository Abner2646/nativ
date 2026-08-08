'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  tenantId: string
  tenantName: string
}

export function ImpersonateButton({ tenantId, tenantName }: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const impersonate = async () => {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/superadmin/impersonate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, tenantName }),
    })
    const data = await res.json()
    setLoading(false)
    setConfirmed(false)
    if (!res.ok) { setError(data.error || 'Failed to generate link'); return }
    window.open(data.link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={impersonate}
        disabled={loading}
        className={`h-8 px-4 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${
          confirmed
            ? 'bg-red-400/15 text-red-400 border-red-400/30 hover:bg-red-400/25'
            : 'bg-white/[0.06] text-offwhite/60 border-white/[0.10] hover:bg-white/[0.10]'
        }`}
      >
        {loading ? '…' : confirmed ? 'Click again to confirm' : 'Impersonate tenant'}
      </button>
      {confirmed && (
        <p className="text-xs text-offwhite/30">
          This will open a login link for the tenant admin in a new tab. Logged in audit.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
