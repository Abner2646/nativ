'use client'
import { useState, useCallback, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
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
  special_event?: { name: string } | null
  deposit_rule?: { id: string; amount_cents: number; refund_cutoff_hours: number } | null
}

type Step = 'search' | 'slots' | 'details' | 'payment' | 'success'

// ─── PaymentForm (must be inside <Elements>) ──────────────────────────────────

function PaymentForm({ amountCents, onSuccess, onError, t }: {
  amountCents: number
  onSuccess: (piId: string) => void
  onError: (msg: string) => void
  t: Theme
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements) return
    setPaying(true)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })
    if (error) {
      onError(error.message || 'Payment failed. Please try again.')
      setPaying(false)
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id)
    } else {
      onError('Unexpected payment status. Please try again.')
      setPaying(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="button"
        onClick={handlePay}
        disabled={paying || !stripe || !elements}
        style={{
          width: '100%', backgroundColor: t.primary, color: t.primaryText,
          fontWeight: 700, fontSize: '0.9375rem', padding: '0.9rem',
          borderRadius: t.btnRadius, border: 'none', fontFamily: t.font,
          cursor: paying || !stripe || !elements ? 'not-allowed' : 'pointer',
          opacity: paying || !stripe || !elements ? 0.6 : 1,
        }}
      >
        {paying ? 'Processing…' : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </div>
  )
}

const OCCASIONS = ['', 'Birthday', 'Anniversary', 'Business dinner', 'Date night', 'Family gathering', 'Other']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function today()    { return new Date().toISOString().split('T')[0] }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] }
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── CalendarPicker ────────────────────────────────────────────────────────────

interface CalendarProps {
  value: string
  min: string
  availableDaysOfWeek: number[]
  blockedDates: string[]
  theme: Theme
  onChange: (date: string) => void
}

