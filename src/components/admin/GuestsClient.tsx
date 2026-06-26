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

export function GuestsClient({ initialGuests, slug, total: initialTotal }: Props) {
  const [guests, setGuests] = useState<GuestWithTags[]>(initialGuests)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newTag, setNewTag] = useState('')
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
    } finally {
      setLoading(false)
    }
  }, [slug])

  const handleSearch = (q: string) => {
    setSearch(q)
    if (q.length === 0 || q.length >= 2) fetchGuests(q)
  }

  const addTag = async (guestId: string, tag: string) => {
    if (!tag.trim()) return
    const res = await adminFetch(`resource=guest-tag&guest_id=${guestId}`, {
      method: 'POST',
      body: JSON.stringify({ tag: tag.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setGuests(prev => prev.map(g =>
        g.id === guestId
          ? { ...g, guest_tags: [...(g.guest_tags || []), { id: data.tag?.id || '', tag: tag.trim() }] }
          : g
      ))
      setNewTag('')
    }
  }

  const removeTag = async (guestId: string, tagId: string, tagName: string) => {
    const res = await adminFetch(`resource=guest-tag&id=${tagId}`, { method: 'DELETE' })
    if (res.ok) {
      setGuests(prev => prev.map(g =>
        g.id === guestId
          ? { ...g, guest_tags: (g.guest_tags || []).filter(t => t.tag !== tagName) }
          : g
      ))
    }
  }

  const saveNotes = async (guestId: string, notes: string) => {
    const res = await adminFetch(`resource=guests&id=${guestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      setGuests(prev => prev.map(g => g.id === guestId ? { ...g, notes } : g))
      setEditingNotes(null)
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
        />
        {loading && <span className="text-xs text-gray-500 self-center">Loading…</span>}
        <span className="text-xs text-gray-600 self-center">{total} guests</span>
      </div>

      {guests.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-500 text-sm">{search ? 'No guests match your search' : 'No guests yet'}</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Guest', 'Contact', 'Visits', 'Last visit', 'Birthday', 'Tags', ''].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guests.map(guest => (
                <>
                  <tr
                    key={guest.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20 transition cursor-pointer"
                    onClick={() => setExpandedId(expandedId === guest.id ? null : guest.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{guest.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-gray-400">{guest.email}</p>
                      {guest.phone && <p className="text-xs text-gray-500">{guest.phone}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300 tabular-nums">{guest.visit_count}</td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(guest.last_visit_at)}</td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {guest.birthday ? guest.birthday.slice(5) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {(guest.guest_tags || []).map(t => (
                          <span key={t.tag} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                            {t.tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {expandedId === guest.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {expandedId === guest.id && (
                    <tr key={`${guest.id}-exp`} className="border-b border-gray-800/50 bg-gray-800/10">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="flex gap-8">
                          {/* Notes */}
                          <div className="flex-1">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Notes</p>
                            {editingNotes?.id === guest.id ? (
                              <div className="flex gap-2">
                                <textarea
                                  value={editingNotes.notes}
                                  onChange={e => setEditingNotes({ id: guest.id, notes: e.target.value })}
                                  rows={2}
                                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                                />
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => saveNotes(guest.id, editingNotes.notes)}
                                    className="text-xs text-green-400 hover:text-green-300"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingNotes(null)}
                                    className="text-xs text-gray-500 hover:text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <p className="text-sm text-gray-400 flex-1">{guest.notes || 'No notes'}</p>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingNotes({ id: guest.id, notes: guest.notes || '' }) }}
                                  className="text-xs text-gray-600 hover:text-white transition"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Tags */}
                          <div className="w-64">
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Tags</p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {(guest.guest_tags || []).map(t => (
                                <span
                                  key={t.tag}
                                  className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                                >
                                  {t.tag}
                                  <button
                                    onClick={e => { e.stopPropagation(); removeTag(guest.id, t.id, t.tag) }}
                                    className="text-gray-600 hover:text-red-400"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                              <input
                                value={newTag}
                                onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addTag(guest.id, newTag) }}
                                placeholder="Add tag…"
                                className="flex-1 bg-gray-800 border border-gray-700 text-white rounded px-2.5 py-1 text-xs focus:outline-none"
                              />
                              <button
                                onClick={() => addTag(guest.id, newTag)}
                                className="text-xs text-gray-400 hover:text-white px-2 border border-gray-700 rounded hover:border-gray-500 transition"
                              >
                                Add
                              </button>
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
      )}
    </div>
  )
}
