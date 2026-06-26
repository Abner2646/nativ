'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { SeatingArea } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  initialAreas: SeatingArea[]
  slug: string
}

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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    })
  }

  const createArea = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await adminFetch('resource=areas', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), position: areas.length }),
      })
      const data = await res.json()
      if (data.area) {
        setAreas(prev => [...prev, data.area])
        setNewName('')
      }
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    const res = await adminFetch(`resource=areas&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName.trim() }),
    })
    const data = await res.json()
    if (data.area) {
      setAreas(prev => prev.map(a => a.id === id ? data.area : a))
      setEditingId(null)
    }
  }

  const toggleActive = async (area: SeatingArea) => {
    const res = await adminFetch(`resource=areas&id=${area.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !area.is_active }),
    })
    const data = await res.json()
    if (data.area) setAreas(prev => prev.map(a => a.id === area.id ? data.area : a))
  }

  const deleteArea = async (id: string) => {
    if (!confirm('Delete this area? Shifts using it will lose capacity data.')) return
    const res = await adminFetch(`resource=areas&id=${id}`, { method: 'DELETE' })
    if (res.ok) setAreas(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div>
      {/* Add area */}
      <div className="flex gap-3 mb-6">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createArea()}
          placeholder="New area name (e.g. Terrace, Main room)"
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
        />
        <button
          onClick={createArea}
          disabled={saving || !newName.trim()}
          className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
        >
          Add Area
        </button>
      </div>

      {areas.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-500 text-sm">No seating areas yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map(area => (
            <div
              key={area.id}
              className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 flex items-center gap-4"
            >
              {editingId === area.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(area.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                  className="flex-1 bg-gray-800 border border-gray-600 text-white rounded px-3 py-1.5 text-sm focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-sm font-medium">{area.name}</span>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(area)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    area.is_active
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                      : 'bg-gray-500/10 text-gray-500 border border-gray-700 hover:bg-gray-500/20'
                  }`}
                >
                  {area.is_active ? 'Active' : 'Inactive'}
                </button>

                {editingId === area.id ? (
                  <>
                    <button onClick={() => saveEdit(area.id)} className="text-xs text-green-400 hover:text-green-300">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingId(area.id); setEditName(area.name) }}
                    className="text-xs text-gray-500 hover:text-white transition"
                  >
                    Edit
                  </button>
                )}

                <button
                  onClick={() => deleteArea(area.id)}
                  className="text-xs text-gray-600 hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
