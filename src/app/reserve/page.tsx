'use client'
import { useState, useEffect, useCallback } from 'react'

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

function getTenantSlug(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || ''
  // Subdomain routing: host must actually end with .appDomain (not just have 3+ parts)
  if (appDomain && hostname.endsWith(`.${appDomain}`)) {
    return hostname.slice(0, hostname.length - appDomain.length - 1) || null
  }
  // Dev or any host without a matching custom-domain subdomain: use ?tenant= param
  return new URLSearchParams(window.location.search).get('tenant')
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function ReservePage() {
  const [slug, setSlug] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('search')

  // Step 1
  const [date, setDate] = useState(tomorrow())
  const [partySize, setPartySize] = useState(2)

  // Step 2
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  // Step 3
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [occasion, setOccasion] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Step 4
  const [confirmationRef, setConfirmationRef] = useState('')

  useEffect(() => {
    setSlug(getTenantSlug())
  }, [])

  const fetchSlots = useCallback(async () => {
    if (!slug) return
    setLoadingSlots(true)
    setSlotsError('')
    try {
      const res = await fetch(
        `/api/availability?tenant=${slug}&date=${date}&party_size=${partySize}`
      )
      const data: AvailabilityResponse = await res.json()
      setAvailability(data)
      if (!data.available) {
        setSlotsError(
          data.reason === 'closed' ? 'The restaurant is closed on this date.'
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

  const handleSearch = () => {
    setSelectedSlot(null)
    setStep('slots')
    fetchSlots()
  }

  const handleSelectSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot)
    setStep('details')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !slug) return
    setSubmitting(true)
    setSubmitError('')

    const area = selectedSlot.areas[0]

    try {
      const res = await fetch(`/api/reservations?tenant=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: selectedSlot.shift_id,
          seating_area_id: area?.area_id || null,
          date,
          time: selectedSlot.time,
          party_size: partySize,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone || null,
          occasion: occasion || null,
          notes: notes || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Could not complete the reservation.')
        return
      }

      setConfirmationRef(data.reservation?.id?.slice(0, 8).toUpperCase() || 'OK')
      setStep('success')
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!slug) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Step 1: Date + party size */}
        {step === 'search' && (
          <div>
            <h1 className="text-3xl font-bold mb-2 text-center">Reserve a table</h1>
            <p className="text-gray-500 text-sm text-center mb-10">Choose a date and party size</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Date</label>
                <input
                  type="date"
                  value={date}
                  min={today()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Party size</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setPartySize(n)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
                        partySize === n
                          ? 'bg-white text-black'
                          : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSearch}
              className="w-full mt-8 bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-100 transition text-sm tracking-wide"
            >
              Check availability
            </button>
          </div>
        )}

        {/* Step 2: Available slots */}
        {step === 'slots' && (
          <div>
            <button onClick={() => setStep('search')} className="text-xs text-gray-500 hover:text-white transition mb-6 block">
              ← Back
            </button>
            <h2 className="text-xl font-bold mb-1">{fmtDate(date)}</h2>
            <p className="text-gray-500 text-sm mb-8">
              {partySize} {partySize === 1 ? 'person' : 'people'}
            </p>

            {loadingSlots && (
              <div className="text-center py-12">
                <div className="text-gray-600 text-sm">Checking availability…</div>
              </div>
            )}

            {!loadingSlots && slotsError && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-5 text-center">
                <p className="text-red-400 text-sm">{slotsError}</p>
                <button onClick={() => setStep('search')} className="text-xs text-gray-500 hover:text-white mt-3 transition">
                  Change date →
                </button>
              </div>
            )}

            {!loadingSlots && availability?.available && (
              <div>
                {availability.special_event && (
                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 mb-6 text-sm text-amber-300">
                    {availability.special_event.name} — deposit of ${availability.special_event.deposit_amount} required
                  </div>
                )}

                {/* Group by shift */}
                {Object.entries(
                  availability.slots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
                    const key = slot.shift_name
                    if (!acc[key]) acc[key] = []
                    acc[key].push(slot)
                    return acc
                  }, {})
                ).map(([shiftName, slots]) => (
                  <div key={shiftName} className="mb-6">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{shiftName}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button
                          key={slot.time}
                          onClick={() => handleSelectSlot(slot)}
                          className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800 text-white rounded-xl py-3 text-sm font-medium transition"
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

        {/* Step 3: Guest details */}
        {step === 'details' && selectedSlot && (
          <div>
            <button onClick={() => setStep('slots')} className="text-xs text-gray-500 hover:text-white transition mb-6 block">
              ← Back
            </button>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
              <p className="text-sm font-medium">{fmtDate(date)} at {selectedSlot.time}</p>
              <p className="text-xs text-gray-500 mt-1">
                {partySize} {partySize === 1 ? 'person' : 'people'} · {selectedSlot.shift_name}
                {selectedSlot.areas[0] && ` · ${selectedSlot.areas[0].area_name}`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Full name *</label>
                <input
                  required
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Email *</label>
                <input
                  required
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Phone</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Occasion</label>
                <select
                  value={occasion}
                  onChange={e => setOccasion(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none"
                >
                  {OCCASIONS.map(o => <option key={o} value={o}>{o || 'None'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">Special requests</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Allergies, high chair, quiet table…"
                  className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600 resize-none placeholder:text-gray-700"
                />
              </div>

              {submitError && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-100 transition text-sm tracking-wide disabled:opacity-50 mt-2"
              >
                {submitting ? 'Confirming…' : 'Confirm reservation'}
              </button>

              <p className="text-xs text-gray-600 text-center">
                A confirmation will be sent to your email. You can cancel anytime.
              </p>
            </form>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="text-center">
            <div className="text-5xl mb-6">✓</div>
            <h2 className="text-2xl font-bold mb-2">You're confirmed</h2>
            <p className="text-gray-400 text-sm mb-6">
              {fmtDate(date)} at {selectedSlot?.time} for {partySize} {partySize === 1 ? 'person' : 'people'}
            </p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Confirmation</p>
              <p className="font-mono text-lg font-bold tracking-widest">#{confirmationRef}</p>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Check your email for the confirmation and cancellation link.
            </p>
            <button
              onClick={() => {
                setStep('search')
                setGuestName(''); setGuestEmail(''); setGuestPhone('')
                setOccasion(''); setNotes(''); setSelectedSlot(null)
                setDate(tomorrow())
              }}
              className="text-sm text-gray-500 hover:text-white transition"
            >
              Make another reservation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
