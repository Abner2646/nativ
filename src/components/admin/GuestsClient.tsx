'use client'
import { useState, useCallback, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Guest } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface GuestWithTags extends Guest {
  guest_tags?: { id: string; tag: string }[]
}

interface HistoryItem {
  id: string; date: string; time: string; party_size: number; status: string
  occasion: string | null; seating_area: { name: string } | null
}

interface Props {
  initialGuests: GuestWithTags[]
  slug: string
  total: number
}

const inputCls = 'bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold'
const card = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: 'rgba(201,169,110,0.18)', color: '#C9A96E' },
  { bg: 'rgba(111,143,123,0.18)', color: '#86BBA7' },
  { bg: 'rgba(130,150,200,0.18)', color: '#8296C8' },
  { bg: 'rgba(200,130,130,0.18)', color: '#C88282' },
  { bg: 'rgba(160,130,200,0.18)', color: '#A082C8' },
]
function getInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function getAvatarPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const p = getAvatarPalette(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: p.bg, color: p.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, userSelect: 'none',
    }}>
      {getInitials(name)}
    </div>
  )
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}
function fmtHistDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_DOT: Record<string, string> = {
  confirmed: '#86BBA7',
  completed: 'rgba(242,239,233,0.25)',
  cancelled: '#e08585',
}

