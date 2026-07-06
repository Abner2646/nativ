'use client'
import { useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Guest } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface GuestWithTags extends Guest {
  guest_tags?: { id: string; tag: string }[]
}

interface Props {
  initialGuests: GuestWithTags[]
  slug: string
  total: number
}

const inputCls = 'bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold'

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
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

export function GuestsClient({ initialGuests, slug, total: initialTotal }: Props) {
  const [guests, setGuests] = useState<GuestWithTags[]>(initialGuests)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const fetchGuests = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const token = await getToken()
      const url = q
        ? `/api/admin?resource=guests&search=${encodeURIComponent(q)}&tenant=${slug}`
        : `/api/admin?resource=guests&tenant=${slug}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setGuests(data.guests || [])
      setTotal(data.total || 0)
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

  return (
    <div>
      {/* ── Search bar ── */}
      <div className="flex items-center gap-3 mb-6">
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
        <div className="p-12 text-center rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm text-offwhite/35">{search ? 'No guests match your search' : 'No guests yet'}</p>
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="md:hidden space-y-2">
            {guests.map(guest => {
              const isOpen = expandedId === guest.id
              const tags = guest.guest_tags || []
              return (
                <div key={guest.id} className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>

                  {/* Card main row — tappable */}
                  <button
                    className="w-full text-left px-4 pt-4 pb-3"
                    onClick={() => toggle(guest.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-offwhite leading-snug">{guest.name}</p>
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

                    <p className="text-xs text-offwhite/45 mt-1">{guest.email}</p>
                    {guest.phone && <p className="text-xs text-offwhite/30 mt-0.5">{guest.phone}</p>}

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
                      {guest.last_visit_at && (
                        <span className="text-[11px] text-offwhite/30">Last: {fmtDate(guest.last_visit_at)}</span>
                      )}
                      {guest.birthday && (
                        <span className="text-[11px] text-offwhite/30">🎂 {guest.birthday.slice(5)}</span>
                      )}
                    </div>

                    {/* Tags preview (collapsed) */}
                    {!isOpen && tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2.5">
                        {tags.map(t => (
                          <span key={t.tag} className="text-[11px] px-2 py-0.5 rounded-full text-offwhite/40"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            {t.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Notes */}
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
                                className="text-xs font-semibold text-sage px-3 py-1.5 rounded-lg transition-colors"
                                style={{ backgroundColor: 'rgba(134,187,167,0.12)', border: '1px solid rgba(134,187,167,0.25)' }}>
                                Save
                              </button>
                              <button onClick={() => setEditingNotes(null)}
                                className="text-xs text-offwhite/30 hover:text-offwhite transition-colors px-3 py-1.5">
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

                      {/* Tags */}
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

          {/* ── Desktop table ── */}
          <div className="hidden md:block rounded-2xl overflow-hidden" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Guest', 'Contact', 'Visits', 'Last visit', 'Birthday', 'Tags', ''].map(h => (
                    <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-4 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map(guest => (
                  <>
                    <tr key={guest.id} className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)')}
                      onMouseOut={e  => (e.currentTarget.style.backgroundColor = '')}
                      onClick={() => toggle(guest.id)}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-offwhite">{guest.name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-offwhite/50">{guest.email}</p>
                        {guest.phone && <p className="text-xs text-offwhite/35">{guest.phone}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm text-offwhite/60 tabular-nums">{guest.visit_count}</td>
                      <td className="px-5 py-4 text-sm text-offwhite/50">{fmtDate(guest.last_visit_at)}</td>
                      <td className="px-5 py-4 text-sm text-offwhite/50">{guest.birthday ? guest.birthday.slice(5) : '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {(guest.guest_tags || []).map(t => (
                            <span key={t.tag} className="text-xs px-2 py-0.5 rounded-full text-offwhite/50"
                              style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                              {t.tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-offwhite/25">{expandedId === guest.id ? '▲' : '▼'}</td>
                    </tr>

                    {expandedId === guest.id && (
                      <tr key={`${guest.id}-exp`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex gap-8">
                            <div className="flex-1">
                              <p className={labelCls}>Notes</p>
                              {editingNotes?.id === guest.id ? (
                                <div className="flex gap-2">
                                  <textarea value={editingNotes.notes} rows={2}
                                    onChange={e => setEditingNotes({ id: guest.id, notes: e.target.value })}
                                    className="flex-1 text-sm text-offwhite rounded-lg px-3 py-2 focus:outline-none resize-none"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }} />
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => saveNotes(guest.id, editingNotes.notes)}
                                      className="text-xs text-sage hover:text-sage/80 transition-colors">Save</button>
                                    <button onClick={() => setEditingNotes(null)}
                                      className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <p className="text-sm text-offwhite/50 flex-1">{guest.notes || 'No notes'}</p>
                                  <button onClick={e => { e.stopPropagation(); setEditingNotes({ id: guest.id, notes: guest.notes || '' }) }}
                                    className="text-xs text-offwhite/25 hover:text-offwhite transition-colors">Edit</button>
                                </div>
                              )}
                            </div>
                            <div className="w-64">
                              <p className={labelCls}>Tags</p>
                              <TagPills tags={guest.guest_tags || []} guestId={guest.id} onRemove={removeTag} />
                              <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                                <AddTagInput guestId={guest.id} onAdd={addTag} />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
