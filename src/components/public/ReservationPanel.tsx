'use client'
import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  shift_id: string
  shift_name: string
  time: string
  areas: { area_id: string; area_name: string; available_capacity: number }[]
}

interface AvailabilityResponse {
  available: boolean
  reason?: string
  slots: AvailabilitySlot[]
  min?: number
  max?: number
  special_event?: { name: string; deposit_amount: number } | null
}

type Step = 'search' | 'slots' | 'details' | 'success'

const OCCASIONS = ['Birthday', 'Anniversary', 'Business dinner', 'Date night', 'Family gathering', 'Other']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function fmtDateShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

// ─── CalendarPicker ────────────────────────────────────────────────────────────

interface CalendarProps {
  value: string
  min: string
  availableDaysOfWeek: number[]
  blockedDates: string[]
  accent: string
  accentText: string
  font: string
  C: Record<string, string>
  onChange: (date: string) => void
}

function CalendarPicker({ value, min, availableDaysOfWeek, blockedDates, accent, accentText, font, C, onChange }: CalendarProps) {
  const [view, setView] = useState(() => {
    const [y, m] = (value || tomorrowStr()).split('-').map(Number)
    return { year: y, month: m - 1 }
  })

  const { year, month } = view
  const blockedSet = new Set(blockedDates)
  const minDate = min.split('-').map(Number)  // [y, m, d]

  const firstDow = new Date(year, month, 1).getDay()
  const startOffset = (firstDow + 6) % 7  // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setView(v => v.month === 0
    ? { year: v.year - 1, month: 11 }
    : { ...v, month: v.month - 1 })

  const nextMonth = () => setView(v => v.month === 11
    ? { year: v.year + 1, month: 0 }
    : { ...v, month: v.month + 1 })

  // Is prev navigation allowed? (don't go before current month)
  const [todayY, todayM] = todayStr().split('-').map(Number)
  const canGoPrev = year > todayY || (year === todayY && month > todayM - 1)

  const cells: { day: number; date: string; avail: boolean }[] = [
    ...Array(startOffset).fill(null).map(() => ({ day: 0, date: '', avail: false })),
  ]

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`
    const dayOfWeek = new Date(year, month, d).getDay()  // 0=Sun

    const isPast = dateStr < min
    const isBlocked = blockedSet.has(dateStr)
    const hasShifts = availableDaysOfWeek.length === 0 || availableDaysOfWeek.includes(dayOfWeek)
    const avail = !isPast && !isBlocked && hasShifts

    cells.push({ day: d, date: dateStr, avail })
  }

  return (
    <div style={{ fontFamily: font }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          style={{
            color: canGoPrev ? C.muted : C.faint,
            background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default',
            fontSize: '1rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
          }}
        >
          ‹
        </button>
        <span style={{ color: C.text, fontSize: '0.875rem', fontWeight: 600 }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{
            color: C.muted,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
          }}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.375rem' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.625rem', color: C.faint, fontWeight: 600, letterSpacing: '0.05em', paddingBottom: '0.375rem' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />

          const isSelected = cell.date === value
          const baseStyle: React.CSSProperties = {
            aspectRatio: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '0.5rem',
            fontSize: '0.8125rem',
            fontWeight: isSelected ? 700 : 400,
            border: 'none',
            cursor: cell.avail ? 'pointer' : 'default',
            transition: 'background-color 0.1s',
          }

          if (isSelected) {
            return (
              <button key={cell.date} type="button" style={{ ...baseStyle, backgroundColor: accent, color: accentText }}>
                {cell.day}
              </button>
            )
          }
          if (!cell.avail) {
            return (
              <div key={cell.date} style={{ ...baseStyle, color: C.faint, opacity: 0.4 }}>
                {cell.day}
              </div>
            )
          }
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onChange(cell.date)}
              style={{ ...baseStyle, color: C.text, backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.surface)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── ReservationPanel ─────────────────────────────────────────────────────────

interface Props {
  slug: string
  accent: string
  fontFamily: string
  availableDaysOfWeek: number[]
  blockedDates: string[]
}

export function ReservationPanel({ slug, accent, fontFamily, availableDaysOfWeek, blockedDates }: Props) {
  const [step, setStep] = useState<Step>('search')

  const [date, setDate] = useState(tomorrowStr())
  const [partySize, setPartySize] = useState(2)

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const [guestName, setGuestName]   = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [occasion, setOccasion]     = useState('')
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmationRef, setConfirmationRef] = useState('')

  const C = {
    bg:          '#1c1a22',
    surface:     'rgba(255,255,255,0.05)',
    input:       '#111015',
    border:      'rgba(255,255,255,0.07)',
    text:        '#F2EFE9',
    muted:       'rgba(242,239,233,0.45)',
    faint:       'rgba(242,239,233,0.2)',
    accent,
    accentText:  '#0F1015',
    errorBg:     'rgba(220,80,70,0.08)',
    errorBorder: 'rgba(220,80,70,0.25)',
    errorText:   '#f07070',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    backgroundColor: C.input,
    border: `1px solid ${C.border}`,
    color: C.text, borderRadius: '0.625rem',
    padding: '0.6875rem 0.875rem',
    fontSize: '0.875rem', fontFamily: fontFamily,
    outline: 'none', display: 'block',
  }

  const labelStyle: React.CSSProperties = {
    color: C.faint, fontSize: '0.6875rem', fontWeight: 600,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    display: 'block', marginBottom: '0.5rem', fontFamily,
  }

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setSlotsError('')
    try {
      const res = await fetch(`/api/availability?tenant=${slug}&date=${date}&party_size=${partySize}`)
      const data: AvailabilityResponse = await res.json()
      setAvailability(data)
      if (!data.available) {
        setSlotsError(
          data.reason === 'closed'
            ? 'The restaurant is closed on this date.'
            : data.reason === 'party_size_out_of_range'
              ? `Party size must be between ${data.min} and ${data.max}.`
              : 'No availability for this date.',
        )
      }
    } catch {
      setSlotsError('Could not load availability. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [slug, date, partySize])

  const handleSearch = () => {
    setSelectedSlot(null)
    setAvailability(null)
    setSlotsError('')
    setStep('slots')
    fetchSlots()
  }

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot)
    setStep('details')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/reservations?tenant=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: selectedSlot.shift_id,
          seating_area_id: selectedSlot.areas[0]?.area_id || null,
          date, time: selectedSlot.time, party_size: partySize,
          guest_name: guestName, guest_email: guestEmail,
          guest_phone: guestPhone || null, occasion: occasion || null, notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Could not complete the reservation.'); return }
      setConfirmationRef(data.reservation?.id?.slice(0, 8).toUpperCase() || 'OK')
      setStep('success')
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('search')
    setGuestName(''); setGuestEmail(''); setGuestPhone('')
    setOccasion(''); setNotes(''); setSelectedSlot(null)
    setDate(tomorrowStr()); setPartySize(2)
  }

  const slotsByShift = availability?.slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.shift_name]) acc[s.shift_name] = []
    acc[s.shift_name].push(s)
    return acc
  }, {})

  return (
    <div
      id="reserve-panel"
      style={{
        backgroundColor: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: '1rem',
        padding: '1.5rem',
        fontFamily,
      }}
    >
      {/* Title */}
      {step !== 'success' && (
        <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '1.25rem' }}>
          {step === 'search'  && 'Make a reservation'}
          {step === 'slots'   && 'Choose a time'}
          {step === 'details' && 'Your details'}
        </h2>
      )}

      {/* Selection summary pill (slots / details) */}
      {(step === 'slots' || step === 'details') && (
        <div style={{
          backgroundColor: C.input, borderRadius: '0.75rem',
          padding: '0.75rem 1rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
        }}>
          <div>
            <p style={{ color: C.text, fontSize: '0.875rem', fontWeight: 600 }}>
              {fmtDateShort(date)} · {partySize} {partySize === 1 ? 'guest' : 'guests'}
              {step === 'details' && selectedSlot && ` · ${selectedSlot.time}`}
            </p>
            {step === 'details' && selectedSlot && (
              <p style={{ color: C.muted, fontSize: '0.75rem', marginTop: '0.2rem' }}>
                {selectedSlot.shift_name}{selectedSlot.areas[0] && ` · ${selectedSlot.areas[0].area_name}`}
              </p>
            )}
          </div>
          <button
            onClick={() => step === 'details' ? setStep('slots') : setStep('search')}
            style={{ color: accent, fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Edit
          </button>
        </div>
      )}

      {/* ── SEARCH ─────────────────────────────────────────────── */}
      {step === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Party size */}
          <div>
            <span style={labelStyle}>Guests</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n} type="button"
                  onClick={() => setPartySize(n)}
                  style={{
                    padding: '0.625rem 0', borderRadius: '0.5rem',
                    fontSize: '0.875rem', fontWeight: 600, border: 'none',
                    cursor: 'pointer', transition: 'all 0.1s',
                    backgroundColor: partySize === n ? accent : C.input,
                    color: partySize === n ? C.accentText : C.muted,
                    fontFamily,
                  }}
                >
                  {n === 8 ? '8+' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Custom calendar */}
          <div>
            <span style={labelStyle}>Date</span>
            <div style={{
              backgroundColor: C.input,
              border: `1px solid ${C.border}`,
              borderRadius: '0.75rem',
              padding: '1rem',
            }}>
              <CalendarPicker
                value={date}
                min={todayStr()}
                availableDaysOfWeek={availableDaysOfWeek}
                blockedDates={blockedDates}
                accent={accent}
                accentText={C.accentText}
                font={fontFamily}
                C={C}
                onChange={setDate}
              />
            </div>
          </div>

          <button
            type="button" onClick={handleSearch}
            style={{
              backgroundColor: accent, color: C.accentText,
              fontWeight: 700, fontSize: '0.9375rem',
              padding: '0.875rem', borderRadius: '0.625rem',
              border: 'none', cursor: 'pointer', width: '100%', fontFamily,
            }}
          >
            Find a table
          </button>
        </div>
      )}

      {/* ── SLOTS ──────────────────────────────────────────────── */}
      {step === 'slots' && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ color: C.faint, fontSize: '0.875rem' }}>Checking availability…</p>
            </div>
          )}
          {!loading && slotsError && (
            <div style={{
              backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`,
              borderRadius: '0.75rem', padding: '1rem 1.25rem', textAlign: 'center',
            }}>
              <p style={{ color: C.errorText, fontSize: '0.875rem', marginBottom: '0.75rem' }}>{slotsError}</p>
              <button onClick={() => setStep('search')}
                style={{ color: C.muted, fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Change date
              </button>
            </div>
          )}
          {!loading && availability?.available && slotsByShift && (
            <div>
              {availability.special_event && (
                <div style={{
                  backgroundColor: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)',
                  borderRadius: '0.625rem', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                  fontSize: '0.8125rem', color: '#C9A96E',
                }}>
                  {availability.special_event.name} — ${availability.special_event.deposit_amount} deposit required
                </div>
              )}
              {Object.entries(slotsByShift).map(([shiftName, slots]) => (
                <div key={shiftName} style={{ marginBottom: '1.25rem' }}>
                  <p style={labelStyle}>{shiftName}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
                    {slots.map(slot => (
                      <button
                        key={slot.time} type="button"
                        onClick={() => handleSelectSlot(slot)}
                        style={{
                          backgroundColor: accent, color: C.accentText,
                          border: 'none', borderRadius: '0.5rem',
                          padding: '0.625rem 0', fontSize: '0.875rem',
                          fontWeight: 700, cursor: 'pointer', fontFamily,
                        }}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETAILS ────────────────────────────────────────────── */}
      {step === 'details' && selectedSlot && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { label: 'Full name *', key: 'guestName',  type: 'text',  value: guestName,  set: setGuestName,  req: true },
            { label: 'Email *',     key: 'guestEmail', type: 'email', value: guestEmail, set: setGuestEmail, req: true },
            { label: 'Phone',       key: 'guestPhone', type: 'tel',   value: guestPhone, set: setGuestPhone, req: false },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input
                required={f.req} type={f.type}
                value={f.value} onChange={e => f.set(e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}

          <div>
            <label style={labelStyle}>Occasion</label>
            <select value={occasion} onChange={e => setOccasion(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">None</option>
              {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Special requests</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Allergies, high chair, quiet table…"
              style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {submitError && (
            <p style={{
              backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`,
              borderRadius: '0.625rem', padding: '0.75rem 1rem',
              color: C.errorText, fontSize: '0.8125rem',
            }}>
              {submitError}
            </p>
          )}

          <button type="submit" disabled={submitting}
            style={{
              backgroundColor: accent, color: C.accentText,
              fontWeight: 700, fontSize: '0.9375rem', padding: '0.875rem',
              borderRadius: '0.625rem', border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1, width: '100%', fontFamily,
            }}>
            {submitting ? 'Confirming…' : 'Confirm reservation'}
          </button>
          <p style={{ color: C.faint, fontSize: '0.75rem', textAlign: 'center' }}>
            A confirmation email will be sent. You can cancel anytime.
          </p>
        </form>
      )}

      {/* ── SUCCESS ────────────────────────────────────────────── */}
      {step === 'success' && (
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '50%',
            backgroundColor: `${accent}1a`, border: `1.5px solid ${accent}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '1.375rem', color: accent,
          }}>
            ✓
          </div>
          <h3 style={{ color: C.text, fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.5rem', fontFamily }}>
            You&apos;re confirmed
          </h3>
          <p style={{ color: C.muted, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {fmtDateShort(date)} at {selectedSlot?.time}<br />
            {partySize} {partySize === 1 ? 'guest' : 'guests'}
          </p>
          <div style={{ backgroundColor: C.input, borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
            <p style={{ color: C.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
              Confirmation #
            </p>
            <p style={{ color: C.text, fontFamily: 'monospace', fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '0.12em' }}>
              {confirmationRef}
            </p>
          </div>
          <p style={{ color: C.faint, fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
            Check your email for details and the cancellation link.
          </p>
          <button type="button" onClick={reset}
            style={{ color: C.muted, fontSize: '0.8125rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily }}>
            Make another reservation →
          </button>
        </div>
      )}
    </div>
  )
}
