'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { TenantSettings } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Bogota',
  'America/Mexico_City', 'America/Lima', 'America/Santiago',
  'Europe/London', 'Europe/Madrid', 'Europe/Paris',
]

const SANS_FONTS = [
  { name: 'Inter',        sample: 'Clean and modern. The standard of the web.' },
  { name: 'Poppins',      sample: 'Geometric, friendly and contemporary.' },
  { name: 'Montserrat',   sample: 'Bold character. Perfect for headings.' },
  { name: 'Raleway',      sample: 'Elegant and distinctive thin strokes.' },
  { name: 'Nunito',       sample: 'Rounded, warm, approachable for all ages.' },
  { name: 'Lato',         sample: 'Humanist and reliable. Works everywhere.' },
]

const SERIF_FONTS = [
  { name: 'Merriweather',         sample: 'Serious, classic. Great for fine dining.' },
  { name: 'Playfair Display',     sample: 'High contrast, editorial and luxurious.' },
  { name: 'Lora',                 sample: 'Calligraphic warmth with modern clarity.' },
  { name: 'EB Garamond',          sample: 'Timeless old-style, Renaissance roots.' },
  { name: 'Cormorant Garamond',   sample: 'Refined and delicate. Ultra-elegant.' },
  { name: 'Libre Baskerville',    sample: 'Readable and dignified. A trustworthy choice.' },
]

const ALL_FONTS = [...SANS_FONTS, ...SERIF_FONTS]

const DEFAULT_COLORS = {
  primary_color:    '#000000',
  secondary_color:  '#666666',
  background_color: '#ffffff',
}

// Label + field wrapper — defined OUTSIDE the component to avoid re-mount on every render
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold pt-6 pb-3 border-b border-gray-800 mb-4">
      {children}
    </h2>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs text-gray-500 uppercase tracking-widest mb-2 block">
      {children}
    </label>
  )
}

interface Props {
  settings: TenantSettings
  slug: string
}