function CalendarPicker({ value, min, availableDaysOfWeek, blockedDates, theme: t, onChange }: CalendarProps) {
  const [view, setView] = useState(() => {
    const [y, m] = (value || tomorrow()).split('-').map(Number)
    return { year: y, month: m - 1 }
  })

  const { year, month } = view
  const blockedSet = new Set(blockedDates)

  const firstDow = new Date(year, month, 1).getDay()
  const startOffset = (firstDow + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const [todayY, todayM] = today().split('-').map(Number)
  const canGoPrev = year > todayY || (year === todayY && month > todayM - 1)

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })

  const cells: { day: number; date: string; avail: boolean }[] = [
    ...Array(startOffset).fill(null).map(() => ({ day: 0, date: '', avail: false })),
  ]
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`
    const dayOfWeek = new Date(year, month, d).getDay()
    const isPast = dateStr < min
    const isBlocked = blockedSet.has(dateStr)
    const hasShifts = availableDaysOfWeek.length === 0 || availableDaysOfWeek.includes(dayOfWeek)
    cells.push({ day: d, date: dateStr, avail: !isPast && !isBlocked && hasShifts })
  }

  return (
    <div style={{ fontFamily: t.font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <button type="button" onClick={prevMonth} disabled={!canGoPrev}
          style={{ color: canGoPrev ? t.muted : t.faint, background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', fontSize: '1rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
          ‹
        </button>
        <span style={{ color: t.text, fontSize: '0.875rem', fontWeight: 600 }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={nextMonth}
          style={{ color: t.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.375rem' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.625rem', color: t.faint, fontWeight: 600, letterSpacing: '0.05em', paddingBottom: '0.375rem' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />
          const isSelected = cell.date === value
          const base: React.CSSProperties = {
            aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: isSelected ? 700 : 400,
            border: 'none', cursor: cell.avail ? 'pointer' : 'default', transition: 'background-color 0.1s',
          }
          if (isSelected) return (
            <button key={cell.date} type="button" style={{ ...base, backgroundColor: t.primary, color: t.primaryText }}>{cell.day}</button>
          )
          if (!cell.avail) return (
            <div key={cell.date} style={{ ...base, color: t.faint, opacity: 0.4 }}>{cell.day}</div>
          )
          return (
            <button key={cell.date} type="button" onClick={() => onChange(cell.date)}
              style={{ ...base, color: t.text, backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.surface)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── ReserveClient ─────────────────────────────────────────────────────────────

interface Props {
  slug: string
  theme: Theme
  minPartySize?: number
  maxPartySize?: number
  availableDaysOfWeek?: number[]
  blockedDates?: string[]
}

export function ReserveClient({ slug, theme: t, minPartySize = 1, maxPartySize = 10, availableDaysOfWeek = [], blockedDates = [] }: Props) {
  const [step, setStep] = useState<Step>('search')
  const [date, setDate] = useState(tomorrow())
  const [partySize, setPartySize] = useState(() => Math.min(Math.max(2, minPartySize), maxPartySize))
  const [showAllParty, setShowAllParty] = useState(false)

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const [guestName, setGuestName]   = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [occasion, setOccasion]     = useState('')
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmationRef, setConfirmationRef] = useState('')
  const [countdown, setCountdown] = useState(6)

  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)
  const [clientSecret, setClientSecret]   = useState('')
  const [paymentError, setPaymentError]   = useState('')

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

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: t.input, border: `1px solid ${t.border}`,
    color: t.text, borderRadius: t.btnRadius, padding: '0.75rem 1rem',
    fontSize: '0.9375rem', fontFamily: t.font, outline: 'none', display: 'block', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: t.faint, marginBottom: '0.5rem',
  }

  const primaryBtn: React.CSSProperties = {
    width: '100%', backgroundColor: t.primary, color: t.primaryText,
    fontWeight: 700, fontSize: '0.9375rem', padding: '0.9rem',
    borderRadius: t.btnRadius, border: 'none', cursor: 'pointer', fontFamily: t.font, marginTop: '0.5rem',
  }

  const ghostBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: t.muted,
    fontSize: '0.8125rem', cursor: 'pointer', fontFamily: t.font, padding: 0,
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

  const submitReservation = async (piId?: string) => {
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
          ...(piId ? { stripe_payment_intent_id: piId } : {}),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return
    if (availability?.deposit_rule) {
      setSubmitting(true)
      setSubmitError('')
      try {
        const res = await fetch(`/api/deposit?tenant=${slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_cents: availability.deposit_rule.amount_cents }),
        })
        const data = await res.json()
        if (!res.ok) { setSubmitError(data.error || 'Payment setup failed.'); return }
        setStripePromise(loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, { stripeAccount: data.stripe_account_id }))
        setClientSecret(data.client_secret)
        setPaymentError('')
        setStep('payment')
      } catch {
        setSubmitError('Network error. Please try again.')
      } finally {
        setSubmitting(false)
      }
    } else {
      await submitReservation()
    }
  }

  const slotsByShift = availability?.slots.reduce<Record<string, AvailabilitySlot[]>>((acc, s) => {
    if (!acc[s.shift_name]) acc[s.shift_name] = []
    acc[s.shift_name].push(s)
    return acc
  }, {})

  const allPartySizes = Array.from({ length: maxPartySize - minPartySize + 1 }, (_, i) => minPartySize + i)
  const partySizeHasMore = allPartySizes.length > 8
  const visiblePartySizes = partySizeHasMore && !showAllParty ? allPartySizes.slice(0, 7) : allPartySizes

  return (
    <div style={{ minHeight: '100vh', backgroundColor: t.bg, color: t.text, fontFamily: t.font, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' }}>
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

              {/* Party size */}
              <div>
                <label style={labelStyle}>Party size</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                  {visiblePartySizes.map(n => (
                    <button key={n} type="button" onClick={() => setPartySize(n)}
                      style={{
                        padding: '0.625rem 0', borderRadius: t.btnRadius,
                        fontSize: '0.875rem', fontWeight: 600, border: 'none',
                        cursor: 'pointer', transition: 'all 0.1s',
                        backgroundColor: partySize === n ? t.primary : t.input,
                        color: partySize === n ? t.primaryText : t.muted,
                        fontFamily: t.font,
                      }}
                    >{n}</button>
                  ))}
                  {partySizeHasMore && !showAllParty && (
                    <button type="button" onClick={() => setShowAllParty(true)}
                      style={{
                        padding: '0.625rem 0', borderRadius: t.btnRadius,
                        fontSize: '0.75rem', fontWeight: 600, border: 'none',
                        cursor: 'pointer', transition: 'all 0.1s',
                        backgroundColor: t.input, color: t.muted, fontFamily: t.font,
                      }}
                    >more</button>
                  )}
                </div>
              </div>

              {/* Custom calendar */}
              <div>
                <label style={labelStyle}>Date</label>
                <div style={{ backgroundColor: t.input, border: `1px solid ${t.border}`, borderRadius: '0.75rem', padding: '1rem' }}>
                  <CalendarPicker
                    value={date}
                    min={today()}
                    availableDaysOfWeek={availableDaysOfWeek}
                    blockedDates={blockedDates}
                    theme={t}
                    onChange={setDate}
                  />
                </div>
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
                  <div style={{ backgroundColor: `${t.primary}18`, border: `1px solid ${t.primary}40`, borderRadius: t.btnRadius, padding: '0.75rem 1rem', marginBottom: '0.75rem', fontSize: '0.8125rem', color: t.primary }}>
                    {availability.special_event.name}
                  </div>
                )}
                {availability.deposit_rule && (
                  <div style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: t.btnRadius, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#fbbf24' }}>
                    A deposit of <strong>${(availability.deposit_rule.amount_cents / 100).toFixed(2)}</strong> is required to confirm this reservation.
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
                            cursor: 'pointer', fontFamily: t.font, transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = t.primary; e.currentTarget.style.color = t.primaryText }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = t.input; e.currentTarget.style.color = t.text }}
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
                  {/* Opt-in SMS: requerido por verificación toll-free (Twilio 30513) */}
                  {f.type === 'tel' && (
                    <p style={{ fontSize: '0.6875rem', opacity: 0.5, marginTop: '0.375rem', lineHeight: 1.5 }}>
                      By providing your phone number, you agree to receive reservation
                      confirmation and reminder text messages from this restaurant.
                      Msg &amp; data rates may apply. Msg frequency varies. Reply STOP
                      to opt out, HELP for help.
                    </p>
                  )}
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
                {submitting
                  ? (availability?.deposit_rule ? 'Loading payment…' : 'Confirming…')
                  : (availability?.deposit_rule ? `Next: Pay $${(availability.deposit_rule.amount_cents / 100).toFixed(2)} →` : 'Confirm reservation')}
              </button>
              <p style={{ color: t.faint, fontSize: '0.75rem', textAlign: 'center' }}>
                {availability?.deposit_rule
                  ? `Refunds available up to ${availability.deposit_rule.refund_cutoff_hours}h before your reservation.`
                  : 'A confirmation will be sent to your email. You can cancel anytime.'}
              </p>
            </form>
          </div>
        )}

        {/* Step 4 — payment */}
        {step === 'payment' && availability?.deposit_rule && stripePromise && clientSecret && (
          <div>
            <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', color: t.muted, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: t.font, padding: 0, marginBottom: '1.25rem', display: 'block' }}>
              ← Back
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: t.text }}>Complete payment</h2>
            <p style={{ color: t.muted, fontSize: '0.875rem', marginBottom: '1.75rem' }}>
              A deposit of <strong style={{ color: t.text }}>${(availability.deposit_rule.amount_cents / 100).toFixed(2)}</strong> is required to confirm this reservation.
            </p>
            <div style={{ backgroundColor: t.input, border: `1px solid ${t.border}`, borderRadius: t.btnRadius, padding: '0.875rem 1rem', marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{fmtDate(date)} at {selectedSlot?.time}</p>
              <p style={{ fontSize: '0.8125rem', color: t.muted, marginTop: '0.25rem' }}>{partySize} {partySize === 1 ? 'person' : 'people'} · {guestName}</p>
            </div>
            {paymentError && (
              <p style={{ backgroundColor: t.errorBg, border: `1px solid ${t.errorBorder}`, borderRadius: t.btnRadius, padding: '0.75rem 1rem', color: t.errorText, fontSize: '0.875rem', marginBottom: '1rem' }}>
                {paymentError}
              </p>
            )}
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: { colorPrimary: t.primary, colorBackground: t.input, colorText: t.text, colorDanger: '#ef4444', borderRadius: t.btnRadius, fontFamily: t.font },
                },
              }}
            >
              <PaymentForm
                amountCents={availability.deposit_rule.amount_cents}
                onSuccess={piId => submitReservation(piId)}
                onError={msg => setPaymentError(msg)}
                t={t}
              />
            </Elements>
            <p style={{ color: t.faint, fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
              Refunds available up to {availability.deposit_rule.refund_cutoff_hours}h before your reservation.
            </p>
          </div>
        )}

        {/* Step 5 — success */}
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
