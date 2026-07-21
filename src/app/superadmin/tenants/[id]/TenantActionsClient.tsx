'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  tenantId: string
  currentStatus: string
  trialEndsAt: string | null
}

export function TenantActionsClient({ tenantId, currentStatus, trialEndsAt }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(currentStatus)
  const [trialEnd, setTrialEnd] = useState(trialEndsAt)

  const call = async (action: string, body?: Record<string, unknown>) => {
    setLoading(action)
    setError('')
    const token = await getToken()
    const res = await fetch(`/api/superadmin/tenant?id=${tenantId}&action=${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setError(data.error || 'Action failed'); return }
    if (data.status) setStatus(data.status)
    if (data.trial_ends_at !== undefined) setTrialEnd(data.trial_ends_at)
  }

  return (
    <div className="flex flex-col gap-2 items-start sm:items-end">
      <div className="flex flex-wrap gap-2">
        {status !== 'active' && (
          <ActionButton
            label="Activate"
            color="sage"
            loading={loading === 'activate'}
            onClick={() => call('activate')}
          />
        )}
        {status !== 'inactive' && (
          <ActionButton
            label="Deactivate"
            color="red"
            loading={loading === 'deactivate'}
            onClick={() => call('deactivate')}
          />
        )}
        {status === 'trial' || status === 'inactive' ? (
          <ActionButton
            label="Start trial"
            color="gold"
            loading={loading === 'start_trial'}
            onClick={() => call('start_trial')}
          />
        ) : null}
        <ActionButton
          label="Extend trial +14d"
          color="gold"
          loading={loading === 'extend_trial'}
          onClick={() => call('extend_trial', { days: 14 })}
        />
      </div>
      {trialEnd && (
        <p className="text-xs text-offwhite/30">
          Trial ends: {new Date(trialEnd).toLocaleDateString()}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function ActionButton({
  label, color, loading, onClick,
}: {
  label: string
  color: 'sage' | 'gold' | 'red'
  loading: boolean
  onClick: () => void
}) {
  const styles = {
    sage: 'bg-sage/15 text-sage border-sage/30 hover:bg-sage/25',
    gold: 'bg-gold/12 text-gold border-gold/25 hover:bg-gold/20',
    red:  'bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`h-8 px-4 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${styles[color]}`}
    >
      {loading ? '…' : label}
    </button>
  )
}
