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
  { name: 'Inter',      sample: 'Clean and modern. The standard of the web.' },
  { name: 'Poppins',    sample: 'Geometric, friendly and contemporary.' },
  { name: 'Montserrat', sample: 'Bold character. Perfect for headings.' },
  { name: 'Raleway',    sample: 'Elegant and distinctive thin strokes.' },
  { name: 'Nunito',     sample: 'Rounded, warm, approachable for all ages.' },
  { name: 'Lato',       sample: 'Humanist and reliable. Works everywhere.' },
]

const SERIF_FONTS = [
  { name: 'Merriweather',       sample: 'Serious, classic. Great for fine dining.' },
  { name: 'Playfair Display',   sample: 'High contrast, editorial and luxurious.' },
  { name: 'Lora',               sample: 'Calligraphic warmth with modern clarity.' },
  { name: 'EB Garamond',        sample: 'Timeless old-style, Renaissance roots.' },
  { name: 'Cormorant Garamond', sample: 'Refined and delicate. Ultra-elegant.' },
  { name: 'Libre Baskerville',  sample: 'Readable and dignified. A trustworthy choice.' },
]

const ALL_FONTS = [...SANS_FONTS, ...SERIF_FONTS]

const DEFAULT_COLORS = { primary_color: '#000000', secondary_color: '#666666', background_color: '#ffffff' }

const BUTTON_STYLES = [
  { value: 'rounded', label: 'Rounded', radius: '0.625rem' },
  { value: 'sharp',   label: 'Sharp',   radius: '0' },
  { value: 'pill',    label: 'Pill',    radius: '9999px' },
] as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold pt-6 pb-3 mb-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </h2>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-offwhite/35 uppercase tracking-widest mb-2 block font-semibold">{children}</label>
}

const inputCls = 'w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'

interface Props { settings: TenantSettings; slug: string }

