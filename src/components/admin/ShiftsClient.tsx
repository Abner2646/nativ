'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Shift, SeatingArea } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface ShiftArea {
  seating_area_id: string
  capacity: number
}

interface FormState {
  day_of_week: number
  name: string
  start_time: string
  end_time: string
  interval_minutes: number
  duration_minutes: number
  is_active: boolean
  areas: ShiftArea[]
}

const DEFAULT_FORM: FormState = {
  day_of_week: 1,
  name: '',
  start_time: '12:00',
  end_time: '15:00',
  interval_minutes: 30,
  duration_minutes: 90,
  is_active: true,
  areas: [],
}

interface Props {
  initialShifts: Shift[]
  areas: SeatingArea[]
  slug: string
}

export function ShiftsClient({ initialShifts, areas, slug }: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const openCreate = () => {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (shift: Shift) => {
    setForm({
      day_of_week: shift.day_of_week,
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      interval_minutes: shift.interval_minutes,
      duration_minutes: shift.duration_minutes,
      is_active: shift.is_active,
      areas: (shift.shift_areas || []).map(sa => ({
        seating_area_id: sa.seating_area_id,
        capacity: sa.capacity,
      })),
    })
    setEditingId(shift.id)
    setShowForm(true)
  }

  const saveShift = async () => {
    if (!form.name.trim() || !form.start_time || !form.end_time) return
    setSaving(true)
    try {
      const body = { ...form, areas: form.areas.filter(a => a.seating_area_id && a.capacity > 0) }
      let res
      if (editingId) {
        res = await adminFetch(`resource=shifts&id=${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        res = await adminFetch('resource=shifts', { method: 'POST', body: JSON.stringify(body) })
      }
      const data = await res.json()
      if (editingId) {
        // Refetch to get updated areas
        const listRes = await adminFetch('resource=shifts')
        const listData = await listRes.json()
        setShifts(listData.shifts || [])
      } else if (data.shift) {
        const listRes = await adminFetch('resource=shifts')
        const listData = await listRes.json()
        setShifts(listData.shifts || [])
      }
      setShowForm(false)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const deleteShift = async (id: string) => {
    if (!confirm('Delete this shift?')) return
    const res = await adminFetch(`resource=shifts&id=${id}`, { method: 'DELETE' })
    if (res.ok) setShifts(prev => prev.filter(s => s.id !== id))
  }

  const updateArea = (areaId: string, capacity: number) => {
    setForm(prev => {
      const existing = prev.areas.findIndex(a => a.seating_area_id === areaId)
      if (capacity === 0) {
        return { ...prev, areas: prev.areas.filter(a => a.seating_area_id !== areaId) }
      }
      if (existing >= 0) {
        const next = [...prev.areas]
        next[existing] = { seating_area_id: areaId, capacity }
        return { ...prev, areas: next }
      }
      return { ...prev, areas: [...prev.areas, { seating_area_id: areaId, capacity }] }
    })
  }

  const getAreaCapacity = (areaId: string) =>
    form.areas.find(a => a.seating_area_id === areaId)?.capacity || 0

  const shiftsByDay = DAYS.map((day, i) => ({
    day,
    index: i,
    shifts: shifts.filter(s => s.day_of_week === i),
  }))

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button
          onClick={openCreate}
          className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition"
        >
          + Add Shift
        </button>
      </div>

      {/* Shift form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-5">{editingId ? 'Edit Shift' : 'New Shift'}</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Day</label>
                  <select
                    value={form.day_of_week}
                    onChange={e => setForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Lunch, Dinner…"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Start</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">End</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Slot interval (min)</label>
                  <select
                    value={form.interval_minutes}
                    onChange={e => setForm(p => ({ ...p, interval_minutes: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  >
                    {[15, 30, 45, 60, 90].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Table duration (min)</label>
                  <select
                    value={form.duration_minutes}
                    onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  >
                    {[60, 90, 120, 150, 180].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
              </div>

              {/* Area capacities */}
              {areas.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-3 block">Area capacities (covers)</label>
                  <div className="space-y-2">
                    {areas.filter(a => a.is_active).map(area => (
                      <div key={area.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-gray-300">{area.name}</span>
                        <input
                          type="number"
                          min={0}
                          value={getAreaCapacity(area.id)}
                          onChange={e => updateArea(area.id, parseInt(e.target.value) || 0)}
                          placeholder="0 = disabled"
                          className="w-28 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none text-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="accent-white"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">Active</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveShift}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-white text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Shift'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-5 py-2.5 border border-gray-700 text-gray-400 rounded-lg text-sm hover:text-white hover:border-gray-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts by day */}
      <div className="space-y-4">
        {shiftsByDay.map(({ day, index, shifts: dayShifts }) => (
          <div key={index} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">{day}</h3>
              {dayShifts.length === 0 && (
                <span className="text-xs text-gray-600">No shifts</span>
              )}
            </div>
            {dayShifts.length > 0 && (
              <div className="divide-y divide-gray-800/50">
                {dayShifts.map(shift => (
                  <div key={shift.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium">{shift.name}</span>
                        <span className="font-mono text-xs text-gray-400">
                          {shift.start_time} – {shift.end_time}
                        </span>
                        <span className="text-xs text-gray-600">every {shift.interval_minutes}min</span>
                        {!shift.is_active && (
                          <span className="text-xs text-red-400 border border-red-900 px-2 py-0.5 rounded-full">inactive</span>
                        )}
                      </div>
                      {(shift.shift_areas || []).length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {shift.shift_areas!.map(sa => (
                            <span key={sa.id} className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">
                              {(sa as any).seating_areas?.name || sa.seating_area_id} · {sa.capacity} covers
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(shift)}
                        className="text-xs text-gray-500 hover:text-white transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteShift(shift.id)}
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
        ))}
      </div>
    </div>
  )
}
