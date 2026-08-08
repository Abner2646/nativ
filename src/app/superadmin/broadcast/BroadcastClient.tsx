'use client'
import { useState, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

type Target = 'all' | 'active' | 'trial'

interface Recipient {
  email: string
  name?: string
}

export function BroadcastClient() {
  const [target, setTarget]     = useState<Target>('active')
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending]   = useState(false)
  const [result, setResult]     = useState<{ sent: number; total: number; errors: string[] } | null>(null)
  const [error, setError]       = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setLoadingPreview(true)
    setResult(null)
    getToken().then(token =>
      fetch(`/api/superadmin/broadcast?target=${target}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then(r => r.json())
     .then(d => setRecipients(d.recipients ?? []))
     .finally(() => setLoadingPreview(false))
  }, [target])

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required.')
      return
    }
    if (!confirmed) {
      setError('Check the confirmation box before sending.')
      return
    }
    setSending(true)
    setError('')
    setResult(null)
    const token = await getToken()
    const res = await fetch('/api/superadmin/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, target }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { setError(data.error || 'Failed to send'); return }
    setResult({ sent: data.sent, total: data.total, errors: data.errors ?? [] })
    setConfirmed(false)
  }

  const TARGET_LABELS: Record<Target, string> = {
    all:    'All paying + trial tenants',
    active: 'Active (paying) tenants only',
    trial:  'Trial tenants only',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compose */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/[0.07] p-6 space-y-5">
          <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">Compose</p>

          {/* Target */}
          <div className="space-y-1.5">
            <label className="text-xs text-offwhite/40">Audience</label>
            <div className="flex gap-2 flex-wrap">
              {(['active', 'trial', 'all'] as Target[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    target === t
                      ? 'bg-sage/20 text-sage border-sage/40'
                      : 'bg-white/[0.04] text-offwhite/40 border-white/[0.08] hover:text-offwhite/70'
                  }`}
                >
                  {TARGET_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs text-offwhite/40">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="New feature: floor plan improvements"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-offwhite placeholder:text-offwhite/20 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs text-offwhite/40">Body (HTML allowed)</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              placeholder="<p>Hi,</p><p>We just shipped...</p>"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-offwhite placeholder:text-offwhite/20 focus:outline-none focus:border-white/20 font-mono resize-none"
            />
          </div>

          {/* Confirm + Send */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="rounded border-white/20 bg-white/[0.04] accent-sage"
              />
              <span className="text-xs text-offwhite/50">
                I confirm I want to send this to {loadingPreview ? '…' : recipients.length} recipients
              </span>
            </label>

            <button
              onClick={send}
              disabled={sending || !confirmed}
              className="w-full h-10 rounded-lg bg-sage/20 text-sage border border-sage/30 text-sm font-semibold hover:bg-sage/30 transition-all disabled:opacity-40"
            >
              {sending ? 'Sending…' : `Send to ${loadingPreview ? '…' : recipients.length} recipients`}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {result && (
            <div className={`rounded-lg p-4 text-sm ${result.errors.length > 0 ? 'bg-gold/10 border border-gold/20' : 'bg-sage/10 border border-sage/20'}`}>
              <p className={result.errors.length > 0 ? 'text-gold font-semibold' : 'text-sage font-semibold'}>
                Sent {result.sent} / {result.total}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.errors.map((e, i) => <li key={i} className="text-xs text-offwhite/50">{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recipients preview */}
      <div className="rounded-2xl border border-white/[0.07] p-6 space-y-4">
        <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">
          Recipients preview — {loadingPreview ? '…' : recipients.length}
        </p>
        {loadingPreview ? (
          <p className="text-sm text-offwhite/30">Loading…</p>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-offwhite/30">No recipients for this audience.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {recipients.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-offwhite/70">{r.name || '—'}</span>
                <span className="text-offwhite/40 text-xs font-mono">{r.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
