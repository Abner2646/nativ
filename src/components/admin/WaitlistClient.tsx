'use client'
import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Plus, Minus, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface WaitlistEntry {
  id: string
  name: string
  phone: string | null
  party_size: number
  quoted_minutes: number | null
  created_at: string
}

interface Props {
  slug: string
  tenantId: string
  initialEntries: WaitlistEntry[]
}

const inputCls = 'w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function WaitBadge({ createdAt, quotedMinutes, now }: { createdAt: string; quotedMinutes: number | null; now: number }) {
  const waited = Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  const over   = quotedMinutes != null && waited > quotedMinutes
  return (
    <span className="text-xs font-mono shrink-0" style={{ color: over ? '#e08585' : 'rgba(242,239,233,0.40)' }}>
      {waited}m{quotedMinutes != null ? ` / ${quotedMinutes}m` : ''}
      {over && <span className="ml-1">⚠</span>}
    </span>
  )
}

export function WaitlistClient({ slug, tenantId, initialEntries }: Props) {
  const [entries, setEntries] = useState<WaitlistEntry[]>(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', party: 2, quote: '' })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const now = useNow()

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const fetchEntries = useCallback(async () => {
    const token = await getToken()
    const res = await fetch(`/api/admin?resource=waitlist&tenant=${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setEntries(data.waitlist || [])
  }, [slug])

  useEffect(() => {
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`nativ-wl-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries', filter: `tenant_id=eq.${tenantId}` },
        () => void fetchEntries()
      ).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [tenantId, fetchEntries])

  const addEntry = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await adminFetch('resource=waitlist', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          party_size: form.party,
          quoted_minutes: form.quote ? parseInt(form.quote) : null,
        }),
      })
      if (res.ok) {
        setForm({ name: '', phone: '', party: 2, quote: '' })
        setShowForm(false)
        void fetchEntries()
      }
    } finally { setSaving(false) }
  }

  const seatEntry = async (id: string) => {
    setBusyId(id)
    try {
      await adminFetch(`resource=waitlist&id=${id}`, { method: 'PATCH' })
      void fetchEntries()
    } finally { setBusyId(null) }
  }

  const removeEntry = async (id: string) => {
    setBusyId(id)
    try {
      await adminFetch(`resource=waitlist&id=${id}`, { method: 'DELETE' })
      void fetchEntries()
    } finally { setBusyId(null) }
  }

  const card: React.CSSProperties = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="max-w-lg space-y-4">

      {/* Add button / form */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        <button
          onClick={() => setShowForm(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-offwhite/60 hover:text-offwhite transition-colors"
        >
          <span className="flex items-center gap-2">
            <Plus size={14} strokeWidth={2} />
            Add to waitlist
          </span>
          {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showForm && (
          <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="pt-4">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
                placeholder="Guest name *"
                autoFocus
                className={inputCls}
              />
            </div>

            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Phone number (optional)"
              className={inputCls}
            />

            <div className="flex gap-3">
              {/* Party size stepper */}
              <div className="flex items-center gap-3 flex-1 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  onClick={() => setForm(f => ({ ...f, party: Math.max(1, f.party - 1) }))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Minus size={11} />
                </button>
                <span className="font-bold text-offwhite text-sm flex-1 text-center">{form.party} {form.party === 1 ? 'person' : 'people'}</span>
                <button
                  onClick={() => setForm(f => ({ ...f, party: Math.min(30, f.party + 1) }))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Plus size={11} />
                </button>
              </div>

              {/* Quoted wait */}
              <input
                value={form.quote}
                onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
                placeholder="Wait (min)"
                type="number" min={1}
                className="w-32 bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20"
              />
            </div>

            <button
              onClick={addEntry}
              disabled={!form.name.trim() || saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-midnight transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#F2EFE9' }}>
              {saving ? 'Adding…' : 'Add to waitlist'}
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <div className="rounded-2xl px-5 py-10 text-center" style={card}>
          <p className="text-sm text-offwhite/30">No one waiting right now.</p>
          <p className="text-xs text-offwhite/20 mt-1">Add a guest when the restaurant is full and they want to wait for a table.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/35">
              Waiting · {entries.length} {entries.length === 1 ? 'party' : 'parties'}
            </p>
          </div>
          {entries.map((w, i) => (
            <div key={w.id}
              className="flex items-center gap-4 px-5 py-4"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>

              {/* Position badge */}
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(242,239,233,0.35)' }}>
                {i + 1}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-offwhite truncate">{w.name}</p>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(242,239,233,0.50)' }}>
                    {w.party_size}p
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <WaitBadge createdAt={w.created_at} quotedMinutes={w.quoted_minutes} now={now} />
                  {w.phone && (
                    <span className="text-xs text-offwhite/25 truncate">{w.phone}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => seatEntry(w.id)}
                  disabled={busyId === w.id}
                  title="Mark as seated"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(111,143,123,0.15)', color: '#86BBA7', border: '1px solid rgba(111,143,123,0.25)' }}>
                  <Check size={11} />
                  Seat
                </button>
                <button
                  onClick={() => removeEntry(w.id)}
                  disabled={busyId === w.id}
                  title="Remove from waitlist"
                  className="p-1.5 text-offwhite/20 hover:text-red-400 transition-colors disabled:opacity-40">
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
