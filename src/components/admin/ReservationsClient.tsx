'use client'
import { useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Reservation, ReservationStatus, AvailabilitySlot } from '@/lib/types'
import { Cake, Heart, Briefcase, Flower2, Star, CreditCard, type LucideIcon } from 'lucide-react'

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

function fmtTime(t: string) { return t.slice(0, 5) }

const card = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

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

const OCCASION_ICON: Record<string, LucideIcon> = {
  Birthday:    Cake,
  Anniversary: Heart,
  Business:    Briefcase,
  Date:        Flower2,
  Other:       Star,
}

function OccasionIcon({ occasion, size = 11 }: { occasion: string; size?: number }) {
  const Icon = OCCASION_ICON[occasion]
  if (!Icon) return null
  return <Icon size={size} strokeWidth={1.6} className="shrink-0 inline-block" style={{ verticalAlign: 'middle', marginTop: '-1px' }} />
}

// ── Compact list row (left panel on tablet/desktop) ──────────────────────────
function CompactRow({
  r, selected, onClick,
}: { r: Reservation; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 transition-colors"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        borderLeft: selected ? '2px solid #C9A96E' : '2px solid transparent',
        backgroundColor: selected ? 'rgba(255,255,255,0.05)' : undefined,
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.025)' }}
      onMouseOut={e  => { if (!selected) e.currentTarget.style.backgroundColor = '' }}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-semibold text-offwhite leading-none w-[46px] shrink-0">
          {fmtTime(r.time)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-offwhite truncate">{r.guest?.name}</p>
          <p className="text-xs text-offwhite/35 mt-0.5 flex items-center gap-1.5">
            {r.occasion && <OccasionIcon occasion={r.occasion} size={11} />}
            <span>{r.party_size} {r.party_size === 1 ? 'person' : 'people'}</span>
            {r.deposit_amount && (
              <span className="font-semibold" style={{ color: '#C9A96E' }}>· ${r.deposit_amount.toFixed(0)}</span>
            )}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0 ${STATUS_BADGE[r.status] || ''}`}>
          {r.status}
        </span>
      </div>
    </button>
  )
}

// ── Detail panel (right side on tablet/desktop) ──────────────────────────────
function DetailPanel({
  r, updating, onStatusChange,
}: { r: Reservation; updating: string | null; onStatusChange: (id: string, s: ReservationStatus) => void }) {
  const divider = { borderTop: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="p-6">
      {/* Time + status */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-mono text-5xl font-bold text-offwhite leading-none">{fmtTime(r.time)}</p>
          <p className="text-sm text-offwhite/35 mt-1.5">
            {r.party_size} {r.party_size === 1 ? 'person' : 'people'}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border mt-1 ${STATUS_BADGE[r.status] || ''}`}>
          {r.status}
        </span>
      </div>

      {/* Deposit banner — shown prominently so staff can discount at the table */}
      {r.deposit_amount && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
          style={{ backgroundColor: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.25)' }}>
          <CreditCard size={16} strokeWidth={1.6} style={{ color: '#C9A96E', flexShrink: 0 }} />
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: '#C9A96E' }}>
              ${r.deposit_amount.toFixed(2)} deposit paid
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(201,169,110,0.60)' }}>
              Discount this from the final bill
            </p>
          </div>
        </div>
      )}

      {/* Guest info */}
      <div className="pb-5 mb-5 space-y-0.5" style={divider}>
        <p className="text-base font-semibold text-offwhite">{r.guest?.name}</p>
        <p className="text-sm text-offwhite/45">{r.guest?.email}</p>
        {r.guest?.phone && <p className="text-sm text-offwhite/30">{r.guest.phone}</p>}
      </div>

      {/* Details grid */}
      {(r.shift?.name || r.seating_area?.name || r.occasion) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 pb-5 mb-5" style={divider}>
          {r.shift?.name && (
            <div>
              <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Shift</p>
              <p className="text-sm text-offwhite/70">{r.shift.name}</p>
            </div>
          )}
          {r.seating_area?.name && (
            <div>
              <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Area</p>
              <p className="text-sm text-offwhite/70">{r.seating_area.name}</p>
            </div>
          )}
          {r.occasion && (
            <div>
              <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1">Occasion</p>
              <p className="text-sm text-offwhite/70 flex items-center gap-1.5">
                <OccasionIcon occasion={r.occasion} size={13} />
                {r.occasion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {r.notes && (
        <div className="pb-5 mb-5" style={divider}>
          <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-1.5">Notes</p>
          <p className="text-sm text-offwhite/50 italic">"{r.notes}"</p>
        </div>
      )}

      {/* Status buttons */}
      <div>
        <p className="text-[10px] text-offwhite/25 uppercase tracking-widest mb-2.5">Change status</p>
        <div className="flex gap-2">
          {(['confirmed', 'completed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              disabled={updating === r.id}
              onClick={() => onStatusChange(r.id, s)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
              style={
                r.status === s
                  ? { backgroundColor: '#F2EFE9', color: '#0F1720' }
                  : { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(242,239,233,0.45)' }
              }
              onMouseOver={e => { if (r.status !== s) e.currentTarget.style.color = 'rgba(242,239,233,0.85)' }}
              onMouseOut={e  => { if (r.status !== s) e.currentTarget.style.color = 'rgba(242,239,233,0.45)' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ReservationsClient({ initialReservations, slug, defaultDate }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [date, setDate]                 = useState(defaultDate)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading]           = useState(false)
  const [updating, setUpdating]         = useState<string | null>(null)
  const [selectedId, setSelectedId]     = useState<string | null>(
    initialReservations.length > 0 ? initialReservations[0].id : null
  )

  const [showModal, setShowModal]       = useState(false)
  const [modalStep, setModalStep]       = useState<'slot' | 'guest'>('slot')
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotError]      = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [form, setForm]                 = useState<NewResForm>({
    date: defaultDate, party_size: 2, shift_id: '', time: '', area_id: '',
    guest_name: '', guest_email: '', guest_phone: '', occasion: '', notes: '',
  })

  const fetchReservations = useCallback(async (d: string) => {
    setLoading(true)
    setSelectedId(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&date=${d}&tenant=${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const list: Reservation[] = data.reservations || []
      setReservations(list)
      if (list.length > 0) setSelectedId(list[0].id)
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
      const res = await fetch(`/api/reservations?tenant=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: form.shift_id, date: form.date, time: form.time, party_size: form.party_size,
          seating_area_id: form.area_id || null, occasion: form.occasion || null, notes: form.notes || null,
          guest_name: form.guest_name, guest_email: form.guest_email, guest_phone: form.guest_phone || null,
          source: 'manual',
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Failed to create reservation.'); return }
      setShowModal(false)
      if (form.date === date) fetchReservations(date)
    } finally { setSubmitting(false) }
  }

  const selectedSlot = slots.find(s => s.shift_id === form.shift_id && s.time === form.time)
  const canProceed   = !!selectedSlot
  const canSubmit    = form.guest_name.trim() && form.guest_email.trim() && canProceed
  const filtered     = statusFilter === 'all' ? reservations : reservations.filter(r => r.status === statusFilter)
  const selectedRes  = filtered.find(r => r.id === selectedId) ?? null

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center">
        <div className="flex gap-3">
          <input
            type="date" value={date} onChange={e => handleDateChange(e.target.value)}
            className={`flex-1 md:flex-none ${inputCls}`}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {loading && <span className="text-xs text-offwhite/30 self-center">Loading…</span>}
        <div className="hidden md:flex flex-1" />
        <button onClick={openModal} className={`w-full md:w-auto ${primaryBtn}`}>+ New reservation</button>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl" style={card}>
          <p className="text-sm text-offwhite/35">No reservations for this date</p>
        </div>
      ) : (
        <>
          {/* ── Mobile cards (< md) ── */}
          <div className="md:hidden space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="rounded-2xl p-4" style={card}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono text-2xl font-semibold text-offwhite leading-none">
                    {fmtTime(r.time)}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_BADGE[r.status] || ''}`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-offwhite/40 font-medium">{r.party_size} pax</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-offwhite">{r.guest?.name}</p>
                <p className="text-xs text-offwhite/40 mt-0.5">{r.guest?.email}</p>
                {r.guest?.phone && <p className="text-xs text-offwhite/30 mt-0.5">{r.guest.phone}</p>}
                {(r.shift?.name || r.seating_area?.name || r.occasion) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {r.shift?.name && <span className="text-[11px] text-offwhite/30">{r.shift.name}</span>}
                    {r.seating_area?.name && (
                      <><span className="text-offwhite/15 text-[11px]">·</span>
                      <span className="text-[11px] text-offwhite/30">{r.seating_area.name}</span></>
                    )}
                    {r.occasion && (
                      <><span className="text-offwhite/15 text-[11px]">·</span>
                      <span className="text-[11px] text-offwhite/30 inline-flex items-center gap-1">
                        <OccasionIcon occasion={r.occasion} size={10} />
                        {r.occasion}
                      </span></>
                    )}
                  </div>
                )}
                {r.deposit_amount && (
                  <div className="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.20)' }}>
                    <CreditCard size={13} strokeWidth={1.6} style={{ color: '#C9A96E', flexShrink: 0 }} />
                    <span className="text-xs font-semibold" style={{ color: '#C9A96E' }}>
                      ${r.deposit_amount.toFixed(2)} paid — discount from bill
                    </span>
                  </div>
                )}
                {r.notes && <p className="text-[11px] text-offwhite/25 mt-1.5 italic">"{r.notes}"</p>}
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <select
                    value={r.status} disabled={updating === r.id}
                    onChange={e => updateStatus(r.id, e.target.value as ReservationStatus)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none disabled:opacity-40 text-offwhite"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tablet / Desktop split view (≥ md) ── */}
          <div className="hidden md:flex gap-4 lg:gap-5 items-start">
            {/* Left: compact list */}
            <div className="w-[260px] lg:w-[280px] shrink-0 rounded-2xl overflow-hidden" style={card}>
              {filtered.map(r => (
                <CompactRow
                  key={r.id}
                  r={r}
                  selected={selectedId === r.id}
                  onClick={() => setSelectedId(r.id)}
                />
              ))}
            </div>

            {/* Right: detail panel — sticky so it stays visible while list scrolls */}
            <div className="flex-1 sticky top-4 rounded-2xl min-h-[180px]" style={card}>
              {selectedRes ? (
                <DetailPanel r={selectedRes} updating={updating} onStatusChange={updateStatus} />
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm text-offwhite/30">Select a reservation to view details</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── New reservation modal — bottom sheet on mobile, centered on desktop ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-end md:items-center justify-center md:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto md:rounded-2xl rounded-t-2xl"
            style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-satoshi font-bold text-[17px] text-offwhite">New reservation</h2>
              <button onClick={() => setShowModal(false)} className="text-offwhite/30 hover:text-offwhite transition-colors text-xl leading-none">×</button>
            </div>

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
                      <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
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
                                    {fmtTime(slot.time)}
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
                  <div className="px-4 py-3 rounded-xl text-sm text-offwhite/50 flex gap-3 flex-wrap"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <span>{form.date}</span><span>·</span>
                    <span>{selectedSlot?.shift_name} {fmtTime(form.time)}</span><span>·</span>
                    <span>{form.party_size} covers</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: 'Name *',  type: 'text',  key: 'guest_name',  ph: 'Full name' },
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
