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
  initialNotes: string | null
}

export function TenantNotesClient({ tenantId, tenantName, initialNotes }: Props) {
  const [notes, setNotes]   = useState(initialNotes ?? '')
  const [saved, setSaved]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/superadmin/notes', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, notes, tenantName }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={4}
        placeholder="Internal notes about this tenant (not visible to them)…"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-offwhite placeholder:text-offwhite/20 focus:outline-none focus:border-white/20 resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-8 px-4 rounded-lg text-xs font-semibold bg-white/[0.06] text-offwhite/70 border border-white/[0.08] hover:bg-white/[0.10] transition-all disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save notes'}
        </button>
        {saved && <span className="text-xs text-sage">Saved</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  )
}
