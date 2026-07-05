'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { SeatingArea } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props { initialAreas: SeatingArea[]; slug: string }

export function AreasClient({ initialAreas, slug }: Props) {
  const [areas, setAreas] = useState<SeatingArea[]>(initialAreas)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const createArea = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await adminFetch('resource=areas', { method: 'POST', body: JSON.stringify({ name: newName.trim(), position: areas.length }) })
      const data = await res.json()
      if (data.area) { setAreas(prev => [...prev, data.area]); setNewName('') }
    } finally { setSaving(false) }
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    const res = await adminFetch(`resource=areas&id=${id}`, { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) })
    const data = await res.json()
    if (data.area) { setAreas(prev => prev.map(a => a.id === id ? data.area : a)); setEditingId(null) }
  }

  const toggleActive = async (area: SeatingArea) => {
    const res = await adminFetch(`resource=areas&id=${area.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !area.is_active }) })
    const data = await res.json()
    if (data.area) setAreas(prev => prev.map(a => a.id === area.id ? data.area : a))
  }

  const deleteArea = async (id: string) => {
    if (!confirm('Delete this area? Shifts using it will lose capacity data.')) return
    const res = await adminFetch(`resource=areas&id=${id}`, { method: 'DELETE' })
    if (res.ok) setAreas(prev => prev.filter(a => a.id !== id))
  }

  const inputBase = 'bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createArea()}
          placeholder="New area name (e.g. Terrace, Main room)"
          className={`flex-1 ${inputBase}`} />
        <button onClick={createArea} disabled={saving || !newName.trim()}
          className="bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
          Add Area
        </button>
      </div>

      {areas.length === 0 ? (
        <div className="p-16 text-center rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm text-offwhite/35">No seating areas yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map(area => (
            <div key={area.id} className="flex items-center gap-4 px-6 py-4 rounded-2xl"
              style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
              {editingId === area.id ? (
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(area.id); if (e.key === 'Escape') setEditingId(null) }}
                  className="flex-1 text-offwhite text-sm rounded-lg px-3 py-1.5 focus:outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }} />
              ) : (
                <span className="flex-1 text-sm font-medium text-offwhite">{area.name}</span>
              )}

              <div className="flex items-center gap-3">
                <button onClick={() => toggleActive(area)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors font-semibold ${
                    area.is_active
                      ? 'bg-sage/15 text-sage border border-sage/30 hover:bg-sage/20'
                      : 'text-offwhite/35 hover:text-offwhite/60'
                  }`}
                  style={!area.is_active ? { backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}>
                  {area.is_active ? 'Active' : 'Inactive'}
                </button>
                {editingId === area.id ? (
                  <>
                    <button onClick={() => saveEdit(area.id)} className="text-xs text-sage hover:text-sage/80 transition-colors">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingId(area.id); setEditName(area.name) }}
                    className="text-xs text-offwhite/30 hover:text-offwhite transition-colors">Edit</button>
                )}
                <button onClick={() => deleteArea(area.id)}
                  className="text-xs text-offwhite/25 hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