export function SettingsClient({ settings: initial, slug }: Props) {
  const [form, setForm]       = useState<TenantSettings>(initial)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [fontOpen, setFontOpen] = useState(false)

  const set = (key: keyof TenantSettings, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const resetColors = () => setForm(prev => ({ ...prev, ...DEFAULT_COLORS }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=settings&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600'
  const currentFont = ALL_FONTS.find(f => f.name === form.font_family) || SANS_FONTS[0]

  return (
    <div className="max-w-2xl">

      {/* ── General ───────────────────────────────────────────── */}
      <SectionTitle>General</SectionTitle>
      <div className="space-y-4">
        <div>
          <Label>Restaurant name</Label>
          <input
            type="text"
            value={form.name || ''}
            onChange={e => set('name', e.target.value)}
            placeholder="Off The Hook"
            className={inputClass}
          />
        </div>
        <div>
          <Label>Description</Label>
          <textarea
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            rows={3}
            placeholder="Short description shown on your public page"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600 resize-none"
          />
        </div>
        <div>
          <Label>Address</Label>
          <input
            type="text"
            value={form.address || ''}
            onChange={e => set('address', e.target.value)}
            placeholder="123 Main St, City"
            className={inputClass}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <input
            type="tel"
            value={form.phone || ''}
            onChange={e => set('phone', e.target.value)}
            placeholder="+1 555 000 0000"
            className={inputClass}
          />
        </div>
        <div>
          <Label>Hours (public display)</Label>
          <input
            type="text"
            value={form.hours_text || ''}
            onChange={e => set('hours_text', e.target.value)}
            placeholder="Mon–Fri 12–15 & 19–23, Sat–Sun 19–23"
            className={inputClass}
          />
        </div>
        <div>
          <Label>Restaurant website</Label>
          <input
            type="text"
            value={form.website_url || ''}
            onChange={e => set('website_url', e.target.value)}
            onBlur={e => {
              const v = e.target.value.trim()
              if (v && !/^https?:\/\//i.test(v)) set('website_url', `https://${v}`)
            }}
            placeholder="yourrestaurant.com"
            className={inputClass}
          />
          <p className="text-xs text-gray-600 mt-1">Guests are redirected here after booking.</p>
        </div>
      </div>

      {/* ── Booking rules ─────────────────────────────────────── */}
      <SectionTitle>Booking rules</SectionTitle>
      <div className="space-y-4">
        <div>
          <Label>Timezone</Label>
          <select
            value={form.timezone}
            onChange={e => set('timezone', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Min party</Label>
            <input
              type="number" min={1}
              value={form.min_party_size}
              onChange={e => set('min_party_size', parseInt(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <Label>Max party</Label>
            <input
              type="number" min={1}
              value={form.max_party_size}
              onChange={e => set('max_party_size', parseInt(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <Label>Min advance (hrs)</Label>
            <input
              type="number" min={0}
              value={form.min_advance_hours}
              onChange={e => set('min_advance_hours', parseInt(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <Label>Notification email</Label>
          <input
            type="email"
            value={form.notification_email || ''}
            onChange={e => set('notification_email', e.target.value)}
            placeholder="owner@restaurant.com"
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Social links ──────────────────────────────────────── */}
      <SectionTitle>Social links</SectionTitle>
      <div className="space-y-4">
        {([
          { field: 'instagram_url',   label: 'Instagram',   ph: 'https://instagram.com/yourrestaurant' },
          { field: 'facebook_url',    label: 'Facebook',    ph: 'https://facebook.com/yourrestaurant' },
          { field: 'tripadvisor_url', label: 'TripAdvisor', ph: 'https://tripadvisor.com/…' },
          { field: 'yelp_url',        label: 'Yelp',        ph: 'https://yelp.com/biz/…' },
        ] as { field: keyof TenantSettings; label: string; ph: string }[]).map(({ field, label, ph }) => (
          <div key={field}>
            <Label>{label}</Label>
            <input
              type="url"
              value={(form[field] as string) || ''}
              onChange={e => set(field, e.target.value)}
              placeholder={ph}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {/* ── Branding ──────────────────────────────────────────── */}
      <SectionTitle>Branding</SectionTitle>
      <div className="space-y-5">

        {/* Colors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Colors</Label>
            <button
              type="button"
              onClick={resetColors}
              className="text-xs text-gray-500 hover:text-gray-300 transition underline underline-offset-2"
            >
              Reset to default
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {([
              { field: 'primary_color',    label: 'Primary' },
              { field: 'secondary_color',  label: 'Secondary' },
              { field: 'background_color', label: 'Background' },
            ] as { field: keyof TenantSettings; label: string }[]).map(({ field, label }) => (
              <div key={field}>
                <p className="text-xs text-gray-600 mb-1.5">{label}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={(form[field] as string) || '#000000'}
                    onChange={e => set(field, e.target.value)}
                    className="h-9 w-9 rounded border border-gray-700 bg-transparent cursor-pointer flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={(form[field] as string) || ''}
                    onChange={e => set(field, e.target.value)}
                    className="flex-1 min-w-0 bg-gray-900 border border-gray-700 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font picker with preview */}
        <div>
          <Label>Font</Label>
          <div className="relative">
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setFontOpen(o => !o)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-left flex items-center justify-between gap-3 hover:border-gray-500 transition"
            >
              <div className="flex-1 min-w-0">
                <span
                  className="block text-white font-medium"
                  style={{ fontFamily: `'${currentFont.name}', sans-serif` }}
                >
                  {currentFont.name}
                </span>
                <span
                  className="block text-gray-500 text-xs mt-0.5 truncate"
                  style={{ fontFamily: `'${currentFont.name}', sans-serif` }}
                >
                  {currentFont.sample}
                </span>
              </div>
              <span className="text-gray-500 flex-shrink-0">{fontOpen ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown */}
            {fontOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl max-h-80 overflow-y-auto">
                {/* Sans-serif group */}
                <p className="text-[10px] text-gray-600 uppercase tracking-widest px-4 pt-3 pb-1 font-semibold">Sans-serif</p>
                {SANS_FONTS.map(f => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => { set('font_family', f.name); setFontOpen(false) }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition flex items-center justify-between gap-4 ${form.font_family === f.name ? 'bg-gray-800' : ''}`}
                  >
                    <span
                      className="text-white text-sm font-medium"
                      style={{ fontFamily: `'${f.name}', sans-serif` }}
                    >
                      {f.name}
                    </span>
                    <span
                      className="text-gray-500 text-xs text-right"
                      style={{ fontFamily: `'${f.name}', sans-serif` }}
                    >
                      Aa Bb Cc 123
                    </span>
                  </button>
                ))}

                {/* Serif group */}
                <p className="text-[10px] text-gray-600 uppercase tracking-widest px-4 pt-3 pb-1 font-semibold border-t border-gray-800 mt-1">Serif</p>
                {SERIF_FONTS.map(f => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => { set('font_family', f.name); setFontOpen(false) }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition flex items-center justify-between gap-4 ${form.font_family === f.name ? 'bg-gray-800' : ''}`}
                  >
                    <span
                      className="text-white text-sm font-medium"
                      style={{ fontFamily: `'${f.name}', serif` }}
                    >
                      {f.name}
                    </span>
                    <span
                      className="text-gray-500 text-xs text-right"
                      style={{ fontFamily: `'${f.name}', serif` }}
                    >
                      Aa Bb Cc 123
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save ──────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-green-400">Saved ✓</span>}
      </div>
    </div>
  )
}
