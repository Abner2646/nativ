'use client'
import { useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Reservation, ReservationStatus, AvailabilitySlot } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
  completed: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
}

interface Props {
  initialReservations: Reservation[]
  slug: string
  defaultDate: string
}

interface NewResForm {
  date: string
  party_size: number
  shift_id: string
  time: string
  area_id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  occasion: string
  notes: string
}

const OCCASIONS = ['', 'Birthday', 'Anniversary', 'Business', 'Date', 'Other']

export function ReservationsClient({ initialReservations, slug, defaultDate }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [date, setDate] = useState(defaultDate)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  // New reservation modal state
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<'slot' | 'guest'>('slot')
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState<NewResForm>({
    date: defaultDate,
    party_size: 2,
    shift_id: '',
    time: '',
    area_id: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    occasion: '',
    notes: '',
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
    } finally {
      setLoading(false)
    }
  }, [slug])

  const handleDateChange = (d: string) => {
    setDate(d)
    fetchReservations(d)
  }

  const updateStatus = async (id: string, status: ReservationStatus) => {
    setUpdating(id)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&id=${id}&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      }
    } finally {
      setUpdating(null)
    }
  }

  const openModal = () => {
    setForm(f => ({ ...f, date, shift_id: '', time: '', area_id: '', guest_name: '', guest_email: '', guest_phone: '', occasion: '', notes: '' }))
    setSlots([])
    setSlotError('')
    setSubmitError('')
    setModalStep('slot')
    setShowModal(true)
  }

  const closeModal = () => setShowModal(false)

  const fetchSlots = async (overrideDate?: string, overrideParty?: number) => {
    const d = overrideDate ?? form.date
    const p = overrideParty ?? form.party_size
    if (!d || !p) return
    setSlotsLoading(true)
    setSlotError('')
    setSlots([])
    setForm(f => ({ ...f, shift_id: '', time: '', area_id: '' }))
    try {
      const res = await fetch(`/api/availability?tenant=${slug}&date=${d}&party_size=${p}`)
      const data = await res.json()
      if (!data.available || !data.slots?.length) {
        setSlotError(data.reason === 'closed' ? 'The restaurant is closed on this date.' : 'No availability for this date and party size.')
      } else {
        setSlots(data.slots)
      }
    } catch {
      setSlotError('Failed to load availability.')
    } finally {
      setSlotsLoading(false)
    }
  }

  const selectSlot = (slot: AvailabilitySlot) => {
    const area = slot.areas[0]
    setForm(f => ({ ...f, shift_id: slot.shift_id, time: slot.time, area_id: area?.area_id || '' }))
  }

  const submitReservation = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/reservations/create?tenant=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: form.shift_id,
          date: form.date,
          time: form.time,
          party_size: form.party_size,
          seating_area_id: form.area_id || null,
          occasion: form.occasion || null,
          notes: form.notes || null,
          guest_name: form.guest_name,
          guest_email: form.guest_email,
          guest_phone: form.guest_phone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to create reservation.')
        return
      }
      closeModal()
      if (form.date === date) fetchReservations(date)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSlot = slots.find(s => s.shift_id === form.shift_id && s.time === form.time)
  const canProceed = !!selectedSlot
  const canSubmit = form.guest_name.trim() && form.guest_email.trim() && canProceed

  const filtered = statusFilter === 'all'
    ? reservations
    : reservations.filter(r => r.status === statusFilter)

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="date"
          value={date}
          onChange={e => handleDateChange(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gray-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {loading && <span className="text-xs text-gray-500 self-center">Loading...</span>}
        <div className="flex-1" />
        <button
          onClick={openModal}
          className="bg-white text-black font-semibold px-5 py-2 rounded-lg text-sm hover:bg-gray-100 transition"
        >
          + New reservation
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-500 text-sm">No reservations for this date</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Time', 'Guest', 'Party', 'Shift', 'Area', 'Occasion', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition">
                  <td className="px-5 py-4 font-mono text-sm tabular-nums">{r.time}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-white">{r.guest?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.guest?.email}</p>
                    {r.guest?.phone && <p className="text-xs text-gray-500">{r.guest.phone}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">{r.party_size}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.shift?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.seating_area?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.occasion || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={r.status}
                      disabled={updating === r.id}
                      onChange={e => updateStatus(r.id, e.target.value as ReservationStatus)}
                      className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
                    >
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

      {/* New Reservation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-800">
              <h2 className="text-lg font-bold">New reservation</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition text-xl leading-none">×</button>
            </div>

            {/* Step tabs */}
            <div className="flex border-b border-gray-800">
              {(['slot', 'guest'] as const).map((step, i) => (
                <button
                  key={step}
                  onClick={() => { if (step === 'guest' && !canProceed) return; setModalStep(step) }}
                  className={`flex-1 py-3 text-sm font-medium transition ${modalStep === step ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'} ${step === 'guest' && !canProceed ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {i + 1}. {step === 'slot' ? 'Date & slot' : 'Guest info'}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {modalStep === 'slot' && (
                <>
                  {/* Date + party size */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Covers</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={form.party_size}
                        onChange={e => setForm(f => ({ ...f, party_size: parseInt(e.target.value) || 1 }))}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => fetchSlots()}
                    disabled={slotsLoading || !form.date || !form.party_size}
                    className="w-full bg-gray-800 border border-gray-700 text-white py-2.5 rounded-lg text-sm hover:bg-gray-700 transition disabled:opacity-40 font-medium"
                  >
                    {slotsLoading ? 'Checking availability…' : 'Check availability'}
                  </button>

                  {slotsError && (
                    <p className="text-sm text-red-400 text-center">{slotsError}</p>
                  )}

                  {slots.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Available slots</p>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {Array.from(new Set(slots.map(s => s.shift_name))).map(shiftName => {
                          const shiftSlots = slots.filter(s => s.shift_name === shiftName)
                          return (
                            <div key={shiftName}>
                              <p className="text-xs text-gray-600 mb-2">{shiftName}</p>
                              <div className="flex flex-wrap gap-2">
                                {shiftSlots.map(slot => {
                                  const isSelected = form.shift_id === slot.shift_id && form.time === slot.time
                                  return (
                                    <button
                                      key={`${slot.shift_id}-${slot.time}`}
                                      onClick={() => selectSlot(slot)}
                                      className={`px-3 py-1.5 rounded-lg text-sm font-mono transition ${
                                        isSelected
                                          ? 'bg-white text-black'
                                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                      }`}
                                    >
                                      {slot.time}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {selectedSlot && selectedSlot.areas.length > 1 && (
                        <div className="mt-4">
                          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Area</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedSlot.areas.map(a => (
                              <button
                                key={a.area_id}
                                onClick={() => setForm(f => ({ ...f, area_id: a.area_id }))}
                                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                                  form.area_id === a.area_id
                                    ? 'bg-white text-black'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                                }`}
                              >
                                {a.area_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {canProceed && (
                    <button
                      onClick={() => setModalStep('guest')}
                      className="w-full bg-white text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-100 transition"
                    >
                      Continue → Guest info
                    </button>
                  )}
                </>
              )}

              {modalStep === 'guest' && (
                <>
                  {/* Summary */}
                  <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 flex gap-4 flex-wrap">
                    <span>{form.date}</span>
                    <span>·</span>
                    <span>{selectedSlot?.shift_name} {form.time}</span>
                    <span>·</span>
                    <span>{form.party_size} covers</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Name *</label>
                      <input
                        value={form.guest_name}
                        onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                        placeholder="Full name"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Email *</label>
                      <input
                        type="email"
                        value={form.guest_email}
                        onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))}
                        placeholder="guest@email.com"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Phone</label>
                      <input
                        type="tel"
                        value={form.guest_phone}
                        onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                        placeholder="+1 555 000 0000"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Occasion</label>
                        <select
                          value={form.occasion}
                          onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                        >
                          {OCCASIONS.map(o => <option key={o} value={o}>{o || '— none —'}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Notes</label>
                      <textarea
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Allergies, seating preferences…"
                        rows={2}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none focus:border-gray-500"
                      />
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-sm text-red-400">{submitError}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setModalStep('slot')}
                      className="px-4 py-2.5 border border-gray-700 text-gray-400 rounded-lg text-sm hover:text-white hover:border-gray-500 transition"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={submitReservation}
                      disabled={submitting || !canSubmit}
                      className="flex-1 bg-white text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
                    >
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