function TagPills({ tags, guestId, onRemove }: {
  tags: { id: string; tag: string }[]
  guestId: string
  onRemove: (guestId: string, tagId: string, tag: string) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tags.map(t => (
        <span key={t.tag}
          className="text-xs px-2 py-0.5 rounded-full text-offwhite/50 flex items-center gap-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
          {t.tag}
          <button
            onClick={e => { e.stopPropagation(); onRemove(guestId, t.id, t.tag) }}
            className="text-offwhite/25 hover:text-red-400 transition-colors leading-none">
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

function AddTagInput({ guestId, onAdd }: { guestId: string; onAdd: (guestId: string, tag: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(guestId, val.trim()); setVal('') } }}
        placeholder="Add tag…"
        className="flex-1 text-xs text-offwhite rounded-lg px-2.5 py-1.5 focus:outline-none placeholder:text-offwhite/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
      />
      <button
        onClick={() => { if (val.trim()) { onAdd(guestId, val.trim()); setVal('') } }}
        className="text-xs text-offwhite/40 hover:text-offwhite px-2.5 rounded-lg transition-colors"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        Add
      </button>
    </div>
  )
}

// ── Compact list row (left panel) ─────────────────────────────────────────────
function CompactRow({ guest, selected, onClick }: {
  guest: GuestWithTags; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-colors"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderLeft: selected ? '2px solid #C9A96E' : '2px solid transparent',
        backgroundColor: selected ? 'rgba(255,255,255,0.05)' : undefined,
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)' }}
      onMouseOut={e  => { if (!selected) e.currentTarget.style.backgroundColor = '' }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={guest.name} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-offwhite truncate">{guest.name}</p>
          <p className="text-xs text-offwhite/35 truncate mt-0.5">{guest.email}</p>
        </div>
        {guest.visit_count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
            {guest.visit_count}×
          </span>
        )}
      </div>
    </button>
  )
}

// ── Detail panel (right side) ─────────────────────────────────────────────────
function DetailPanel({ guest, editingNotes, history, loadingHistory, onEditNotes, onSaveNotes, onCancelNotes, onAddTag, onRemoveTag, onMerge }: {
  guest: GuestWithTags
  editingNotes: { id: string; notes: string } | null
  history: HistoryItem[]
  loadingHistory: boolean
  onEditNotes: (id: string, notes: string) => void
  onSaveNotes: (id: string, notes: string) => void
  onCancelNotes: () => void
  onAddTag: (guestId: string, tag: string) => void
  onRemoveTag: (guestId: string, tagId: string, tag: string) => void
  onMerge: () => void
}) {
  const tags = guest.guest_tags || []
  const divider = { borderTop: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="p-6">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4 mb-5">
        <Avatar name={guest.name} size={48} />
        <div className="min-w-0">
          <h2 className="font-satoshi font-bold text-[20px] text-offwhite leading-tight truncate">{guest.name}</h2>
          <p className="text-sm text-offwhite/45 mt-0.5">{guest.email}</p>
          {guest.phone && <p className="text-sm text-offwhite/30 mt-0.5">{guest.phone}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pb-5 mb-5" style={divider}>
        <div>
          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Visits</p>
          <p className="text-2xl font-bold font-mono text-offwhite">{guest.visit_count}</p>
        </div>
        <div>
          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Last visit</p>
          <p className="text-sm text-offwhite/70">{fmtDate(guest.last_visit_at)}</p>
        </div>
        <div>
          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Birthday</p>
          <p className="text-sm text-offwhite/70">{guest.birthday ? guest.birthday.slice(5) : '—'}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="pb-5 mb-5" style={divider}>
        <div className="flex items-center justify-between mb-2">
          <p className={labelCls}>Notes</p>
          {editingNotes?.id !== guest.id && (
            <button
              onClick={() => onEditNotes(guest.id, guest.notes || '')}
              className="text-xs text-offwhite/25 hover:text-offwhite transition-colors">
              Edit
            </button>
          )}
        </div>
        {editingNotes?.id === guest.id ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editingNotes.notes} rows={3}
              onChange={e => onEditNotes(guest.id, e.target.value)}
              className="w-full text-sm text-offwhite rounded-xl px-3 py-2 focus:outline-none resize-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            />
            <div className="flex gap-2">
              <button onClick={() => onSaveNotes(guest.id, editingNotes.notes)}
                className="text-xs font-semibold text-sage px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(134,187,167,0.12)', border: '1px solid rgba(134,187,167,0.25)' }}>
                Save
              </button>
              <button onClick={onCancelNotes}
                className="text-xs text-offwhite/30 hover:text-offwhite transition-colors px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-offwhite/50">{guest.notes || 'No notes'}</p>
        )}
      </div>

      {/* Tags */}
      <div className="pb-5 mb-5" style={divider}>
        <p className={labelCls}>Tags</p>
        {tags.length > 0
          ? <TagPills tags={tags} guestId={guest.id} onRemove={onRemoveTag} />
          : <p className="text-xs text-offwhite/25 mb-2">No tags yet</p>
        }
        <AddTagInput guestId={guest.id} onAdd={onAddTag} />
      </div>

      {/* Reservation history */}
      <div className="pb-5 mb-5" style={divider}>
        <p className={labelCls}>Recent reservations</p>
        {loadingHistory ? (
          <p className="text-xs text-offwhite/25">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-offwhite/25">No reservations found</p>
        ) : (
          <div className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3">
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_DOT[h.status] || 'rgba(242,239,233,0.25)', flexShrink: 0, display: 'block' }} />
                <span className="text-xs text-offwhite/60 font-mono w-[44px] shrink-0">{h.time.slice(0,5)}</span>
                <span className="text-xs text-offwhite/50 truncate flex-1">{fmtHistDate(h.date)}</span>
                <span className="text-xs text-offwhite/35 shrink-0">{h.party_size}p</span>
                {h.occasion && <span className="text-xs text-offwhite/30 shrink-0 hidden lg:block">{h.occasion}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Merge action */}
      <button
        onClick={onMerge}
        className="text-xs text-offwhite/25 hover:text-offwhite/50 transition-colors"
      >
        Merge with another guest…
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function GuestsClient({ initialGuests, slug, total: initialTotal }: Props) {
  const [guests, setGuests]         = useState<GuestWithTags[]>(initialGuests)
  const [total, setTotal]           = useState(initialTotal)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialGuests.length > 0 ? initialGuests[0].id : null
  )
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null)
  const [guestHistory, setGuestHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Merge modal state
  const [showMerge, setShowMerge]         = useState(false)
  const [mergeSearch, setMergeSearch]     = useState('')
  const [mergeResults, setMergeResults]   = useState<GuestWithTags[]>([])
  const [mergeTarget, setMergeTarget]     = useState<GuestWithTags | null>(null)
  const [mergeSaving, setMergeSaving]     = useState(false)
  const [mergeError, setMergeError]       = useState('')

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  // Fetch reservation history when selection changes
  useEffect(() => {
    if (!selectedId) { setGuestHistory([]); return }
    setLoadingHistory(true)
    getToken().then(token =>
      fetch(`/api/admin?resource=guest-history&guest_id=${selectedId}&tenant=${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then(r => r.json()).then(d => {
      setGuestHistory(d.reservations || [])
    }).finally(() => setLoadingHistory(false))
  }, [selectedId, slug])

  const fetchGuests = useCallback(async (q: string) => {
    setLoading(true)
    setSelectedId(null)
    setExpandedId(null)
    try {
      const token = await getToken()
      const url = q
        ? `/api/admin?resource=guests&search=${encodeURIComponent(q)}&tenant=${slug}`
        : `/api/admin?resource=guests&tenant=${slug}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const list: GuestWithTags[] = data.guests || []
      setGuests(list)
      setTotal(data.total || 0)
      if (list.length > 0) setSelectedId(list[0].id)
    } finally { setLoading(false) }
  }, [slug])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (q.length === 0 || q.length >= 2) fetchGuests(q)
  }

  const addTag = async (guestId: string, tag: string) => {
    if (!tag.trim()) return
    const res = await adminFetch(`resource=guest-tag&guest_id=${guestId}`, {
      method: 'POST', body: JSON.stringify({ tag: tag.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setGuests(prev => prev.map(g =>
        g.id === guestId ? { ...g, guest_tags: [...(g.guest_tags || []), { id: data.tag?.id || '', tag: tag.trim() }] } : g
      ))
    }
  }

  const removeTag = async (guestId: string, tagId: string, tagName: string) => {
    const res = await adminFetch(`resource=guest-tag&id=${tagId}`, { method: 'DELETE' })
    if (res.ok) {
      setGuests(prev => prev.map(g =>
        g.id === guestId ? { ...g, guest_tags: (g.guest_tags || []).filter(t => t.tag !== tagName) } : g
      ))
    }
  }

  const saveNotes = async (guestId: string, notes: string) => {
    const res = await adminFetch(`resource=guests&id=${guestId}`, { method: 'PATCH', body: JSON.stringify({ notes }) })
    if (res.ok) { setGuests(prev => prev.map(g => g.id === guestId ? { ...g, notes } : g)); setEditingNotes(null) }
  }

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
    setEditingNotes(null)
  }

  // Merge helpers
  const searchMergeTargets = async (q: string) => {
    if (!q.trim() || q.length < 2) { setMergeResults([]); return }
    const token = await getToken()
    const res = await fetch(`/api/admin?resource=guests&search=${encodeURIComponent(q)}&tenant=${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    // Exclude the currently selected guest
    setMergeResults((data.guests || []).filter((g: GuestWithTags) => g.id !== selectedId))
  }

  const confirmMerge = async () => {
    if (!mergeTarget || !selectedId) return
    setMergeSaving(true)
    setMergeError('')
    const res = await adminFetch('resource=merge-guests', {
      method: 'POST',
      body: JSON.stringify({ primary_id: selectedId, duplicate_id: mergeTarget.id }),
    })
    if (!res.ok) {
      const d = await res.json()
      setMergeError(d.error || 'Merge failed')
      setMergeSaving(false)
      return
    }
    // Update UI: remove duplicate from list, refresh history
    setGuests(prev => prev.filter(g => g.id !== mergeTarget.id))
    setShowMerge(false)
    setMergeTarget(null)
    setMergeSearch('')
    setMergeResults([])
    setMergeSaving(false)
    // Refresh history for the kept guest
    setGuestHistory([])
  }

  const selectedGuest = guests.find(g => g.id === selectedId) ?? null

  return (
    <div>
      {/* ── Search bar ── */}
      <div className="flex items-center gap-3 mb-5">
        <input
          value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className={`flex-1 ${inputCls}`}
        />
        {loading
          ? <span className="text-xs text-offwhite/30 shrink-0">Loading…</span>
          : <span className="text-xs text-offwhite/25 shrink-0">{total} guests</span>
        }
      </div>

      {guests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={card}>
          <p className="text-sm text-offwhite/35">{search ? 'No guests match your search' : 'No guests yet'}</p>
        </div>
      ) : (
        <>
          {/* ── Mobile cards (< md) ── */}
          <div className="md:hidden space-y-2">
            {guests.map(guest => {
              const isOpen = expandedId === guest.id
              const tags = guest.guest_tags || []
              return (
                <div key={guest.id} className="rounded-2xl overflow-hidden" style={card}>
                  <button className="w-full text-left px-4 pt-4 pb-3" onClick={() => toggle(guest.id)}>
                    <div className="flex items-center gap-3">
                      <Avatar name={guest.name} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-offwhite leading-snug truncate">{guest.name}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {guest.visit_count > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                                {guest.visit_count}×
                              </span>
                            )}
                            <span className="text-offwhite/20 text-xs">{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <p className="text-xs text-offwhite/45 mt-0.5">{guest.email}</p>
                      </div>
                    </div>
                    {!isOpen && tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2.5 ml-[48px]">
                        {tags.map(t => (
                          <span key={t.tag} className="text-[11px] px-2 py-0.5 rounded-full text-offwhite/40"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            {t.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                        <div>
                          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Visits</p>
                          <p className="text-lg font-bold font-mono text-offwhite">{guest.visit_count}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Last visit</p>
                          <p className="text-xs text-offwhite/60">{fmtDate(guest.last_visit_at)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Birthday</p>
                          <p className="text-xs text-offwhite/60">{guest.birthday ? guest.birthday.slice(5) : '—'}</p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className={labelCls}>Notes</p>
                        {editingNotes?.id === guest.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingNotes.notes} rows={3}
                              onChange={e => setEditingNotes({ id: guest.id, notes: e.target.value })}
                              className="w-full text-sm text-offwhite rounded-xl px-3 py-2 focus:outline-none resize-none"
                              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveNotes(guest.id, editingNotes.notes)}
                                className="text-xs font-semibold text-sage px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: 'rgba(134,187,167,0.12)', border: '1px solid rgba(134,187,167,0.25)' }}>
                                Save
                              </button>
                              <button onClick={() => setEditingNotes(null)}
                                className="text-xs text-offwhite/30 px-3 py-1.5">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-offwhite/50">{guest.notes || 'No notes'}</p>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingNotes({ id: guest.id, notes: guest.notes || '' }) }}
                              className="text-xs text-offwhite/25 hover:text-offwhite transition-colors shrink-0">
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={labelCls}>Tags</p>
                        <TagPills tags={tags} guestId={guest.id} onRemove={removeTag} />
                        <AddTagInput guestId={guest.id} onAdd={addTag} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Tablet / Desktop split view (≥ md) ── */}
          <div className="hidden md:flex gap-4 lg:gap-5 items-start">
            {/* Left: compact list */}
            <div className="w-[270px] lg:w-[290px] shrink-0 rounded-2xl overflow-hidden" style={card}>
              {guests.map(g => (
                <CompactRow
                  key={g.id}
                  guest={g}
                  selected={selectedId === g.id}
                  onClick={() => { setSelectedId(g.id); setEditingNotes(null) }}
                />
              ))}
            </div>

            {/* Right: detail panel */}
            <div className="flex-1 sticky top-4 rounded-2xl min-h-[180px]" style={card}>
              {selectedGuest ? (
                <DetailPanel
                  guest={selectedGuest}
                  editingNotes={editingNotes}
                  history={guestHistory}
                  loadingHistory={loadingHistory}
                  onEditNotes={(id, notes) => setEditingNotes({ id, notes })}
                  onSaveNotes={saveNotes}
                  onCancelNotes={() => setEditingNotes(null)}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  onMerge={() => { setShowMerge(true); setMergeSearch(''); setMergeResults([]); setMergeTarget(null); setMergeError('') }}
                />
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm text-offwhite/30">Select a guest to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Merge modal ── */}
      {showMerge && selectedGuest && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6" style={card}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-satoshi font-bold text-[17px] text-offwhite">Merge guest</h2>
              <button onClick={() => setShowMerge(false)} className="text-offwhite/30 hover:text-offwhite text-xl leading-none">×</button>
            </div>

            {!mergeTarget ? (
              <>
                <p className="text-sm text-offwhite/50 mb-4">
                  Select the <strong className="text-offwhite/70">duplicate</strong> to remove. All their reservations will move to <strong className="text-offwhite/70">{selectedGuest.name}</strong>.
                </p>
                <input
                  value={mergeSearch}
                  onChange={e => { setMergeSearch(e.target.value); searchMergeTargets(e.target.value) }}
                  placeholder="Search for duplicate guest…"
                  className={`w-full mb-3 ${inputCls}`}
                />
                {mergeResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {mergeResults.map(g => (
                      <button key={g.id} onClick={() => setMergeTarget(g)}
                        className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/[0.04] transition-colors">
                        <Avatar name={g.name} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm text-offwhite truncate">{g.name}</p>
                          <p className="text-xs text-offwhite/35 truncate">{g.email}</p>
                        </div>
                        <span className="text-xs text-offwhite/30 shrink-0">{g.visit_count}×</span>
                      </button>
                    ))}
                  </div>
                )}
                {mergeSearch.length >= 2 && mergeResults.length === 0 && (
                  <p className="text-xs text-offwhite/30 text-center py-4">No guests found</p>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: 'rgba(224,133,133,0.08)', border: '1px solid rgba(224,133,133,0.20)' }}>
                  <p className="text-sm text-offwhite/70">
                    <strong className="text-red-400/80">{mergeTarget.name}</strong> will be deleted and their reservations transferred to <strong className="text-offwhite">{selectedGuest.name}</strong>. This cannot be undone.
                  </p>
                </div>
                {mergeError && <p className="text-xs text-red-400 mb-3">{mergeError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={confirmMerge}
                    disabled={mergeSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-midnight disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: '#F2EFE9' }}>
                    {mergeSaving ? 'Merging…' : 'Confirm merge'}
                  </button>
                  <button onClick={() => setMergeTarget(null)}
                    className="px-4 py-2.5 text-sm text-offwhite/40 hover:text-offwhite transition-colors">
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
