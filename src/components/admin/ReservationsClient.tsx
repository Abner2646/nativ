'use client'
import { useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Reservation, ReservationStatus, AvailabilitySlot } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-sage/15 text-sage border border-sage/30',
  cancelled:  'bg-red-400/10 text-red-400 border border-red-400/20',
  completed:  'bg-white/[0.06] text-offwhite/40 border border-white/[0.08]',
}

const inputCls = 'bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold'
const primaryBtn = 'bg-offwhite text-midnight font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40'
const secondaryBtn = 'px-4 py-2.5 border border-white/[0.12] text-offwhite/50 rounded-xl text-sm hover:border-white/25 hover:text-offwhite transition-colors'

interface Props {
  initialReservations: Reservation[]
  slug: string
  defaultDate: string
}

interface NewResForm {
  date: string; party_size: number; shift_id: string; time: string
  area_id: string; guest_name: string; guest_email: string
  guest_phone: string; occasion: string; notes: string
}

const OCCASIONS = ['', 'Birthday', 'Anniversary', 'Business', 'Date', 'Other']

export function ReservationsClient({ initialReservations, slug, defaultDate }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [date, setDate] = useState(defaultDate)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<'slot' | 'guest'>('slot')
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState<NewResForm>({
    date: defaultDate, party_size: 2, shift_id: '', time: '', area_id: '',
    guest_name: '', guest_email: '', guest_phone: '', occasion: '', notes: '',
  })

  const fetchReservations = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&date=${d}&tenant=${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setReservations(data.reservations || [])
    } finally { setLoading(false) }
  }, [slug])

  const handleDateChange = (d: string) => { setDate(d); fetchReservations(d) }

  const updateStatus = async (id: string, status: ReservationStatus) => {
    setUpdating(id)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&id=${id}&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    } finally { setUpdating(null) }
  }

  const openModal = () => {
    setForm(f => ({ ...f, date, shift_id: '', time: '', area_id: '', guest_name: '', guest_email: '', guest_phone: '', occasion: '', notes: '' }))
    setSlots([]); setSlotError(''); setSubmitError(''); setModalStep('slot'); setShowModal(true)
  }

  const fetchSlots = async (overrideDate?: string, overrideParty?: number) => {
    const d = overrideDate ?? form.date, p = overrideParty ?? form.party_size
    if (!d || !p) return
    setSlotsLoading(true); setSlotError(''); setSlots([])
    setForm(f => ({ ...f, shift_id: '', time: '', area_id: '' }))
    try {
      const res = await fetch(`/api/availability?tenant=${slug}&date=${d}&party_size=${p}`)
      const data = await res.json()
      if (!data.available || !data.slots?.length) {
        setSlotError(data.reason === 'closed' ? 'The restaurant is closed on this date.' : 'No availability for this date and party size.')
      } else { setSlots(data.slots) }
    } catch { setSlotError('Failed to load availability.') }
    finally { setSlotsLoading(false) }
  }

  const selectSlot = (slot: AvailabilitySlot) => {
    const area = slot.areas[0]
    setForm(f => ({ ...f, shift_id: slot.shift_id, time: slot.time, area_id: area?.area_id || '' }))
  }

  const submitReservation = async () => {
    setSubmitting(true); setSubmitError('')
    try {
      const res = await fetch(`/api/reservations/create?tenant=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: form.shift_id, date: form.date, time: form.time, party_size: form.party_size,
          seating_area_id: form.area_id || null, occasion: form.occasion || null, notes: form.notes || null,
          guest_name: form.guest_name, guest_email: form.guest_email, guest_phone: form.guest_phone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Failed to create reservation.'); return }
      setShowModal(false)
      if (form.date === date) fetchReservations(date)
    } finally { setSubmitting(false) }
  }

  const selectedSlot = slots.find(s => s.shift_id === form.shift_id && s.time === form.time)
  const canProceed = !!selectedSlot
  const canSubmit = form.guest_name.trim() && form.guest_email.trim() && canProceed
  const filtered = statusFilter === 'all' ? reservations : reservations.filter(r => r.status === statusFilter)

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} className={inputCls} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {loading && <span className="text-xs text-offwhite/30 self-center">Loading…</span>}
        <div className="flex-1" />
        <button onClick={openModal} className={primaryBtn}>+ New reservation</button>
      </div>

      {/* ── Empty ── */}
      {filtered.length === 0 ? (
        <div className="p-16 text-center rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm text-offwhite/35">No reservations for this date</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Time', 'Guest', 'Party', 'Shift', 'Area', 'Occasion', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-4 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)')}
                  onMouseOut={e  => (e.currentTarget.style.backgroundColor = '')}>
                  <td className="px-5 py-4 font-mono text-sm tabular-nums text-offwhite/70">{r.time}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-offwhite">{r.guest?.name}</p>
                    <p className="text-xs text-offwhite/40 mt-0.5">{r.guest?.email}</p>
                    {r.guest?.phone && <p className="text-xs text-offwhite/30">{r.guest.phone}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-offwhite/60">{r.party_size}</td>
                  <td className="px-5 py-4 text-sm text-offwhite/40">{r.shift?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-offwhite/40">{r.seating_area?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-offwhite/40">{r.occasion || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_BADGE[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-5 py-4">
                    <select value={r.status} disabled={updating === r.id}
                      onChange={e => updateStatus(r.id, e.target.value as ReservationStatus)}
                      className="rounded-lg px-2 py-1 text-xs focus:outline-none disabled:opacity-40 text-offwhite"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <option value="confirmed">confirmed</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-satoshi font-bold text-[17px] text-offwhite">New reservation</h2>
              <button onClick={() => setShowModal(false)} className="text-offwhite/30 hover:text-offwhite transition-colors text-xl leading-none">×</button>
            </div>

            {/* Step tabs */}
            <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {(['slot', 'guest'] as const).map((step, i) => (
                <button key={step}
                  onClick={() => { if (step === 'guest' && !canProceed) return; setModalStep(step) }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    modalStep === step ? 'text-offwhite border-b-2 border-offwhite' : 'text-offwhite/35 hover:text-offwhite/60'
                  } ${step === 'guest' && !canProceed ? 'cursor-not-allowed opacity-30' : ''}`}>
                  {i + 1}. {step === 'slot' ? 'Date & slot' : 'Guest info'}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {modalStep === 'slot' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={`w-full ${inputCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Covers</label>
                      <input type="number" min={1} max={20} value={form.party_size}
                        onChange={e => setForm(f => ({ ...f, party_size: parseInt(e.target.value) || 1 }))}
                        className={`w-full ${inputCls}`} />
                    </div>
                  </div>
                  <button onClick={() => fetchSlots()} disabled={slotsLoading || !form.date || !form.party_size}
                    className={`w-full ${secondaryBtn}`}>
                    {slotsLoading ? 'Checking…' : 'Check availability'}
                  </button>
                  {slotsError && <p className="text-sm text-red-400 text-center">{slotsError}</p>}
                  {slots.length > 0 && (
                    <div>
                      <p className={labelCls}>Available slots</p>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {Array.from(new Set(slots.map(s => s.shift_name))).map(shiftName => (
                          <div key={shiftName}>
                            <p className="text-xs text-offwhite/25 mb-2">{shiftName}</p>
                            <div className="flex flex-wrap gap-2">
                              {slots.filter(s => s.shift_name === shiftName).map(slot => {
                                const isSelected = form.shift_id === slot.shift_id && form.time === slot.time
                                return (
                                  <button key={`${slot.shift_id}-${slot.time}`} onClick={() => selectSlot(slot)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                                      isSelected ? 'bg-offwhite text-midnight font-semibold' : 'text-offwhite/60 hover:text-offwhite'
                                    }`}
                                    style={!isSelected ? { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}>
                                    {slot.time}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedSlot && selectedSlot.areas.length > 1 && (
                        <div className="mt-4">
                          <p className={labelCls}>Area</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedSlot.areas.map(a => (
                              <button key={a.area_id} onClick={() => setForm(f => ({ ...f, area_id: a.area_id }))}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${form.area_id === a.area_id ? 'bg-offwhite text-midnight font-semibold' : 'text-offwhite/60 hover:text-offwhite'}`}
                                style={form.area_id !== a.area_id ? { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' } : undefined}>
                                {a.area_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {canProceed && (
                    <button onClick={() => setModalStep('guest')} className={`w-full ${primaryBtn}`}>
                      Continue → Guest info
                    </button>
                  )}
                </>
              )}

              {modalStep === 'guest' && (
                <>
                  <div className="px-4 py-3 rounded-xl text-sm text-offwhite/50 flex gap-4 flex-wrap"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <span>{form.date}</span><span>·</span>
                    <span>{selectedSlot?.shift_name} {form.time}</span><span>·</span>
                    <span>{form.party_size} covers</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: 'Name *', type: 'text',  key: 'guest_name',  ph: 'Full name' },
                      { label: 'Email *', type: 'email', key: 'guest_email', ph: 'guest@email.com' },
                      { label: 'Phone',   type: 'tel',   key: 'guest_phone', ph: '+1 555 000 0000' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className={labelCls}>{f.label}</label>
                        <input type={f.type} placeholder={f.ph}
                          value={(form as any)[f.key]}
                          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className={`w-full ${inputCls}`} />
                      </div>
                    ))}
                    <div>
                      <label className={labelCls}>Occasion</label>
                      <select value={form.occasion} onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))} className={`w-full ${inputCls}`}>
                        {OCCASIONS.map(o => <option key={o} value={o}>{o || '— none —'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Notes</label>
                      <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Allergies, preferences…" rows={2}
                        className={`w-full ${inputCls} resize-none`} />
                    </div>
                  </div>
                  {submitError && <p className="text-sm text-red-400">{submitError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setModalStep('slot')} className={secondaryBtn}>← Back</button>
                    <button onClick={submitReservation} disabled={submitting || !canSubmit} className={`flex-1 ${primaryBtn}`}>
                      {submitting ? 'Creating…' : 'Create reservation'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