export function SettingsClient({ settings: initial, slug }: Props) {
  const [form, setForm]         = useState<TenantSettings>(initial)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [fontOpen, setFontOpen] = useState(false)

  const set = (key: keyof TenantSettings, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))
  const resetColors = () => setForm(prev => ({ ...prev, ...DEFAULT_COLORS }))

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=settings&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    } finally { setSaving(false) }
  }

  const currentFont = ALL_FONTS.find(f => f.name === form.font_family) || SANS_FONTS[0]

  return (
    <div className="max-w-2xl">

      {/* ── General ── */}
      <SectionTitle>General</SectionTitle>
      <div className="space-y-4">
        {[
          { key: 'name',         label: 'Restaurant name', ph: 'Your restaurant name', type: 'text' },
          { key: 'address',      label: 'Address',         ph: '123 Main St, City', type: 'text' },
          { key: 'phone',        label: 'Phone',           ph: '+1 555 000 0000', type: 'tel' },
          { key: 'hours_text',   label: 'Hours (public display)', ph: 'Mon–Fri 12–15 & 19–23', type: 'text' },
        ].map(({ key, label, ph, type }) => (
          <div key={key}>
            <Label>{label}</Label>
            <input type={type} placeholder={ph} value={(form as any)[key] || ''}
              onChange={e => set(key as keyof TenantSettings, e.target.value)} className={inputCls} />
          </div>
        ))}
        <div>
          <Label>Description</Label>
          <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3}
            placeholder="Short description shown on your public page"
            className="w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20 resize-none" />
        </div>
        <div>
          <Label>Restaurant website</Label>
          <input type="text" value={form.website_url || ''} placeholder="yourrestaurant.com"
            onChange={e => set('website_url', e.target.value)}
            onBlur={e => { const v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v)) set('website_url', `https://${v}`) }}
            className={inputCls} />
          <p className="text-xs text-offwhite/25 mt-1">Guests are redirected here after booking.</p>
        </div>
      </div>

      {/* ── Booking rules ── */}
      <SectionTitle>Booking rules</SectionTitle>
      <div className="space-y-4">
        <div>
          <Label>Timezone</Label>
          <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className={inputCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'min_party_size',    label: 'Min party' },
            { key: 'max_party_size',    label: 'Max party' },
            { key: 'min_advance_hours', label: 'Min advance (hrs)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label>{label}</Label>
              <input type="number" min={0} value={(form as any)[key]}
                onChange={e => set(key as keyof TenantSettings, parseInt(e.target.value))} className={inputCls} />
            </div>
          ))}
        </div>
        <div>
          <Label>Notification email</Label>
          <input type="email" value={form.notification_email || ''} placeholder="owner@restaurant.com"
            onChange={e => set('notification_email', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* ── Social links ── */}
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
            <input type="url" value={(form[field] as string) || ''} placeholder={ph}
              onChange={e => set(field, e.target.value)} className={inputCls} />
          </div>
        ))}
      </div>

      {/* ── Branding ── */}
      <SectionTitle>Branding</SectionTitle>
      <div className="space-y-5">
        {/* Colors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Colors</Label>
            <button type="button" onClick={resetColors}
              className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors underline underline-offset-2">
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
                <p className="text-xs text-offwhite/25 mb-1.5">{label}</p>
                <div className="flex gap-2 items-center">
                  <input type="color" value={(form[field] as string) || '#000000'} onChange={e => set(field, e.target.value)}
                    className="h-9 w-9 rounded-lg cursor-pointer flex-shrink-0"
                    style={{ border: '1px solid rgba(255,255,255,0.10)', backgroundColor: 'transparent' }} />
                  <input type="text" value={(form[field] as string) || ''} onChange={e => set(field, e.target.value)}
                    className="flex-1 min-w-0 text-offwhite text-xs font-mono rounded-lg px-2.5 py-2 focus:outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Button style */}
        <div>
          <Label>Button style</Label>
          <div className="grid grid-cols-3 gap-3">
            {BUTTON_STYLES.map(s => {
              const active = (form.button_style || 'rounded') === s.value
              return (
                <button key={s.value} type="button" onClick={() => set('button_style', s.value)}
                  className={`flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl transition-colors ${
                    active ? 'text-offwhite' : 'text-offwhite/40 hover:text-offwhite/70'
                  }`}
                  style={{
                    border: active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  }}>
                  <div className="w-full h-7 flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: active ? '#F2EFE9' : 'rgba(255,255,255,0.06)',
                      color: active ? '#0F1720' : 'rgba(242,239,233,0.35)',
                      borderRadius: s.radius,
                    }}>
                    Book
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font picker */}
        <div>
          <Label>Font</Label>
          <div className="relative">
            <button type="button" onClick={() => setFontOpen(o => !o)}
              className="w-full rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between gap-3 transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseOut={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
              <div className="flex-1 min-w-0">
                <span className="block text-offwhite font-medium" style={{ fontFamily: `'${currentFont.name}', sans-serif` }}>
                  {currentFont.name}
                </span>
                <span className="block text-offwhite/35 text-xs mt-0.5 truncate" style={{ fontFamily: `'${currentFont.name}', sans-serif` }}>
                  {currentFont.sample}
                </span>
              </div>
              <span className="text-offwhite/35 flex-shrink-0">{fontOpen ? '▲' : '▼'}</span>
            </button>

            {fontOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto"
                style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}>
                <p className="text-[10px] text-offwhite/25 uppercase tracking-widest px-4 pt-3 pb-1 font-semibold">Sans-serif</p>
                {SANS_FONTS.map(f => (
                  <button key={f.name} type="button" onClick={() => { set('font_family', f.name); setFontOpen(false) }}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-4 ${
                      form.font_family === f.name ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    }`}>
                    <span className="text-offwhite text-sm font-medium" style={{ fontFamily: `'${f.name}', sans-serif` }}>{f.name}</span>
                    <span className="text-offwhite/35 text-xs text-right" style={{ fontFamily: `'${f.name}', sans-serif` }}>Aa Bb Cc 123</span>
                  </button>
                ))}
                <p className="text-[10px] text-offwhite/25 uppercase tracking-widest px-4 pt-3 pb-1 font-semibold mt-1"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>Serif</p>
                {SERIF_FONTS.map(f => (
                  <button key={f.name} type="button" onClick={() => { set('font_family', f.name); setFontOpen(false) }}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-4 ${
                      form.font_family === f.name ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    }`}>
                    <span className="text-offwhite text-sm font-medium" style={{ fontFamily: `'${f.name}', serif` }}>{f.name}</span>
                    <span className="text-offwhite/35 text-xs text-right" style={{ fontFamily: `'${f.name}', serif` }}>Aa Bb Cc 123</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save ── */}
      <div className="mt-8 flex items-center gap-4">
        <button onClick={save} disabled={saving}
          className="bg-offwhite text-midnight font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-sage">Saved ✓</span>}
      </div>
    </div>
  )
}
