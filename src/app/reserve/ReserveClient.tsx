'use client'
import { useState, useCallback, useEffect } from 'react'
import type { Theme } from '@/lib/theme'

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

const OCCASIONS = ['', 'Birthday', 'Anniversary', 'Business dinner', 'Date night', 'Family gathering', 'Other']

function today()    { return new Date().toISOString().split('T')[0] }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

interface Props {
  slug: string
  theme: Theme
  minPartySize?: number
  maxPartySize?: number
}

export function ReserveClient({ slug, theme: t, minPartySize = 1, maxPartySize = 10 }: Props) {
  const [step, setStep] = useState<Step>('search')
  const [date, setDate] = useState(tomorrow())
  const [partySize, setPartySize] = useState(Math.min(2, maxPartySize))

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const [guestName, setGuestName]   = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [occasion, setOccasion]     = useState('')
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmationRef, setConfirmationRef] = useState('')
  const [countdown, setCountdown] = useState(6)

  // Countdown redirect after successful reservation
  useEffect(() => {
    if (step !== 'success') return
    setCountdown(6)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setStep('search')
          setGuestName(''); setGuestEmail(''); setGuestPhone('')
          setOccasion(''); setNotes(''); setSelectedSlot(null)
          setDate(tomorrow())
          return 6
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  // Inline style helpers derived from theme
  const root: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: t.bg,
    color: t.text,
    fontFamily: t.font,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
  }

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: '26rem',
    backgroundColor: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: '1.25rem',
    padding: '1.75rem',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: t.input,
    border: `1px solid ${t.border}`,
    color: t.text,
    borderRadius: t.btnRadius,
    padding: '0.75rem 1rem',
    fontSize: '0.9375rem',
    fontFamily: t.font,
    outline: 'none',
    display: 'block',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: t.faint,
    marginBottom: '0.5rem',
  }

  const primaryBtn: React.CSSProperties = {
    width: '100%',
    backgroundColor: t.primary,
    color: t.primaryText,
    fontWeight: 700,
    fontSize: '0.9375rem',
    padding: '0.9rem',
    borderRadius: t.btnRadius,
    border: 'none',
    cursor: 'pointer',
    fontFamily: t.font,
    marginTop: '0.5rem',
  }

  const ghostBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: t.muted,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: t.font,
    padding: 0,
  }

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true)
    setSlotsError('')
    try {
      const res = await fetch(`/api/availability?tenant=${slug}&date=${date}&party_size=${partySize}`)
      const data: AvailabilityResponse = await res.json()
      setAvailability(data)
      if (!data.available) {
        setSlotsError(
          data.reason === 'closed'               ? 'The restaurant is closed on this date.'
          : data.reason === 'party_size_out_of_range'
            ? `Party size must be between ${data.min} and ${data.max}.`
          : 'No availability for this date.'
        )
      }
    } catch {
      setSlotsError('Could not load availability. Please try again.')
    } finally {
      setLoadingSlots(false)
    }
  }, [slug, date, partySize])

  const handleSearch = () => { setSelectedSlot(null); setStep('slots'); fetchSlots() }

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

  const slotsByShift = availability?.slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.shift_name]) acc[s.shift_name] = []
    acc[s.shift_name].push(s)
    return acc
  }, {})

  return (
    <div style={root}>
      <div style={{ width: '100%', maxWidth: '26rem' }}>

        {/* Step 1 — search */}
        {step === 'search' && (
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.375rem', textAlign: 'center', color: t.text }}>
              Reserve a table
            </h1>
            <p style={{ color: t.muted, fontSize: '0.875rem', textAlign: 'center', marginBottom: '2rem' }}>
              Choose a date and party size
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date" value={date} min={today()}
                  onChange={e => setDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Party size</label>
                {maxPartySize - minPartySize <= 7 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                    {Array.from({ length: maxPartySize - minPartySize + 1 }, (_, i) => i + minPartySize).map(n => (
                      <button key={n} type="button" onClick={() => setPartySize(n)}
                        style={{
                          padding: '0.625rem 0',
                          borderRadius: t.btnRadius,
                          fontSize: '0.875rem', fontWeight: 600, border: 'none',
                          cursor: 'pointer', transition: 'all 0.1s',
                          backgroundColor: partySize === n ? t.primary : t.input,
                          color: partySize === n ? t.primaryText : t.muted,
                          fontFamily: t.font,
                        }}
                      >{n}</button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={partySize}
                    onChange={e => setPartySize(Number(e.target.value))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {Array.from({ length: maxPartySize - minPartySize + 1 }, (_, i) => i + minPartySize).map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <button onClick={handleSearch} style={primaryBtn}>Check availability</button>
          </div>
        )}

        {/* Step 2 — slots */}
        {step === 'slots' && (
          <div>
            <button onClick={() => setStep('search')} style={{ ...ghostBtn, marginBottom: '1.25rem', display: 'block' }}>
              ← Back
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem', color: t.text }}>{fmtDate(date)}</h2>
            <p style={{ color: t.muted, fontSize: '0.875rem', marginBottom: '1.75rem' }}>
              {partySize} {partySize === 1 ? 'person' : 'people'}
            </p>

            {loadingSlots && (
              <p style={{ color: t.muted, fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
                Checking availability…
              </p>
            )}

            {!loadingSlots && slotsError && (
              <div style={{ backgroundColor: t.errorBg, border: `1px solid ${t.errorBorder}`, borderRadius: t.btnRadius, padding: '1rem 1.25rem', textAlign: 'center' }}>
                <p style={{ color: t.errorText, fontSize: '0.875rem', marginBottom: '0.75rem' }}>{slotsError}</p>
                <button onClick={() => setStep('search')} style={ghostBtn}>Change date →</button>
              </div>
            )}

            {!loadingSlots && availability?.available && slotsByShift && (
              <div>
                {availability.special_event && (
                  <div style={{ backgroundColor: `${t.primary}18`, border: `1px solid ${t.primary}40`, borderRadius: t.btnRadius, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: t.primary }}>
                    {availability.special_event.name} — deposit of ${availability.special_event.deposit_amount} required
                  </div>
                )}
                {Object.entries(slotsByShift).map(([shiftName, slots]) => (
                  <div key={shiftName} style={{ marginBottom: '1.5rem' }}>
                    <p style={labelStyle}>{shiftName}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                      {slots.map(slot => (
                        <button key={slot.time} type="button"
                          onClick={() => { setSelectedSlot(slot); setStep('details') }}
                          style={{
                            backgroundColor: t.input, border: `1px solid ${t.border}`,
                            borderRadius: t.btnRadius, padding: '0.625rem 0',
                            fontSize: '0.875rem', fontWeight: 600, color: t.text,
                            cursor: 'pointer', fontFamily: t.font,
                            transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.primary, e.currentTarget.style.color = t.primaryText)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = t.input, e.currentTarget.style.color = t.text)}
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

        {/* Step 3 — details */}
        {step === 'details' && selectedSlot && (
          <div>
            <button onClick={() => setStep('slots')} style={{ ...ghostBtn, marginBottom: '1.25rem', display: 'block' }}>
              ← Back
            </button>
            <div style={{ backgroundColor: t.input, border: `1px solid ${t.border}`, borderRadius: t.btnRadius, padding: '0.875rem 1rem', marginBottom: '1.75rem' }}>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: t.text }}>{fmtDate(date)} at {selectedSlot.time}</p>
              <p style={{ fontSize: '0.8125rem', color: t.muted, marginTop: '0.25rem' }}>
                {partySize} {partySize === 1 ? 'person' : 'people'} · {selectedSlot.shift_name}
                {selectedSlot.areas[0] && ` · ${selectedSlot.areas[0].area_name}`}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Full name *', type: 'text',  value: guestName,  set: setGuestName,  req: true },
                { label: 'Email *',     type: 'email', value: guestEmail, set: setGuestEmail, req: true },
                { label: 'Phone',       type: 'tel',   value: guestPhone, set: setGuestPhone, req: false },
              ].map(f => (
                <div key={f.label}>
                  <label style={labelStyle}>{f.label}</label>
                  <input required={f.req} type={f.type} value={f.value}
                    onChange={e => f.set(e.target.value)} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Occasion</label>
                <select value={occasion} onChange={e => setOccasion(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {OCCASIONS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Special requests</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Allergies, high chair, quiet table…"
                  style={{ ...inputStyle, resize: 'none' }} />
              </div>
              {submitError && (
                <p style={{ backgroundColor: t.errorBg, border: `1px solid ${t.errorBorder}`, borderRadius: t.btnRadius, padding: '0.75rem 1rem', color: t.errorText, fontSize: '0.875rem' }}>
                  {submitError}
                </p>
              )}
              <button type="submit" disabled={submitting}
                style={{ ...primaryBtn, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Confirming…' : 'Confirm reservation'}
              </button>
              <p style={{ color: t.faint, fontSize: '0.75rem', textAlign: 'center' }}>
                A confirmation will be sent to your email. You can cancel anytime.
              </p>
            </form>
          </div>
        )}

        {/* Step 4 — success */}
        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '50%',
              backgroundColor: `${t.primary}1a`, border: `1.5px solid ${t.primary}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', fontSize: '1.5rem', color: t.primary,
            }}>✓</div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '0.5rem', color: t.text }}>
              You&apos;re confirmed
            </h2>
            <p style={{ color: t.muted, fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              {fmtDate(date)} at {selectedSlot?.time}<br />
              {partySize} {partySize === 1 ? 'person' : 'people'}
            </p>
            <div style={{ backgroundColor: t.input, border: `1px solid ${t.border}`, borderRadius: t.btnRadius, padding: '1rem', marginBottom: '1.75rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.375rem' }}>Confirmation</p>
              <p style={{ fontFamily: 'monospace', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.12em', color: t.text }}>
                #{confirmationRef}
              </p>
            </div>
            <p style={{ color: t.faint, fontSize: '0.8125rem', marginBottom: '1rem' }}>
              Check your email for details and the cancellation link.
            </p>
            <p style={{ color: t.muted, fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
              Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}…
            </p>
            <button type="button"
              onClick={() => {
                setStep('search')
                setGuestName(''); setGuestEmail(''); setGuestPhone('')
                setOccasion(''); setNotes(''); setSelectedSlot(null)
                setDate(tomorrow())
              }}
              style={ghostBtn}
            >
              Make another reservation →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
