'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Shift, SeatingArea } from '@/lib/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const inputCls = 'w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-white/25'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold'

interface ShiftArea { seating_area_id: string; capacity: number }
interface FormState {
  day_of_week: number; name: string; start_time: string; end_time: string
  interval_minutes: number; duration_minutes: number; is_active: boolean; areas: ShiftArea[]
}

const DEFAULT_FORM: FormState = {
  day_of_week: 1, name: '', start_time: '12:00', end_time: '15:00',
  interval_minutes: 30, duration_minutes: 90, is_active: true, areas: [],
}

interface Props { initialShifts: Shift[]; areas: SeatingArea[]; slug: string }

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

  const openCreate = () => { setForm(DEFAULT_FORM); setEditingId(null); setShowForm(true) }

  const openEdit = (shift: Shift) => {
    setForm({
      day_of_week: shift.day_of_week, name: shift.name, start_time: shift.start_time,
      end_time: shift.end_time, interval_minutes: shift.interval_minutes,
      duration_minutes: shift.duration_minutes, is_active: shift.is_active,
      areas: (shift.shift_areas || []).map(sa => ({ seating_area_id: sa.seating_area_id, capacity: sa.capacity })),
    })
    setEditingId(shift.id); setShowForm(true)
  }

  const saveShift = async () => {
    if (!form.name.trim() || !form.start_time || !form.end_time) return
    setSaving(true)
    try {
      const body = { ...form, areas: form.areas.filter(a => a.seating_area_id && a.capacity > 0) }
      const res = editingId
        ? await adminFetch(`resource=shifts&id=${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await adminFetch('resource=shifts', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) {
        const listRes = await adminFetch('resource=shifts')
        const listData = await listRes.json()
        setShifts(listData.shifts || [])
      }
      setShowForm(false); setEditingId(null)
    } finally { setSaving(false) }
  }

  const deleteShift = async (id: string) => {
    if (!confirm('Delete this shift?')) return
    const res = await adminFetch(`resource=shifts&id=${id}`, { method: 'DELETE' })
    if (res.ok) setShifts(prev => prev.filter(s => s.id !== id))
  }

  const updateArea = (areaId: string, capacity: number) => {
    setForm(prev => {
      const existing = prev.areas.findIndex(a => a.seating_area_id === areaId)
      if (capacity === 0) return { ...prev, areas: prev.areas.filter(a => a.seating_area_id !== areaId) }
      if (existing >= 0) {
        const next = [...prev.areas]; next[existing] = { seating_area_id: areaId, capacity }
        return { ...prev, areas: next }
      }
      return { ...prev, areas: [...prev.areas, { seating_area_id: areaId, capacity }] }
    })
  }

  const getAreaCapacity = (areaId: string) => form.areas.find(a => a.seating_area_id === areaId)?.capacity || 0
  const shiftsByDay = DAYS.map((day, i) => ({ day, index: i, shifts: shifts.filter(s => s.day_of_week === i) }))

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={openCreate}
          className="bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors">
          + Add Shift
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
            style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}>
            <h2 className="font-satoshi font-bold text-[17px] text-offwhite mb-5">
              {editingId ? 'Edit Shift' : 'New Shift'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Day</label>
                  <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: parseInt(e.target.value) }))} className={inputCls}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Name</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Lunch, Dinner…" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Slot interval (min)</label>
                  <select value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: parseInt(e.target.value) }))} className={inputCls}>
                    {[15, 30, 45, 60, 90].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Table duration (min)</label>
                  <select value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} className={inputCls}>
                    {[60, 90, 120, 150, 180].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
              </div>
              {areas.length > 0 && (
                <div>
                  <label className={labelCls}>Area capacities (covers)</label>
                  <div className="space-y-2">
                    {areas.filter(a => a.is_active).map(area => (
                      <div key={area.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-offwhite/70">{area.name}</span>
                        <input type="number" min={0} value={getAreaCapacity(area.id)}
                          onChange={e => updateArea(area.id, parseInt(e.target.value) || 0)}
                          placeholder="0 = disabled"
                          className="w-28 text-right text-sm text-offwhite rounded-lg px-3 py-1.5 focus:outline-none"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <input type="checkbox" id="is_active" checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="accent-offwhite" />
                <label htmlFor="is_active" className="text-sm text-offwhite/70">Active</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveShift} disabled={saving || !form.name.trim()}
                className="flex-1 bg-offwhite text-midnight font-semibold py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Save Shift'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-5 py-2.5 rounded-xl text-sm text-offwhite/50 hover:text-offwhite hover:border-white/25 transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts by day */}
      <div className="space-y-3">
        {shiftsByDay.map(({ day, index, shifts: dayShifts }) => (
          <div key={index} className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-6 py-3 flex items-center justify-between"
              style={{ borderBottom: dayShifts.length > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
              <h3 className="text-sm font-semibold text-offwhite/60">{day}</h3>
              {dayShifts.length === 0 && <span className="text-xs text-offwhite/25">No shifts</span>}
            </div>
            {dayShifts.length > 0 && (
              <div>
                {dayShifts.map((shift, i) => (
                  <div key={shift.id} className="px-6 py-4 flex items-start gap-4"
                    style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-offwhite">{shift.name}</span>
                        <span className="font-mono text-xs text-offwhite/40">{shift.start_time} – {shift.end_time}</span>
                        <span className="text-xs text-offwhite/25">every {shift.interval_minutes}min</span>
                        {!shift.is_active && (
                          <span className="text-xs text-red-400/80 px-2 py-0.5 rounded-full"
                            style={{ border: '1px solid rgba(224,85,85,0.25)' }}>inactive</span>
                        )}
                      </div>
                      {(shift.shift_areas || []).length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {shift.shift_areas!.map(sa => (
                            <span key={sa.id} className="text-xs text-offwhite/40 px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                              {(sa as any).seating_areas?.name || sa.seating_area_id} · {sa.capacity} covers
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => openEdit(shift)} className="text-xs text-offwhite/30 hover:text-offwhite transition-colors">Edit</button>
                      <button onClick={() => deleteShift(shift.id)} className="text-xs text-offwhite/25 hover:text-red-400 transition-colors">Delete</button>
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
